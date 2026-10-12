import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = "R Ally's Tech — Software, designed with intent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "linear-gradient(135deg,#9d5a8f,#b85c7a,#e0a23a)";

// the lockup's own proportions (scripts/build-wordmark.mjs prints them)
const MARK_W = 780;
const MARK_H = Math.round((MARK_W * 1206) / 3636);

export default async function OpengraphImage() {
  // The real logo, not a typeset approximation: the generated silhouette,
  // re-inked for the dark ground. Read from disk — this route is prerendered
  // at build time, when there is no origin to fetch /brand/wordmark.svg from.
  const svg = await readFile(join(process.cwd(), "public/brand/wordmark.svg"), "utf8");
  const mark = `data:image/svg+xml;base64,${Buffer.from(
    svg.replace('fill="#000"', 'fill="#f8fafc"')
  ).toString("base64")}`;

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

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori, not the DOM */}
          <img src={mark} width={MARK_W} height={MARK_H} alt="" />
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
