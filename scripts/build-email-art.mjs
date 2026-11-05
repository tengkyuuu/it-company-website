/**
 * Builds the animated header for the panel emails (invite, password reset):
 * public/brand/email/header.gif, plus a still header.png fallback.
 *
 *   node scripts/build-email-art.mjs
 *
 * It replays the site's opening sequence (components/fx/Preloader.tsx) as a
 * GIF: the wordmark sits faint on an ink band, a band of gold light sweeps
 * left→right and inks it in, the gold spark resolves, a gold hairline draws
 * out under it and four-point sparks (the logo's own spark shape) twinkle.
 *
 * Why a GIF: it is the only animation every mail client plays (Gmail strips
 * CSS animation). Classic Outlook shows the FIRST frame only, so frame 0 is
 * the finished lockup; the sequence then starts with a quick fade to faint,
 * which also makes each loop restart without a flicker. It plays three times
 * and rests on the finished lockup.
 *
 * Pixels are composited by hand from the generated reversed/white lockups
 * (public/brand/myktech/png), so the GIF can't drift from the real artwork.
 * Rebuild after `npm run build:brand` if the logo changes.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const png = (f) => path.join(root, "public/brand/myktech/png", f);
const outDir = path.join(root, "public/brand/email");
mkdirSync(outDir, { recursive: true });

// 2x of the 560 x 200 slot it fills in the email
const W = 1120;
const H = 400;
const LOGO_W = 620;

const INK = [12, 10, 9]; // #0C0A09 (the .band surface)
const GOLD = [212, 175, 55]; // #D4AF37

async function rgba(file) {
  const { data, info } = await sharp(file)
    .resize({ width: LOGO_W })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const white = await rgba(png("myktech-horizontal-white.png"));
const final = await rgba(png("myktech-horizontal-reversed.png"));
const LX = Math.round((W - white.w) / 2);
const LY = Math.round(H * 0.44 - white.h / 2);

// ---------------------------------------------------------------------------
// tiny compositor
// ---------------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

function blend(buf, i, rgb, a) {
  if (a <= 0) return;
  buf[i] += (rgb[0] - buf[i]) * a;
  buf[i + 1] += (rgb[1] - buf[i + 1]) * a;
  buf[i + 2] += (rgb[2] - buf[i + 2]) * a;
}

/** a four-point spark (astroid) centred on cx, cy */
function spark(buf, cx, cy, r, a) {
  if (r < 0.5 || a <= 0) return;
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const px = Math.round(cx + x);
      const py = Math.round(cy + y);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      // |x|^.5 + |y|^.5 <= r^.5, with a 1px soft edge
      const d = Math.sqrt(Math.abs(x)) + Math.sqrt(Math.abs(y)) - Math.sqrt(r);
      const cover = clamp(0.5 - d * 1.6);
      blend(buf, (py * W + px) * 3, GOLD, cover * a);
    }
  }
}

/**
 * One frame. `s` = state:
 *   ink    0..1  how far the white ink has been revealed (left→right)
 *   faint  0..1  opacity of the unrevealed mark
 *   ray    0..1  where the gold band is (fraction of the logo width), or null
 *   gold   0..1  crossfade from white lockup to the reversed (gold-spark) one
 *   rule   0..1  hairline drawn out from the centre
 *   sparks [{x,y,r,a}]
 */
