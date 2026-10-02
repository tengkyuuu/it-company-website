"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { observeVisible, wants3D } from "@/lib/webgl";

const GlyphScene = dynamic(() => import("@/components/three/GlyphScene"), {
  ssr: false,
});

/**
 * Floating 3D ornament for the Services header — cycles through all glyphs.
 * Renders only while the header is on screen; scrolled past, the canvas idles.
 */
export default function ServicesGlyph() {
  const box = useRef<HTMLDivElement>(null);
  const [show3d, setShow3d] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    setShow3d(wants3D());
  }, []);

  useEffect(() => {
    if (!show3d || !box.current) return;
    return observeVisible(box.current, setInView);
  }, [show3d]);

  if (!show3d) {
    // gradient bloom, not `filter: blur()` on a solid disc
    return (
      <div className="accent-glow h-full w-full rounded-full opacity-50" aria-hidden />
    );
  }
  return (
    <div ref={box} className="h-full w-full">
      <GlyphScene active={-1} paused={!inView} />
    </div>
  );
}
