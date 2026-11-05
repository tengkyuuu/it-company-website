"use client";

import { useEffect, useRef, useState } from "react";
import KeySwitch from "@/components/fx/KeySwitch";
import type { IconName } from "@/lib/services";

const labels: Record<IconName, string> = {
  web: "Web Development", app: "App Development", design: "UI/UX Design",
  cloud: "Cloud & DevOps", ai: "AI & Automation", consult: "IT Consulting",
};

/** A replaceable cap-only image above the original stationary AVIF switch. */
export default function ServiceKeycap({ icon, className = "" }: {
  icon: IconName;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(release.current), []);

  return (
    <button
      type="button"
      aria-label={`Press ${labels[icon]} key`}
      onClick={() => {
        clearTimeout(release.current);
        setPressed(true);
        release.current = setTimeout(() => setPressed(false), 180);
      }}
      className={`ks-trigger block w-full cursor-pointer rounded-2xl leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold-ink)] ${className}`}
    >
      <KeySwitch size="100%" capSrc={`/brand/services/caps/${icon}.avif`} pressed={pressed} />
    </button>
  );
}
