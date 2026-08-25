"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/work";

/**
 * A project preview inside browser chrome.
 *
 * The screenshot is the poster and is always painted first — it's instant and
 * always correct. When the project has a `liveUrl` we additionally mount a real
 * iframe, but only once the frame scrolls into view, and we render it at desktop
 * width (VIEWPORT px) then CSS-scale it down, so the embed shows the site's
 * desktop layout rather than its mobile breakpoint.
 *
 * Two things make embeds behave in practice:
 *  - pointer events are OFF until the visitor explicitly clicks Interact, so the
 *    iframe can't swallow the page scroll;
 *  - a site that refuses framing (X-Frame-Options / CSP frame-ancestors) can't
 *    be detected cross-origin, so the poster is never removed on a timeout —
 *    it simply stays, and "Open live site" is always available.
 */
const VIEWPORT = 1440;
const LOAD_TIMEOUT = 9000;

export default function LivePreview({
  project,
  className = "",
  priority = false,
}: {
  project: Project;
  className?: string;
  priority?: boolean;
}) {
  const { liveUrl, url, img, name, dots } = project;
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // mount the iframe only when the frame is actually on screen
  useEffect(() => {
    if (!liveUrl || !box.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [liveUrl]);

  // track the frame's pixel box so we can scale the desktop render into it
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || loaded) return;
    const t = window.setTimeout(() => setSlow(true), LOAD_TIMEOUT);
    return () => window.clearTimeout(t);
  }, [inView, loaded]);

  const scale = size.w ? size.w / VIEWPORT : 0;

  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.65)] ${className}`}
    >
      {/* browser chrome */}
      <figcaption className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3.5 py-2.5">
        <span className="flex items-center gap-1.5" aria-hidden>
          {dots.map((c, i) => (
            <span
              key={i}
              style={{ background: c }}
              className="h-2 w-2 rounded-full ring-1 ring-white/20"
            />
          ))}
        </span>
        <span className="ml-1.5 truncate font-mono text-[11px] tracking-wider text-paper/45">
          {url}
        </span>

        <span className="ml-auto flex items-center gap-2">
          {liveUrl ? (
            <>
              <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45 sm:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-to opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-to" />
                </span>
                Live
              </span>
              <button
                type="button"
                onClick={() => setInteractive((v) => !v)}
                aria-pressed={interactive}
                className="rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/60 transition-colors hover:border-white/45 hover:text-paper"
              >
                {interactive ? "Done" : "Interact"}
              </button>
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/60 transition-colors hover:border-white/45 hover:text-paper"
              >
                Open ↗
              </a>
            </>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/35">
              Screenshot
            </span>
          )}
        </span>
      </figcaption>

      {/* the preview itself — native screenshot aspect, never upscaled */}
      <div ref={box} className="relative aspect-[1536/743] w-full overflow-hidden">
        {liveUrl && inView && scale > 0 && (
          <iframe
            src={liveUrl}
            title={`${name} — live preview`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setLoaded(true)}
            style={{
              width: VIEWPORT,
              height: size.h / scale,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: interactive ? "auto" : "none",
            }}
            className="absolute left-0 top-0 border-0 bg-white"
          />
        )}

        {/* poster: stays put unless the live frame actually reported a load */}
        <Image
          src={img}
          alt={`${name} — ${project.category}`}
          fill
          quality={90}
          priority={priority}
          sizes="(max-width: 768px) 100vw, 70vw"
          className={`object-cover object-top transition-opacity duration-700 ${
            liveUrl && loaded ? "opacity-0" : "opacity-100"
          }`}
        />

        {liveUrl && inView && !loaded && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-ink-900 to-transparent px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/60">
            {slow ? (
              <>This site may block embedding — use “Open ↗”</>
            ) : (
              <>Loading live site…</>
            )}
          </span>
        )}

        {/* click-to-interact catcher: keeps scroll on the page until asked */}
        {liveUrl && !interactive && (
          <button
            type="button"
            onClick={() => setInteractive(true)}
            aria-label={`Interact with the live ${name} preview`}
            className="absolute inset-0 z-10 cursor-pointer"
          />
        )}
      </div>
    </figure>
  );
}
