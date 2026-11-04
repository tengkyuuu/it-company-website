"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import KeySwitch from "@/components/fx/KeySwitch";
import type { IconName } from "@/lib/services";
import { observeVisible } from "@/lib/webgl";

/**
 * Services header ornament: one big keycap that presses itself and cycles its
 * legend through the six service icons. Runs only while on screen and not under
 * reduced motion (then it rests on the first legend).
 */
export default function ServicesGlyph({ icons }: { icons: IconName[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [down, setDown] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || icons.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let release: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      setDown(true);
      setI((n) => (n + 1) % icons.length);
      release = setTimeout(() => setDown(false), 650);
    };
    const stop = observeVisible(el, (v) => {
      clearInterval(timer);
      if (v) timer = setInterval(tick, 2600);
    });
    return () => {
      stop();
      clearInterval(timer);
      clearTimeout(release);
    };
  }, [icons.length]);

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      <KeySwitch
        size={250}
        tint="onyx"
        pressed={down}
        legend={<Icon name={icons[i]} className="h-full w-full" />}
      />
    </div>
  );
}
