"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  AUTOSAVE_DEBOUNCE_MS,
  NEVER_AUTOSAVE,
  autosaveLabel,
  classifyAutosave,
  emptyDirty,
  expandToUnits,
  formToFields,
  isDirty,
  leaveNeedsConfirm,
  isSaveOnly,
  markDirty as bump,
  mergeFieldErrors,
  parkInvalid,
  retryDelay,
  revertSaveOnly,
  sendableNames,
  settleDirty,
  snapshotDirty,
  unsavableNames,
  type AutosaveEntity,
  type AutosaveOutcome,
  type AutosavePhase,
  type ConflictInfo,
  type DirtySnapshot,
  type DirtyState,
  type ParkedState,
  type SaveUnit,
} from "@/app/admin/_lib/autosave";
import type { FormResult } from "./ui";

/**
 * Autosave for one editor <form>. The rules (and why) live with the pure logic
 * in app/admin/_lib/autosave.ts; this hook is the plumbing:
 *
 *  - every `input`/`change` inside the form marks that input name dirty;
 *    programmatic changes (ImageField, gallery/result rows, colour swatches,
 *    the byline picker) call `markDirty(name)` themselves;
 *  - ~1 s after the last change, the DIRTY units — and only those — are POSTed
 *    to /api/admin/autosave with the row's updated_at as the expectation;
 *  - one request in flight at a time; edits made meanwhile wait for the next;
 *  - a field stays dirty until a save that included it succeeds. Failures
 *    retry at 2 s, 5 s, 15 s, then every 30 s, and immediately on `online` /
 *    tab focus. Nothing is ever dropped;
 *  - a conflict stops autosave and raises the banner (Reload theirs / Keep
 *    mine); a field the server refused is parked until it's edited again;
 *  - requests go out with `keepalive` (when under the browser's 64 KiB cap),
 *    so a save in flight survives the tab closing; pending edits are flushed
 *    when the tab is hidden or unloaded, and the leave-page prompt only
 *    appears while something is actually pending;
 *  - new items (no id yet) only track dirtiness — they save on Create;
 *  - never router.refresh(): that would re-render the form under the typist.
 *
 * The explicit Save goes through `wrapSave(action)`: it waits for an in-flight
 * autosave, sends the current version token, and on success clears exactly
 * the fields it carried.
 */

const ENDPOINT = "/api/admin/autosave";
/** browsers cap keepalive request bodies at 64 KiB (in flight, per page) */
const KEEPALIVE_MAX_BYTES = 60_000;

export type SaveResult = FormResult & { updatedAt?: string; conflict?: ConflictInfo };
export type AutosaveConflict = ConflictInfo & { source: "autosave" | "save" };

export type Autosave = {
  /** false for a new item: dirtiness is tracked, nothing is sent */
  enabled: boolean;
  phase: AutosavePhase;
  status: ReturnType<typeof autosaveLabel>;
  /** unsaved edits exist or a save is in flight — drives the leave-page prompt */
  pending: boolean;
  conflict: AutosaveConflict | null;
  fieldError: (name: string) => string | undefined;
  markDirty: (name: string) => void;
  keepMine: () => void;
  reloadTheirs: () => void;
  /**
   * For in-panel "Back"/"Cancel" links: true = go ahead. Asks only when edits
   * would really be lost (see leaveNeedsConfirm); "discard" then means it.
   */
  confirmLeave: () => boolean;
  /** spread onto the form's hidden <input> — the concurrency token */
  tokenInputProps: { type: "hidden"; name: "updated_at"; value: string };
  wrapSave: <R extends SaveResult>(action: (fd: FormData) => Promise<R>) => (fd: FormData) => Promise<R>;
};

