import { useId } from "react";

/**
 * A geometric "K" — stem + chevron carrying the brand magenta→gold gradient.
 * Scales with font-size (set height in em).
 *
 * NOTE: unused since the name became mykTech() — the wordmark has no capital K,
 * so Wordmark.tsx now puts the gradient on the trailing parens instead. Kept
 * because public/brand/logo.png (the shield) still shows the gradient KT.
 */
export default function KMark({ className = "" }: { className?: string }) {
  const id = useId();
  const fill = `url(#${id})`;
  return (
    <svg
      viewBox="0 0 96 100"
      className={className}
      fill="none"
      role="img"
      aria-label="K"
    >
      <defs>
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="96"
          y2="100"
        >
          <stop offset="0%" stopColor="#9d5a8f" />
          <stop offset="50%" stopColor="#b85c7a" />
          <stop offset="100%" stopColor="#e0a23a" />
        </linearGradient>
      </defs>
      {/* stem */}
      <rect x="6" y="5" width="21" height="90" rx="2" fill={fill} />
      {/* chevron arms */}
      <g stroke={fill} strokeWidth="21" strokeLinecap="square" strokeLinejoin="miter">
        <line x1="40" y1="50" x2="82" y2="13" />
        <line x1="40" y1="50" x2="82" y2="87" />
      </g>
    </svg>
  );
}
