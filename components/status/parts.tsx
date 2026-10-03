import type { ReactNode } from "react";
import type { Health } from "@/lib/status-schema";

/**
 * /status primitives — server components, static SVG, no motion. Every mark
 * here is drawn with theme tokens (stroke-ink / stroke-mist), so dark mode
 * needs nothing, and every graphic is aria-hidden next to a text equivalent:
 * the rings and the bezel are decoration, the numbers and words are the data.
 */

// ── overall health mark ──────────────────────────────────────────────────────

const C = 80; // centre of the 160×160 mark

/** Bezel ticks: 60 minor, every 5th major — an instrument face, drawn once. */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const major = i % 5 === 0;
  const r1 = major ? 68 : 71;
  const r2 = 75;
  const p = (r: number) => [C + r * Math.sin(a), C - r * Math.cos(a)].map((n) => n.toFixed(2));
  const [x1, y1] = p(r1);
  const [x2, y2] = p(r2);
  return { x1, y1, x2, y2, major };
});

const GLYPH: Record<Health, string> = {
  passing: "M62 81 L74 93 L99 66", // check
  failing: "M66 66 L94 94 M94 66 L66 94", // cross
  stale: "M80 80 V60 M80 80 L94 89", // clock hands
  unknown: "M64 80 H96", // dash
};

/**
 * The page's single use of the accent gradient: the ring, and only while the
 * suite is passing. Failing = solid ink ring; stale = dashed; unknown = dotted
 * mist. Shape + glyph + the caption carry the state, never colour alone.
 */
export function HealthMark({
  health,
  label,
  verdict,
}: {
  health: Health;
  label: string;
  verdict: string;
}) {
  const ring =
    health === "passing"
      ? { stroke: "url(#status-health-accent)", strokeWidth: 5 }
      : health === "failing"
        ? { className: "stroke-ink", strokeWidth: 5 }
        : health === "stale"
          ? { className: "stroke-slatey", strokeWidth: 2.5, strokeDasharray: "7 6" }
          : { className: "stroke-mist", strokeWidth: 2.5, strokeDasharray: "1.5 6", strokeLinecap: "round" as const };

  return (
    <div className="flex items-center gap-6 md:flex-col md:items-end md:gap-5 md:text-right">
      <svg
        viewBox="0 0 160 160"
        className="h-28 w-28 shrink-0 md:h-40 md:w-40"
        aria-hidden
        focusable="false"
      >
        {health === "passing" && (
          <defs>
            <linearGradient id="status-health-accent" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--color-accent-from)" }} />
              <stop offset="0.45" style={{ stopColor: "var(--color-accent-mid)" }} />
              <stop offset="1" style={{ stopColor: "var(--color-accent-to)" }} />
            </linearGradient>
          </defs>
        )}
        <g className="stroke-mist" strokeWidth="1">
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={t.major ? "stroke-slatey" : undefined}
            />
          ))}
        </g>
        <circle cx={C} cy={C} r="58" fill="none" {...ring} />
        <path
          d={GLYPH[health]}
          fill="none"
          className="stroke-ink"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p>
        <span className="block font-mono text-xs uppercase tracking-[0.2em] text-slatey">{label}</span>
        <span className="mt-2 block text-balance font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {verdict}
        </span>
      </p>
    </div>
  );
}

// ── score gauge ──────────────────────────────────────────────────────────────

const R = 26;
const CIRC = 2 * Math.PI * R;

/** Lighthouse's band edges (50 = "needs improvement", 90 = "good"), as bezel ticks. */
const BAND_TICKS = [0.5, 0.9].map((f) => {
  const a = f * Math.PI * 2; // the ring starts at 12 o'clock, clockwise
  const p = (r: number) => [32 + r * Math.sin(a), 32 - r * Math.cos(a)].map((n) => n.toFixed(2));
  const [x1, y1] = p(R - 4.5);
  const [x2, y2] = p(R + 4.5);
  return { x1, y1, x2, y2 };
});

/**
 * One Lighthouse category: a ring whose arc is exactly score/100 of the
 * circumference — `butt` caps, because round caps would add length the score
 * didn't earn — the integer in the middle, and the label underneath. The
 * arc passing the 90 tick is the "good" signal, in shape rather than colour.
 */
export function ScoreGauge({
  score,
  label,
  srText,
}: {
  score: number | null;
  label: string;
  /** full sentence for screen readers, e.g. "Performance: 87 out of 100" */
  srText: string;
}) {
  return (
    <li className="flex min-w-0 flex-col items-center gap-2">
      <span className="relative block h-14 w-14 sm:h-16 sm:w-16" aria-hidden>
        <svg viewBox="0 0 64 64" className="h-full w-full" focusable="false">
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            className="stroke-mist"
            strokeWidth="2"
            strokeDasharray={score === null ? "2 4" : undefined}
          />
          {score !== null && score > 0 && (
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              className="stroke-ink"
              strokeWidth="3"
              strokeLinecap="butt"
              strokeDasharray={`${((score / 100) * CIRC).toFixed(3)} ${CIRC.toFixed(3)}`}
              transform="rotate(-90 32 32)"
            />
          )}
          {BAND_TICKS.map((t, i) => (
            <line key={i} {...t} className="stroke-slatey" strokeWidth="1" />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-base font-semibold tabular-nums tracking-tight sm:text-lg">
          {score ?? "—"}
        </span>
      </span>
      <span
        aria-hidden
        // tight tracking at every size: "ACCESSIBILITY" is the longest label,
        // and at 0.12em it overflowed the 5.5rem column and broke mid-word
        // ("ACCESSIBILIT / Y"). 13 mono chars at 10px + 0.06em ≈ 86px — fits.
        className="max-w-full text-center font-mono text-[9px] uppercase leading-tight tracking-[0.04em] text-slatey [overflow-wrap:anywhere] sm:max-w-[5.5rem] sm:text-[10px] sm:tracking-[0.06em]"
      >
        {label}
      </span>
      <span className="sr-only">{srText}</span>
    </li>
  );
}

// ── small chrome ─────────────────────────────────────────────────────────────

const CHECK = "M3.5 8.5 L6.5 11.5 L12.5 4.5";
const CROSS = "M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5";

/** Pass/fail pill: glyph + word, and failing is inverted — never hue alone. */
export function VerdictChip({ passing, children }: { passing: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.16em] ${
        passing ? "border-mist text-ink" : "border-ink bg-ink text-paper"
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden focusable="false">
        <path
          d={passing ? CHECK : CROSS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}

/** "Stale — last reported 9 days ago": dashed, because it's about absence. */
export function StaleBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-slatey px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-ink/80">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden focusable="false">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5 V8 L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {children}
    </span>
  );
}

/** Panel heading: mono index + display title. */
export function PanelTitle({ id, index, children }: { id: string; index: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-baseline gap-4 font-display text-2xl font-semibold tracking-tight md:text-3xl">
      <span aria-hidden className="font-mono text-xs font-normal tracking-[0.2em] text-slatey">
        {index}
      </span>
      {children}
    </h2>
  );
}

/** The provenance line under each panel: when, which commit, which run. */
export function MetaList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2.5">
          <dt className="uppercase tracking-[0.16em] text-slatey">{it.label}</dt>
          <dd className="text-ink/80">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** External link in the meta line (GitHub commit / run). */
export function OutLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-baseline gap-1 underline decoration-mist underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
      <span aria-hidden className="text-slatey">
        ↗
      </span>
    </a>
  );
}
