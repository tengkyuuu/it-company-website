"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "./ui";

/**
 * Screenshot picker. Uploads straight from the browser to the Supabase "work"
 * storage bucket — not through a server action, whose request body is capped at
 * ~1MB by default and would reject most screenshots. The resulting public URL is
 * what lands in the hidden input the form submits.
 *
 * Reminder for whoever adds captures later: the site shows these contained at
 * their native aspect and never upscales them, so a wide capture (≥1536px) stays
 * crisp while a small one will just look small — capture big. The preview here
 * reports the real pixel width and warns below that.
 *
 * Replaced / removed uploads are deleted from Storage by the server when the
 * project is saved (only once nothing references them), not here — deleting on
 * "Remove" would break the live site if the form were then abandoned.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/avif": "avif",
};
const ACCEPT = Object.keys(EXT);
const CRISP_WIDTH = 1536;

/** crypto.randomUUID only exists in secure contexts (https / localhost). */
function shortId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

/** Storage errors are terse and technical — translate the ones people hit. */
function describeUploadError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/bucket not found/i.test(msg)) {
    return "The “work” storage bucket doesn't exist — run supabase/schema.sql, which creates it.";
  }
  if (/row-level security|unauthorized|not authorized|403/i.test(msg)) {
    return "Storage refused the upload for your account — ask an owner or admin to check your access, and that supabase/schema.sql has been run (it adds the upload policy).";
  }
  if (/payload too large|exceeded the maximum|413/i.test(msg)) {
    return "The storage bucket rejected the file as too large — try a WebP export.";
  }
  if (/fetch|network/i.test(msg)) return "Upload failed — check your connection and try again.";
  return msg ? `Upload failed: ${msg}` : "Upload failed — try again.";
}

const validPath = (v: string) => v === "" || /^\/(?!\/)\S*$/.test(v) || /^https?:\/\/\S+$/i.test(v);

export default function ImageField({
  name,
  label,
  hint,
  defaultValue,
  error: serverError,
  onBusyChange,
  onValueChange,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  /** server-side validation message for this field */
  error?: string;
  onBusyChange?: (busy: boolean) => void;
  /** fires on every user-driven change (the form uses it for its dirty flag) */
  onValueChange?: (value: string) => void;
}) {
  const initial = defaultValue ?? "";
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // keyed by src, so a stale measurement can never be shown for a new image
  const [measured, setMeasured] = useState<{ src: string; w: number; h: number } | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  // a server error describes the value that was submitted; hide it once edited
  const [dismissed, setDismissed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const pathId = `${id}-path`;
  const msgId = `${id}-msg`;

  // report upload state so the form can hold its submit until the URL exists
  const busyRef = useRef(onBusyChange);
  useEffect(() => {
    busyRef.current = onBusyChange;
  });
  useEffect(() => {
    busyRef.current?.(busy);
  }, [busy]);

  useEffect(() => {
    setDismissed(false);
  }, [serverError]);

  const change = (next: string) => {
    setValue(next);
    setError(null);
    setDismissed(true);
    onValueChange?.(next);
  };

  async function upload(file: File) {
    setError(null);

    const ext = EXT[file.type];
    if (!ext) {
      setError("Use a WebP, PNG, JPEG or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 8MB.`);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const safe = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      // the random suffix keeps re-uploads of the same filename from colliding;
      // the extension comes from the MIME type, not the (possibly missing) name
      const path = `${safe || "shot"}-${shortId()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("work")
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("work").getPublicUrl(path);
      change(data.publicUrl);
    } catch (e) {
      setError(describeUploadError(e));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const size = measured?.src === value ? measured : null;
  const broken = brokenSrc === value;
  const pathInvalid = !validPath(value.trim());
  const shownError =
    error ??
    (pathInvalid ? "Use a /path or a full https:// URL." : null) ??
    (dismissed ? undefined : serverError);
  const small = size && size.w < CRISP_WIDTH;

  return (
    <div>
      <Label htmlFor={pathId}>{label}</Label>

      <div
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void upload(f);
        }}
        className={`relative mb-3 overflow-hidden rounded-xl border bg-paper transition-colors ${
          dragging ? "border-accent-to ring-2 ring-accent-to/25" : value ? "border-mist/70" : "border-dashed border-mist"
        }`}
      >
        <div className="relative flex aspect-[1536/743] items-center justify-center">
          {value && !broken ? (
            // a plain img: uploads live on the Supabase host, which next/image
            // would need allow-listed, and `contain` shows the true framing
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${label} preview`}
              onLoad={(e) =>
                setMeasured({
                  src: value,
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onError={() => setBrokenSrc(value)}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <p className="px-4 text-center text-xs text-ink/45">
              {value
                ? "Couldn't load this image — check the path or URL."
                : "No image yet — upload, drop a file here, or paste a path"}
            </p>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/70 backdrop-blur-sm">
              <span
                aria-hidden
                className="h-5 w-5 animate-spin rounded-full border-2 border-ink/60 border-t-transparent"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex items-center gap-2 rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent-to/40 ${
            busy ? "cursor-wait opacity-70" : "cursor-pointer hover:border-mist"
          }`}
        >
          {busy ? (
            <>
              <span
                aria-hidden
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              Uploading…
            </>
          ) : value ? (
            "Replace image"
          ) : (
            "Upload image"
          )}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT.join(",")}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>

        {value && !busy && (
          <button
            type="button"
            onClick={() => change("")}
            className="rounded-full border border-mist/70 px-4 py-2 text-sm text-ink/70 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            Remove
          </button>
        )}

        {value !== initial && !busy && (
          <button
            type="button"
            onClick={() => change(initial)}
            className="rounded-full px-3 py-2 text-sm text-ink/55 transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            Undo
          </button>
        )}

        {size && (
          <span
            className={`ml-auto font-mono text-[11px] ${
              small ? "text-amber-700 dark:text-amber-300" : "text-slatey"
            }`}
          >
            {size.w}×{size.h}px
          </span>
        )}
      </div>

      <Input
        id={pathId}
        type="text"
        className="mt-3"
        value={value}
        onChange={(e) => change(e.target.value)}
        placeholder="/work/example.webp or https://…"
        spellCheck={false}
        maxLength={500}
        aria-invalid={Boolean(shownError) || undefined}
        aria-describedby={msgId}
      />
      {/* the value the form actually submits */}
      <input type="hidden" name={name} value={value.trim()} />

      <div id={msgId} aria-live="polite">
        {shownError ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{shownError}</p>
        ) : small ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Only {size.w}px wide — the site never upscales, so this will look small. Capture at
            {` ${CRISP_WIDTH}px`} or wider if you can.
          </p>
        ) : hint ? (
          <p className="mt-2 text-xs leading-relaxed text-ink/45">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