type Options = {
  entity: AutosaveEntity;
  /** the row's id; null/"" for a new item */
  id: string | number | null | undefined;
  /** the row's updated_at exactly as the server sent it — never via new Date() */
  updatedAt: string | null | undefined;
  /** hold saves (e.g. while an image is uploading) */
  paused?: boolean;
};

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export function useAutosave(formRef: RefObject<HTMLFormElement | null>, opts: Options): Autosave {
  const enabled = opts.id !== null && opts.id !== undefined && opts.id !== "" && Boolean(opts.updatedAt);

  // latest options, read by the (stable) callbacks below — refreshed after
  // each commit, which is before any event or timer can read it
  const cfg = useRef({ ...opts, enabled });
  useEffect(() => {
    cfg.current = { ...opts, enabled };
  });

  const tokenRef = useRef(opts.updatedAt ?? "");
  const [token, setTokenState] = useState(opts.updatedAt ?? "");
  const lastPropRef = useRef(opts.updatedAt ?? "");

  const dirtyRef = useRef<DirtyState>(emptyDirty());
  const parkedRef = useRef<ParkedState>({});
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  /** conflict / deleted: nothing more is sent until the person decides */
  const stoppedRef = useRef(false);
  /** the server refused the request itself: don't loop; the next edit retries */
  const haltedRef = useRef(false);
  /** an explicit Save is running: autosave waits for it */
  const explicitRef = useRef(false);
  /** Save-only fields (slug, published, order) as last loaded or saved — see onEdit */
  const loadedRef = useRef<Record<string, string>>({});
  /** "Reload their version": no prompt, no exit flush */
  const discardRef = useRef(false);

  const [phase, setPhase] = useState<AutosavePhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflictState] = useState<AutosaveConflict | null>(null);
  const conflictRef = useRef<AutosaveConflict | null>(null);
  const [inFlight, setInFlight] = useState(false);
  // re-render only when what the UI shows changes — not on every keystroke
  const [flags, setFlags] = useState({ dirty: false, waiting: false, needsSave: false });

  const setConflict = useCallback((c: AutosaveConflict | null) => {
    conflictRef.current = c;
    setConflictState(c);
  }, []);

  const setToken = useCallback(
    (value: string) => {
      tokenRef.current = value;
      setTokenState(value);
      // also write the DOM now, so a requestSubmit() in the same tick sends it
      const el = formRef.current?.elements.namedItem("updated_at");
      if (el instanceof HTMLInputElement) el.value = value;
    },
    [formRef]
  );

  const syncFlags = useCallback(() => {
    const { entity, enabled: on } = cfg.current;
    const d = dirtyRef.current;
    const next = {
      dirty: isDirty(d),
      waiting: on && sendableNames(entity, d, parkedRef.current).length > 0,
      needsSave: on && unsavableNames(entity, d).length > 0,
    };
    setFlags((f) =>
      f.dirty === next.dirty && f.waiting === next.waiting && f.needsSave === next.needsSave ? f : next
    );
  }, []);

  /**
   * syncFlags, but after the current event. markDirty runs inside the form's
   * native input listener, BEFORE React handles the same event; a state update
   * there gets flushed in the microtask between listeners, re-rendering
   * controlled inputs (the slug) with their old value — which swallowed the
   * first keystroke into an untouched form. The dirty refs themselves stay
   * synchronous, so a Save started by the same blur still sees them.
   */
  const syncFlagsSoon = useCallback(() => {
    setTimeout(syncFlags, 0);
  }, [syncFlags]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // `flush` and `schedule` call each other; a ref breaks the cycle
  const flushRef = useRef<() => void>(() => {});
  const schedule = useCallback(
    (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushRef.current();
      }, delay);
    },
    [clearTimer]
  );

  /** more to send, and nothing stopping us from sending it on our own */
  const shouldContinue = () =>
    !stoppedRef.current &&
    !haltedRef.current &&
    sendableNames(cfg.current.entity, dirtyRef.current, parkedRef.current).length > 0;

  const handle = useCallback(
    (outcome: AutosaveOutcome, units: readonly SaveUnit[], snapshot: DirtySnapshot) => {
      switch (outcome.kind) {
        case "saved": {
          setToken(outcome.updatedAt);
          dirtyRef.current = settleDirty(dirtyRef.current, snapshot, outcome.saved);
          parkedRef.current = parkInvalid(parkedRef.current, snapshot, units, outcome.fieldErrors);
          setErrors((prev) => mergeFieldErrors(prev, units, outcome.fieldErrors));
          attemptRef.current = 0;
          setMessage(null);
          if (outcome.saved.length) setSavedAt(new Date());
          const parked = Object.entries(parkedRef.current).some(
            ([n, v]) => dirtyRef.current.versions[n] === v
          );
          setPhase(parked ? "invalid" : "saved");
          break;
        }
        case "conflict":
          stoppedRef.current = true;
          setConflict({ ...outcome.conflict, source: "autosave" });
          setPhase("conflict");
          break;
        case "gone":
          stoppedRef.current = true;
          setMessage(outcome.message);
          setPhase("gone");
          break;
        case "auth":
        case "retry":
          // nothing was saved, so nothing is cleared — try again later
          setMessage(outcome.message);
          setPhase(outcome.kind === "auth" ? "auth" : outcome.offline ? "offline" : "retrying");
          schedule(retryDelay(attemptRef.current++));
          break;
        case "fatal":
          haltedRef.current = true;
          setMessage(outcome.message);
          setPhase("error");
          break;
      }
      syncFlags();
    },
    [schedule, setConflict, setToken, syncFlags]
  );

  const flush = useCallback(() => {
    const { entity, id, enabled: on, paused } = cfg.current;
    if (!on || stoppedRef.current || paused || explicitRef.current || inFlightRef.current) return;
    const form = formRef.current;
    if (!form) return;

    const names = sendableNames(entity, dirtyRef.current, parkedRef.current);
    if (!names.length) return;
    clearTimer();

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // the `online` listener picks it up; no point burning a request
      setPhase("offline");
      return;
    }

    const { units, inputs } = expandToUnits(entity, names);
    // read the values and their versions in the same tick
    const fields = formToFields(new FormData(form), inputs);
    const snapshot = snapshotDirty(dirtyRef.current, inputs);
    const body = JSON.stringify({ entity, id, expectedUpdatedAt: tokenRef.current, fields });

    setPhase("saving");
    setInFlight(true);
    const run = (async () => {
      let status = 0;
      let json: unknown = null;
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          keepalive: byteLength(body) <= KEEPALIVE_MAX_BYTES,
          body,
        });
        status = res.status;
        json = await res.json().catch(() => null);
      } catch {
        status = 0; // offline / DNS / aborted
      }
      handle(classifyAutosave(status, json), units, snapshot);
    })();

    inFlightRef.current = run;
    void run.finally(() => {
      inFlightRef.current = null;
      setInFlight(false);
      // edits that arrived while this was in flight (unless a retry is already timed)
      if (!timerRef.current && shouldContinue()) schedule(AUTOSAVE_DEBOUNCE_MS);
    });
  }, [clearTimer, formRef, handle, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** skip the debounce and any backoff: reconnect, refocus, leaving */
  const flushNow = useCallback(() => {
    attemptRef.current = 0;
    haltedRef.current = false;
    flush();
  }, [flush]);

  const markDirty = useCallback(
    (name: string) => {
      if (!name || name === "updated_at" || name === "id") return;
      dirtyRef.current = bump(dirtyRef.current, name);
      haltedRef.current = false;
      syncFlagsSoon();
      if (cfg.current.enabled && !stoppedRef.current) schedule(AUTOSAVE_DEBOUNCE_MS);
    },
    [schedule, syncFlagsSoon]
  );

  // native events: every named control in the form
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onEdit = (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!t || typeof t.name !== "string" || !t.name) return;
      if (t instanceof HTMLInputElement && t.type === "file") return;
      // A Save-only field back at its loaded value = no change pending.
      // Compared against a recorded baseline, not defaultValue (React keeps
      // that in step with a controlled input on every keystroke), and
      // synchronously: a deferred check would land after a Save that the same
      // blur triggered had already snapshotted the dirty versions.
      if (isSaveOnly(t.name) && fieldValue(form, t.name) === loadedRef.current[t.name]) {
        dirtyRef.current = revertSaveOnly(dirtyRef.current, t.name);
        syncFlagsSoon();
        return;
      }
      markDirty(t.name);
    };
    // once per mount: a re-run must not adopt half-edited values as the baseline
    for (const n of NEVER_AUTOSAVE) {
      if (!(n in loadedRef.current)) loadedRef.current[n] = fieldValue(form, n);
    }
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    return () => {
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
    };
  }, [formRef, markDirty, syncFlagsSoon]);

  // an upload finished: catch up
  useEffect(() => {
    if (!opts.paused && shouldContinue()) schedule(AUTOSAVE_DEBOUNCE_MS);
  }, [opts.paused, schedule]);

  // retry on reconnect / refocus; save on the way out
  useEffect(() => {
    const onVisibility = () => flushNow();
    const onExit = () => {
      if (!discardRef.current) flushNow();
    };
    window.addEventListener("online", flushNow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onExit);
    return () => {
      window.removeEventListener("online", flushNow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onExit);
    };
  }, [flushNow]);

  const pending = flags.dirty || inFlight;

  // the leave-page prompt — only while something is actually pending
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (discardRef.current) return;
      flushNow(); // keepalive: completes even if they leave anyway
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, flushNow]);

  // a fresh server render brought a different version (our own Save's
  // revalidation, or a restore). Adopt it only with nothing unsaved here —
  // otherwise keep ours, and the next write reports the conflict honestly.
  useEffect(() => {
    const next = opts.updatedAt ?? "";
    if (next === lastPropRef.current) return;
    lastPropRef.current = next;
    if (!next || next === tokenRef.current) return;
    if (!isDirty(dirtyRef.current) && !inFlightRef.current && !explicitRef.current) setToken(next);
  }, [opts.updatedAt, setToken]);

  useEffect(() => clearTimer, [clearTimer]);

  // Leaving the form inside the panel (a sidebar link, Back) unmounts it with
  // no pagehide — send what's pending. A LAYOUT-effect cleanup, because it runs
  // while the <form> is still attached (a passive cleanup sees a null ref).
  useLayoutEffect(
    () => () => {
      if (!discardRef.current) flushRef.current();
    },
    []
  );

  const wrapSave = useCallback(
    <R extends SaveResult>(action: (fd: FormData) => Promise<R>) =>
      async (fd: FormData): Promise<R> => {
        // the FormData was read at submit time; so are these versions
        const snapshot = snapshotDirty(dirtyRef.current);
        explicitRef.current = true;
        clearTimer();
        try {
          if (inFlightRef.current) await inFlightRef.current.catch(() => {});
          if (cfg.current.enabled) fd.set("updated_at", tokenRef.current);
          const result = await action(fd);
          if (result?.ok) {
            if (result.updatedAt) setToken(result.updatedAt);
            dirtyRef.current = settleDirty(dirtyRef.current, snapshot, Object.keys(snapshot));
            // what was just saved is the new baseline for the Save-only fields
            for (const n of NEVER_AUTOSAVE) loadedRef.current[n] = fieldValue(fd, n);
            parkedRef.current = {};
            haltedRef.current = false;
            setErrors({});
            setConflict(null);
            attemptRef.current = 0;
            setMessage(null);
            setSavedAt(new Date());
            setPhase("saved");
          } else if (result?.conflict) {
            stoppedRef.current = true;
            setConflict({ ...result.conflict, source: "save" });
            setPhase("conflict");
          } else if (result) {
            setErrors(result.fieldErrors ?? {});
          }
          return result;
        } finally {
          explicitRef.current = false;
          syncFlags();
          if (shouldContinue()) schedule(AUTOSAVE_DEBOUNCE_MS);
        }
      },
    [clearTimer, schedule, setConflict, setToken, syncFlags]
  );

  const keepMine = useCallback(() => {
    const c = conflictRef.current;
    if (!c) return;
    // an informed overwrite: expect the version we were just shown
    setToken(c.updatedAt);
    stoppedRef.current = false;
    haltedRef.current = false;
    parkedRef.current = {};
    attemptRef.current = 0;
    setConflict(null);
    setPhase("idle");
    syncFlags();
    if (c.source === "save") formRef.current?.requestSubmit();
    else flush();
  }, [flush, formRef, setConflict, setToken, syncFlags]);

  const reloadTheirs = useCallback(() => {
    discardRef.current = true;
    stoppedRef.current = true;
    window.location.reload();
  }, []);

  const mustConfirm = leaveNeedsConfirm({
    enabled,
    dirty: flags.dirty,
    needsSave: flags.needsSave,
    phase,
  });
  const confirmLeave = useCallback(() => {
    if (!mustConfirm) return true; // pending autosavable edits go out on unmount
    if (!window.confirm("Discard your unsaved changes?")) return false;
    discardRef.current = true; // they said discard — don't send them on the way out
    return true;
  }, [mustConfirm]);

  const fieldError = useCallback((name: string) => errors[name], [errors]);

  return {
    enabled,
    phase,
    status: autosaveLabel({
      enabled,
      phase,
      message,
      savedAt,
      waiting: flags.waiting,
      needsSave: flags.needsSave,
      dirty: flags.dirty,
    }),
    pending,
    conflict,
    fieldError,
    markDirty,
    keepMine,
    reloadTheirs,
    confirmLeave,
    tokenInputProps: { type: "hidden", name: "updated_at", value: token },
    wrapSave,
  };
}

/** A field's submitted value(s) — the same view of it the Save action gets. */
function fieldValue(source: HTMLFormElement | FormData, name: string): string {
  const fd = source instanceof FormData ? source : new FormData(source);
  return fd
    .getAll(name)
    .map((v) => (typeof v === "string" ? v : ""))
    .join("\u0000");
}
