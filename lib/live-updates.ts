/**
 * Live updates — the decision logic, with no React, DOM or Supabase in it (the
 * wiring is components/LiveUpdates.tsx). Everything effectful comes in through
 * `LiveDeps`, so tests/live-updates.test.ts drives it with fake timers.
 *
 * The signal is `site_revision.rev` (supabase/schema.sql): one counter that a
 * statement-level trigger bumps on every content change. The controller
 *   - remembers the first rev it sees (the baseline) — no refresh for that;
 *   - when a later read is HIGHER, owes the page a refresh, debounced (an admin
 *     save or a reorder can bump several times in a row) with a max wait so a
 *     steady stream can't postpone it forever;
 *   - polls every 30 s while running (= tab visible), backing off 30 → 60 →
 *     120 → 240 → 300 s on consecutive failures, back to 30 s on success;
 *   - runs NO timers while paused (= tab hidden); a refresh that came due while
 *     hidden is delivered on resume;
 *   - coalesces Realtime pings and never has two reads in flight (a ping during
 *     a read schedules exactly one re-read, since that read may predate it).
 *
 * NEUTRAL MODULE (no "use client").
 */

export const POLL_MS = 30_000;
export const MAX_POLL_MS = 5 * 60_000;
/** trailing debounce between "rev went up" and router.refresh() */
export const REFRESH_DEBOUNCE_MS = 2_000;
/** …but never later than this after the first bump of a burst */
export const REFRESH_MAX_WAIT_MS = 8_000;
/** Realtime pings closer together than this become one read */
export const PING_COALESCE_MS = 750;
/** focus + visibilitychange both fire on return to the tab — one read is enough */
export const MIN_CHECK_GAP_MS = 2_000;
/** per poll request (the component passes it to AbortSignal.timeout) */
export const FETCH_TIMEOUT_MS = 5_000;

/**
 * The rev out of PostgREST's `[{ "rev": 12 }]` (bigint can arrive as a string).
 * Anything else — an error body, an empty array, a non-integer — is null.
 */
export function parseRev(body: unknown): number | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return null;
  const raw = (row as { rev?: unknown }).rev;
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Delay before the next poll after `failures` consecutive failed reads. */
export function pollDelay(failures: number): number {
  const f = Math.max(0, Math.floor(failures));
  return Math.min(MAX_POLL_MS, POLL_MS * 2 ** Math.min(f, 10));
}

/**
 * Fold one observed rev into the baseline. `changed` = the page is stale.
 * Only an INCREASE counts; a decrease (a restored or re-created table) just
 * re-baselines, so the next real edit is still detected.
 */
export function observe(baseline: number | null, rev: number): { baseline: number; changed: boolean } {
  if (baseline === null) return { baseline: rev, changed: false };
  return { baseline: rev, changed: rev > baseline };
}

export type Timers = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

export type LiveDeps = {
  /** one read of site_revision.rev; null (or a rejection) = failed */
  fetchRev: () => Promise<number | null>;
  /** what a stale page gets — router.refresh() */
  refresh: () => void;
  now?: () => number;
  timers?: Timers;
};

export type LiveController = {
  /** tab visible: read now (throttled) and poll; delivers a refresh owed while hidden */
  resume(): void;
  /** tab hidden: clear every timer */
  pause(): void;
  /** focus / return to the tab: read now unless one just happened */
  check(): Promise<void>;
  /** Realtime said "something changed": coalesce, then read */
  ping(): void;
  dispose(): void;
  /** introspection, for tests */
  snapshot(): { baseline: number | null; failures: number; running: boolean; owed: boolean };
};

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function createLiveController(deps: LiveDeps): LiveController {
  const now = deps.now ?? (() => Date.now());
  const timers = deps.timers ?? defaultTimers;

  let baseline: number | null = null;
  let failures = 0;
  let running = false;
  let disposed = false;
  let owed = false; // a refresh is due (debouncing, or deferred while hidden)
  let burstStart = 0;
  let lastCheck = Number.NEGATIVE_INFINITY;
  let inflight: Promise<void> | null = null;
  let again = false;

  let pollTimer: unknown = null;
  let refreshTimer: unknown = null;
  let pingTimer: unknown = null;

  const stop = (h: unknown) => {
    if (h !== null) timers.clear(h);
    return null;
  };

  function fireRefresh() {
    refreshTimer = null;
    if (disposed || !running) return;
    owed = false;
    deps.refresh();
  }

  function armRefresh() {
    refreshTimer = stop(refreshTimer);
    const left = REFRESH_MAX_WAIT_MS - (now() - burstStart);
    refreshTimer = timers.set(fireRefresh, Math.max(0, Math.min(REFRESH_DEBOUNCE_MS, left)));
  }

  function stale() {
    if (!owed) {
      owed = true;
      burstStart = now();
    }
    if (running) armRefresh(); // hidden → resume() delivers it
  }

  function read(): Promise<void> {
    lastCheck = now();
    const p = Promise.resolve()
      .then(deps.fetchRev)
      .catch(() => null)
      .then((rev) => {
        if (disposed) return;
        if (rev === null) {
          failures += 1;
          return;
        }
        failures = 0;
        const o = observe(baseline, rev);
        baseline = o.baseline;
        if (o.changed) stale();
      })
      .finally(() => {
        inflight = null;
        const followUp = again && running && !disposed; // hidden → resume() reads anyway
        again = false;
        if (followUp) void run(true);
      });
    inflight = p;
    return p;
  }

  /** `force` skips the min-gap throttle (polls, pings); never two reads at once. */
  function run(force: boolean): Promise<void> {
    if (disposed) return Promise.resolve();
    if (inflight) {
      if (force) again = true;
      return inflight;
    }
    if (!force && now() - lastCheck < MIN_CHECK_GAP_MS) return Promise.resolve();
    return read();
  }

  function schedulePoll() {
    pollTimer = stop(pollTimer);
    if (!running || disposed) return;
    pollTimer = timers.set(() => {
      pollTimer = null;
      void run(true).then(schedulePoll);
    }, pollDelay(failures));
  }

  return {
    resume() {
      if (disposed || running) return;
      running = true;
      if (owed) armRefresh();
      void run(false).then(schedulePoll);
    },
    pause() {
      running = false;
      pollTimer = stop(pollTimer);
      pingTimer = stop(pingTimer);
      refreshTimer = stop(refreshTimer); // `owed` survives → re-armed on resume
    },
    check() {
      return run(false);
    },
    ping() {
      if (disposed || !running || pingTimer !== null) return; // hidden: resume() reads anyway
      pingTimer = timers.set(() => {
        pingTimer = null;
        void run(true);
      }, PING_COALESCE_MS);
    },
    dispose() {
      disposed = true;
      running = false;
      pollTimer = stop(pollTimer);
      pingTimer = stop(pingTimer);
      refreshTimer = stop(refreshTimer);
    },
    snapshot() {
      return { baseline, failures, running, owed };
    },
  };
}
