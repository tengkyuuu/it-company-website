import Link from "next/link";
import Logo from "@/components/Logo";

/**
 * The bare, centred frame for the panel's signed-out moments: an invite or
 * reset link landing, choosing a password, the "no access" screen. Same
 * composition as /admin/login so they read as one family.
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
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block">
          <Logo label="R Ally's Tech — back to the site" className="h-[26px]" />
        </Link>
        {eyebrow && (
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
            {eyebrow}
          </p>
        )}
        <h1
          className={`${eyebrow ? "mt-3" : "mt-8"} font-display text-2xl font-semibold tracking-tight`}
        >
          {title}
        </h1>
        {intro && <div className="mt-2 text-sm leading-relaxed text-ink/60">{intro}</div>}

        {children && (
          <div className="mt-8 rounded-2xl border border-mist/70 bg-surface p-6">
            {children}
          </div>
        )}

        {footer ?? (
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm text-ink/50 transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Back to the site
          </Link>
        )}
      </div>
    </div>
  );
}
