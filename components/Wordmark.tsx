import Link from "next/link";

/**
 * The MYKT wordmark. "MYK" in ink, the final "T" carries the brand
 * magenta→gold gradient — the signature move from the logo.
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
      className={`font-sans font-bold tracking-tight leading-none select-none ${
        invert ? "text-paper" : "text-ink"
      } ${className}`}
    >
      MYK<span className="text-accent">T</span>
    </span>
  );

  if (href === null) return mark;

  return (
    <Link href={href} aria-label="MYKT — home" className="inline-flex items-end">
      {mark}
    </Link>
  );
}
