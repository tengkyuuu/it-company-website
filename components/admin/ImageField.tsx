"use client";

import Image from "next/image";
import { useRef, useState } from "react";
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
 * crisp while a small one will just look small — capture big.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ["image/webp", "image/png", "image/jpeg", "image/avif"];

export default function ImageField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);

    if (!ACCEPT.includes(file.type)) {
      setError("Use a WebP, PNG, JPEG or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — max 8MB.`);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
      const safe = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      // crypto.randomUUID keeps re-uploads of the same filename from colliding
      const path = `${safe || "shot"}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("work")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("work").getPublicUrl(path);
      setValue(data.publicUrl);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed — check that the 'work' bucket exists."
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <Label>{label}</Label>

      {value ? (
        <div className="relative mb-3 overflow-hidden rounded-xl border border-mist/70 bg-paper">
          <div className="relative aspect-[1536/743]">
            {/* next/image needs the Supabase host allow-listed; a plain img
                sidesteps that for arbitrary user-supplied URLs */}
            {value.startsWith("/") ? (
              <Image
                src={value}
                alt=""
                fill
                sizes="400px"
                className="object-cover object-top"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-2 top-2 rounded-full border border-white/25 bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mb-3 flex aspect-[1536/743] items-center justify-center rounded-xl border border-dashed border-mist bg-paper">
          <p className="px-4 text-center text-xs text-ink/40">
            No image yet — upload one or paste a path
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist">
          {busy ? (
            <>
              <span
                aria-hidden
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              Uploading…
            </>
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
      </div>

      <Input
        type="text"
        className="mt-3"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="/work/example.webp or https://…"
        aria-label={`${label} path`}
      />
      {/* the value the form actually submits */}
      <input type="hidden" name={name} value={value} />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {hint && !error && (
        <p className="mt-2 text-xs leading-relaxed text-ink/45">{hint}</p>
      )}
    </div>
  );
}
