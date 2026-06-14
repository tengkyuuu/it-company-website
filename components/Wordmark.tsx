import Link from "next/link";
import KMark from "./KMark";

/**
 * The MYKTECH wordmark, set in the brand display face (Syne). The "K" is the
 * custom geometric mark carrying the magenta→gold gradient.
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
      MY
      <KMark className="mx-[0.03em] h-[0.74em] w-auto translate-y-[0.015em]" />
      TECH
    </span>
  );

  if (href === null) return mark;

  return (
    <Link
      href={href}
      aria-label="MYKTECH — home"
      className="inline-flex items-center"
    >
      {mark}
    </Link>
  );
}
