"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { HeroShot } from "@/lib/hero-shots";

/**
 * The curved reel — ported from 21st.dev "Tilted Grid Hero" (ruixen.ui; the
 * untouched source is in docs/reference/). One row of tiles streams right→left
 * round the inside of a cylinder: flat at the centre, bending toward the viewer
 * at the ends, fading out at both edges. Pure CSS 3D, no WebGL — each tile is
 * cut into SLICES strips (flat facets of the arc) and one `rotateY` keyframe per
 * tile carries it along. The only JS: a ResizeObserver that sizes the loop and a
 * handler that gives a tile its next image as it wraps off-screen.
 *
 * Changes from the reference, for this site:
 *  - tiles are browser-framed screenshots at their native aspect (a chrome bar
 *    baked into every strip, so it bends with the image) — never cropped
 *  - `active` plays/pauses (hero on screen AND opening sequence done); paused it
 *    is a finished still, which is also the reduced-motion state
 *  - images are fetched only once first active (the opening sequence owns the
 *    first ~2s of bandwidth)
 *  - no `cn`/shadcn dependency
 */

const SLICES = 16;
const CAMERA = 1.6;
const MAX_WIDTH = 55;
/** the chrome bar, as a share of the tile's height */
const BAR = 0.07;
/** how far each strip overhangs its neighbours, as a share of a strip's width */
const OVERLAP = 0.12;

function arc(bend: number) {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

function measure(
  width: number,
  height: number,
  tile: number,
  aspect: number,
  gap: number,
  bend: number
) {
  const h = Math.min((tile / 100) * height, ((MAX_WIDTH / 100) * width) / aspect);
  const radius = width * arc(bend);
  if (!(h > 0) || !(radius > 0)) return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const deg = (rad: number) => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
  const round = (n: number) => +n.toFixed(4);
  const sweep = round((columns * pitch) / 2);
  return { columns, sweep, unit: round(unit), limit: round(Math.min(sweep, limit)) };
}

export default function CurvedReel({
  shots,
  active,
  /** the screenshots are 1536×743 = 2.067; minus the bar, the tile is 1.93 */
  aspectRatio = 2.067 / (1 + BAR),
  speed = 4.5,
  tileHeight = 25,
  gap = 5,
  axis = 60,
  curve = 45,
  fade = 12,
  className = "",
}: {
  shots: HeroShot[];
  active: boolean;
  aspectRatio?: number;
  speed?: number;
  tileHeight?: number;
  gap?: number;
  axis?: number;
  curve?: number;
  fade?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `rr-o-${id}`;
  const tile = `rr-t-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;

  const [layout, setLayout] = useState<ReturnType<typeof measure> | null>(null);
  const [shown, setShown] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = measure(width, height, tileHeight, aspectRatio, gap, bend);
      setLayout((prev) =>
        prev?.columns === next.columns && prev.sweep === next.sweep && prev.unit === next.unit
          ? prev
          : next
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tileHeight, aspectRatio, gap, bend]);

  // first activation = the splash is done: now spend the bytes
  useEffect(() => {
    if (!active || loaded) return;
    let left = shots.length;
    if (!left) return;
    const done = () => {
      if (--left <= 0) setLoaded(true);
    };
    for (const { src } of shots) {
      const im = new Image();
      im.onload = im.onerror = done;
      im.src = src;
    }
  }, [active, loaded, shots]);

  const { columns, sweep, unit, limit } =
    layout ?? measure(1200, 700, tileHeight, aspectRatio, gap, bend);

  const u = (n: number) =>
    `calc(${+n.toFixed(4)} * min(${tileHeight}cqh, ${+(MAX_WIDTH / aspectRatio).toFixed(4)}cqw))`;

  const r = 100 * arc(bend);
  const radius = `${+r.toFixed(3)}cqw`;
  const turn = (d: number) =>
    `translateZ(${radius}) rotateY(${+d.toFixed(4)}deg) translateZ(-${radius})`;

  const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
  const css =
    `@keyframes ${orbit}{` +
    `from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
    `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}` +
    `${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}` +
    `@media(prefers-reduced-motion:reduce){.${tile}{animation-play-state:paused!important}}`;

  const share = aspectRatio / SLICES;
  const duration = columns * speed;
  const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${100 - fade}%,transparent)`;
  const count = Math.max(shots.length, 1);
  const playing = active && loaded;

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none overflow-hidden ${className || "relative"}`}
      style={{ containerType: "size" }}
    >
      <style>{css}</style>
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: layout && loaded ? 1 : 0,
          perspective: `${+(r * CAMERA).toFixed(3)}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {Array.from({ length: columns }, (_, t) => {
          const first = columns - 1 - t;
          const img = shots[(shown[t] ?? first) % count];
          return (
            <div
              key={t}
              className={`${tile} absolute`}
              style={{
                left: `calc(50% - ${u(aspectRatio / 2)})`,
                top: `calc(${axis}% - ${u(0.5)})`,
                width: u(aspectRatio),
                height: u(1),
                transformStyle: "preserve-3d",
                animation: `${orbit} ${duration}s linear ${-t * speed}s infinite`,
                animationPlayState: playing ? "running" : "paused",
              }}
              onAnimationIteration={(e) => {
                const lap = Math.round(e.elapsedTime / duration);
                setShown((prev) => {
                  const next = lap * columns + first;
                  return prev[t] === next ? prev : { ...prev, [t]: next };
                });
              }}
            >
              {Array.from({ length: SLICES }, (_, k) => {
                // Each strip overhangs its neighbours a little. Adjacent facets of
                // the arc only meet along a hairline, and the compositor leaves a
                // crack there at some angles (the page showed through as a dark
                // line on the right of the reel). The overhang lies outside the
                // arc, i.e. behind the neighbouring facet, so it only ever fills
                // a crack. The outer edges of the tile don't overhang.
                const l = k === 0 ? 0 : OVERLAP * share;
                const r = k === SLICES - 1 ? 0 : OVERLAP * share;
                return (
                <div
                  key={k}
                  className={`absolute top-0 overflow-hidden bg-[#1c1917] ${
                    k === 0 ? "rounded-l-lg" : ""
                  } ${k === SLICES - 1 ? "rounded-r-lg" : ""}`}
                  style={{
                    left: u((aspectRatio - share) / 2 - l),
                    width: u(share + l + r),
                    height: u(1),
                    // rotate about the facet's own centre, not the widened box's
                    transformOrigin: `${u(l + share / 2)} 50%`,
                    transform: turn((aspectRatio / 2 - (k + 0.5) * share) * unit),
                  }}
                >
                  {/* the whole tile, offset so this strip shows its share */}
                  <div
                    className="absolute top-0"
                    style={{ left: u(l - k * share), width: u(aspectRatio), height: u(1) }}
                  >
                    {/* chrome bar: three dots + an address pill */}
                    <div
                      className="absolute inset-x-0 top-0 flex items-center bg-[#1c1917]"
                      style={{ height: u(BAR), paddingLeft: u(0.035), gap: u(0.017) }}
                    >
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="rounded-full bg-[#57534e]"
                          style={{ width: u(0.022), height: u(0.022) }}
                        />
                      ))}
                      <span
                        className="rounded-full bg-[#292524]"
                        style={{ marginLeft: u(0.03), width: u(0.55), height: u(0.032) }}
                      />
                    </div>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.src}
                        alt=""
                        draggable={false}
                        className="absolute max-w-none"
                        style={{
                          left: 0,
                          top: u(BAR),
                          width: u(aspectRatio),
                          height: u(1 - BAR),
                        }}
                      />
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