function frame(s) {
  const buf = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) buf.set(INK, i * 3);

  const edge = LX + s.ink * (white.w + 80) - 40; // reveal edge in canvas px
  const rayX = s.ray == null ? null : LX + s.ray * (white.w + 160) - 80;

  for (let y = 0; y < white.h; y++) {
    for (let x = 0; x < white.w; x++) {
      const j = (y * white.w + x) * 4;
      const cx = LX + x;
      const i = ((LY + y) * W + cx) * 3;
      const aw = white.data[j + 3] / 255;
      if (aw <= 0) continue;
      // revealed? soft 40px edge
      const rev = clamp((edge - cx) / 40 + 0.5);
      const shown = s.faint * (1 - rev) + rev;
      if (s.gold > 0 && rev > 0) {
        const c = [final.data[j], final.data[j + 1], final.data[j + 2]];
        const mix = [
          255 + (c[0] - 255) * s.gold,
          255 + (c[1] - 255) * s.gold,
          255 + (c[2] - 255) * s.gold,
        ];
        blend(buf, i, mix, aw * shown);
      } else {
        blend(buf, i, [255, 255, 255], aw * shown);
      }
      // the gold light, clipped to the letters
      if (rayX != null) {
        const d = (cx - rayX + (y - white.h / 2) * 0.25) / 46; // slight skew
        blend(buf, i, GOLD, aw * Math.exp(-d * d) * 0.95);
      }
    }
  }

  // a faint glow of the band over the ink, so the light reads as light
  if (rayX != null) {
    for (let y = Math.max(0, LY - 60); y < Math.min(H, LY + white.h + 60); y++) {
      const fy = 1 - Math.abs(y - (LY + white.h / 2)) / (white.h / 2 + 60);
      for (let x = Math.max(0, Math.floor(rayX - 160)); x < Math.min(W, rayX + 160); x++) {
        const d = (x - rayX + (y - LY - white.h / 2) * 0.25) / 70;
        blend(buf, (y * W + x) * 3, GOLD, Math.exp(-d * d) * 0.1 * fy);
      }
    }
  }

  // hairline
  if (s.rule > 0) {
    const half = 130 * s.rule;
    const ry = LY + white.h + 54;
    for (let x = Math.floor(W / 2 - half); x < W / 2 + half; x++) {
      const fade = clamp((half - Math.abs(x - W / 2)) / 24);
      blend(buf, (ry * W + x) * 3, GOLD, fade);
      blend(buf, ((ry + 1) * W + x) * 3, GOLD, fade);
    }
    spark(buf, W / 2, ry + 0.5, 9 * s.rule, 1);
  }

  for (const k of s.sparks ?? []) spark(buf, k.x, k.y, k.r, k.a);

  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(buf[i]);
  return out;
}

// ---------------------------------------------------------------------------
// timeline — 25 fps
// ---------------------------------------------------------------------------
const FPS = 25;
const SPARKS = [
  { x: LX - 70, y: LY + 8, r: 15, at: 1.62 },
  { x: LX + white.w + 64, y: LY + white.h - 6, r: 19, at: 1.78 },
  { x: LX + white.w * 0.62, y: LY - 46, r: 11, at: 1.95 },
  { x: LX + white.w * 0.2, y: LY + white.h + 40, r: 9, at: 2.1 },
];
const twinkle = (t, at) => {
  const p = (t - at) / 0.9;
  if (p <= 0 || p >= 1) return 0;
  return Math.sin(p * Math.PI) ** 1.4;
};

const FINISHED = { ink: 1, faint: 0.14, ray: null, gold: 1, rule: 1, sparks: [] };
const frames = [{ s: FINISHED, delay: 20 }]; // what Outlook shows

const DUR = 3.1;
for (let f = 0; f <= DUR * FPS; f++) {
  const t = f / FPS;
  const s = { faint: 0.14, ray: null, sparks: [] };

  // 0 → 0.28s: the finished mark fades back to faint
  const out = easeInOut(clamp(t / 0.28));
  // 0.36 → 1.36s: light sweeps and inks it in
  const sweep = easeInOut(clamp((t - 0.36) / 1.0));
  s.ink = t < 0.36 ? 1 - out : sweep;
  s.gold = t < 0.36 ? 1 - out : easeOut(clamp((t - 1.2) / 0.4));
  s.ray = t >= 0.3 && t <= 1.5 ? sweep : null;
  s.rule = t < 0.36 ? 1 - out : easeOut(clamp((t - 1.35) / 0.55));
  if (t < 0.36) s.faint = 0.14 + (1 - out) * 0; // stays at faint underneath

  for (const k of SPARKS) {
    const a = twinkle(t, k.at);
    if (a > 0) s.sparks.push({ x: k.x, y: k.y, r: k.r * (0.35 + 0.65 * a), a });
  }
  frames.push({ s, delay: Math.round(1000 / FPS) });
}
// rest on the finished lockup before the next play
frames.push({ s: FINISHED, delay: 2600 });

// ---------------------------------------------------------------------------
// encode
// ---------------------------------------------------------------------------
const pngs = await Promise.all(
  frames.map(({ s }) => sharp(frame(s), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer())
);

const gif = path.join(outDir, "header.gif");
await sharp(pngs, { join: { animated: true } })
  .gif({ delay: frames.map((f) => f.delay), loop: 3, effort: 10, dither: 0.4 })
  .toFile(gif);

await sharp(pngs[0]).png({ compressionLevel: 9, palette: true }).toFile(path.join(outDir, "header.png"));

const { size } = await import("node:fs").then((fs) => fs.statSync(gif));
console.log(`header.gif  ${frames.length} frames, ${(size / 1024).toFixed(0)} KB`);
