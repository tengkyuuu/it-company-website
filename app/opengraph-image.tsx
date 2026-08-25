import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = "mykTech() — Software, designed with intent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "linear-gradient(135deg,#9d5a8f,#b85c7a,#e0a23a)";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1e293b",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* glow */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: ACCENT,
            opacity: 0.35,
            filter: "blur(40px)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "rgba(248,250,252,0.6)",
            fontWeight: 600,
          }}
        >
          IT Studio · Dipolog City
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 800, letterSpacing: -4 }}>
            <span style={{ color: "#f8fafc" }}>MY</span>
            <span
              style={{
                backgroundImage: ACCENT,
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              K
            </span>
            <span style={{ color: "#f8fafc" }}>TECH</span>
          </div>
          <div style={{ display: "flex", fontSize: 44, color: "#cbd5e1" }}>
            {site.tagline}
          </div>
        </div>

        <div style={{ display: "flex", height: 8, width: 220, background: ACCENT, borderRadius: 8 }} />
      </div>
    ),
    { ...size }
  );
}
