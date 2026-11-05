"use client";

import { useEffect, useRef, useState } from "react";
import ServiceKeycap from "@/components/services/ServiceKeycap";
import type { IconName } from "@/lib/services";
import { observeVisible } from "@/lib/webgl";

/**
 * Services header ornament: one photographic keycap cycling through the six
 * inlaid service symbols. Runs only while on screen and not under
 * reduced motion (then it rests on the first legend).
 */
export default function ServicesGlyph({ icons }: { icons: IconName[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || icons.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      setI((n) => (n + 1) % icons.length);
    };
    const stop = observeVisible(el, (v) => {
      clearInterval(timer);
      if (v) timer = setInterval(tick, 2600);
    });
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [icons.length]);

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      {icons.length > 0 && <ServiceKeycap icon={icons[i % icons.length]} />}
    </div>
  );
}
