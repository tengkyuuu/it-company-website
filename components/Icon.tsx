import type { IconName } from "@/lib/services";

/** Line icons with a subtle, distinctive animation per service. */
const paths: Record<IconName, React.ReactNode> = {
  web: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9h18" strokeLinecap="round" />
      {/* pulsing browser dot + animated loading line */}
      <circle cx="5.6" cy="7" r="0.7" fill="currentColor" stroke="none" className="ic-pulse" />
      <path d="M7 13h6" strokeLinecap="round" className="ic-draw" />
    </>
  ),
  app: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18h2" strokeLinecap="round" />
      {/* notification ping */}
      <circle cx="12" cy="6.5" r="0.9" fill="currentColor" stroke="none" className="ic-pulse" />
    </>
  ),
  design: (
    // twinkling star — slow rotate
    <g className="ic-spin">
      <path
        d="M12 3l2.2 4.8L19 8.4l-3.5 3.4.9 5L12 14.8 7.6 16.8l.9-5L5 8.4l4.8-.6L12 3z"
        strokeLinejoin="round"
      />
    </g>
  ),
  cloud: (
    // gently floating cloud
    <g className="ic-float">
      <path
        d="M7.5 18a4 4 0 0 1 .4-7.98A5 5 0 0 1 17.5 11a3.5 3.5 0 0 1-.5 7H7.5z"
        strokeLinejoin="round"
      />
    </g>
  ),
  ai: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M5 10v4M19 10v4M10 5h4M10 19h4" strokeLinecap="round" />
      {/* pulsing core */}
      <rect x="9" y="9" width="6" height="6" rx="1.2" className="ic-pulse" />
    </>
  ),
  consult: (
    <>
      <path d="M4 5h16v10H8l-4 4V5z" strokeLinejoin="round" />
      {/* blinking typing dots */}
      <circle cx="9" cy="10" r="0.7" fill="currentColor" stroke="none" className="ic-pulse" />
      <circle cx="12" cy="10" r="0.7" fill="currentColor" stroke="none" className="ic-pulse" style={{ animationDelay: "0.3s" }} />
      <circle cx="15" cy="10" r="0.7" fill="currentColor" stroke="none" className="ic-pulse" style={{ animationDelay: "0.6s" }} />
    </>
  ),
};

export default function Icon({
  name,
  className = "h-6 w-6",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
