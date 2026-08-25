import Link from "next/link";

/**
 * The mykTech() wordmark, set in the brand display face (Syne). Casing is
 * deliberate and fixed: lowercase "myk", capital "T", trailing "()".
 *
 * The parens carry the magenta→gold gradient — they're the signature moment now
 * that the name has no capital K for KMark to render, and reading the wordmark
 * as a function call is the point. Everything else stays ink / paper.
 */
export default function Wordmark({
  className = "",
  invert = false,
  href = "/",
}: {
  className?: string;
  invert?: boolean;
  href?: string | null;
}) {
  const mark = (
    <span
      className={`inline-flex items-center font-display font-bold leading-none tracking-tight select-none ${
        invert ? "text-paper" : "text-ink"
      } ${className}`}
    >
      mykTech
      <span className="text-accent">()</span>
    </span>
  );

  if (href === null) return mark;

  return (
    <Link
      href={href}
      aria-label="mykTech() — home"
      className="inline-flex items-center"
    >
      {mark}
    </Link>
  );
}
