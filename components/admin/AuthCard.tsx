import Link from "next/link";
import Logo from "@/components/Logo";
import LocalTime from "@/components/fx/LocalTime";

/**
 * The frame for the panel's signed-out moments: sign in, an invite or reset
 * link landing, choosing a password, the "no access" screen.
 *
 * Desktop: a split — an ink `.band` on the left where the wordmark inks in
 * under a sweep of gold light (the opening sequence's choreography, `.ai-*`
 * in globals.css) with a few four-point sparks, and the form on the paper
 * side. Phones: the same ink-in on the logo above the form, no band.
 *
 * Every animation is CSS (it starts at first paint, before hydration),
 * animates only transform/opacity, plays ONCE and rests — nothing loops while
 * the visitor reads — and reduced motion turns it all off. Content is never
 * hidden without CSS animations: the `both` fill only applies while they run.
 */
export default function AuthCard({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  let step = 0;
  const d = () => ({ "--d": `${0.15 + 0.08 * step++}s` }) as React.CSSProperties;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Stage />

      <div className="flex items-center justify-center px-6 py-16 lg:px-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-block lg:hidden" aria-label="MykTech() — back to the site">
            <InkMark className="w-56" />
          </Link>

          {eyebrow && (
            <p
              className="ai-rise mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-accent lg:mt-0"
              style={d()}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={`ai-rise ${eyebrow ? "mt-4" : "mt-10 lg:mt-0"} text-balance font-display text-[2rem] font-medium leading-[1.08] tracking-[-0.035em]`}
            style={d()}
          >
            {title}
          </h1>
          <span aria-hidden className="ai-rule mt-5 block h-0.5 w-14 bg-gold" style={d()} />
          {intro && (
            <div className="ai-rise mt-5 text-sm leading-relaxed text-ink/60" style={d()}>
              {intro}
            </div>
          )}

          {children && (
            <div
              className="ai-rise mt-8 rounded-2xl border border-mist bg-surface p-6 shadow-[0_1px_0_var(--color-mist),0_24px_48px_-32px_rgb(12_10_9/0.25)]"
              style={d()}
            >
              {children}
            </div>
          )}

          <div className="ai-rise" style={d()}>
            {footer ?? (
              <Link
                href="/"
                className="group mt-8 inline-flex items-center gap-2 text-sm text-ink/50 transition-colors hover:text-ink"
              >
                <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
                  ←
                </span>
                Back to the site
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The wordmark inking in: faint mark, a gold band of light sweeps it in, the spark resolves. */
function InkMark({ className = "" }: { className?: string }) {
  return (
    <span className={`ai-mark ${className}`}>
      <Logo className="ai-faint w-full" />
      <span className="ai-ink">
        <span>
          <Logo className="w-full" />
        </span>
      </span>
      <span className="ai-ray" aria-hidden>
        <span />
      </span>
      <span className="ai-final">
        <Logo accent className="w-full" />
      </span>
    </span>
  );
}

const SPARKS = [
  { left: "14%", top: "22%", size: 18, delay: 1.25 },
  { left: "78%", top: "16%", size: 12, delay: 1.45 },
  { left: "70%", top: "71%", size: 22, delay: 1.6 },
  { left: "22%", top: "80%", size: 10, delay: 1.8 },
];

function Spark({ size, style }: { size: number; style: React.CSSProperties }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="ai-spark absolute text-gold"
      style={style}
    >
      <path
        fill="currentColor"
        d="M12 0C12.9 6.6 17.4 11.1 24 12 17.4 12.9 12.9 17.4 12 24 11.1 17.4 6.6 12.9 0 12 6.6 11.1 11.1 6.6 12 0Z"
      />
    </svg>
  );
}

function Stage() {
  return (
    <aside className="band relative hidden overflow-hidden bg-ink text-paper grain lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {SPARKS.map((s) => (
        <Spark
          key={s.left}
          size={s.size}
          style={{ left: s.left, top: s.top, animationDelay: `${s.delay}s` }}
        />
      ))}

      <p className="ai-rise relative font-mono text-[11px] uppercase tracking-[0.22em] text-paper/50" style={{ "--d": "0.1s" } as React.CSSProperties}>
        Admin panel
      </p>

      <div className="relative">
        <Link href="/" aria-label="MykTech() — back to the site" className="inline-block">
          <InkMark className="w-[min(30vw,26rem)]" />
        </Link>
        <p
          className="ai-rise mt-10 max-w-sm text-balance font-display text-2xl font-medium leading-[1.2] tracking-[-0.03em] text-paper/80"
          style={{ "--d": "1.2s" } as React.CSSProperties}
        >
          Design and engineering, one team — and the room where the site is kept.
        </p>
      </div>

      <p
        className="ai-rise relative flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper/50"
        style={{ "--d": "1.35s" } as React.CSSProperties}
      >
        <span>Dipolog City</span>
        <span aria-hidden className="h-px w-6 bg-paper/25" />
        <LocalTime />
      </p>
    </aside>
  );
}
