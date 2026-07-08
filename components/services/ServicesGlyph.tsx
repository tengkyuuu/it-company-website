"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { wants3D } from "@/lib/webgl";

const GlyphScene = dynamic(() => import("@/components/three/GlyphScene"), {
  ssr: false,
});

/** Floating 3D ornament for the Services header — cycles through all glyphs. */
export default function ServicesGlyph() {
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    setShow3d(wants3D());
  }, []);

  if (!show3d) {
    return (
      <div
        className="h-full w-full rounded-full opacity-50 blur-[50px]"
        style={{ background: "var(--accent)" }}
        aria-hidden
      />
    );
  }
  return <GlyphScene active={-1} />;
}
