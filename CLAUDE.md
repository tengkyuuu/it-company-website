# MYKT — Company Website

Marketing website for **MYKT** (MYKTECH), an IT company. Prototype. Goal: a sleek,
modern, *graphic-designer-grade* site that tells customers who we are and what we build.
Clean and human — **not** "techy" (avoid circuit boards, matrix code, neon-on-black clichés).
The impression to leave: *we make software and we innovate, with taste.*

## Pages
1. **Landing** — hero, what we do, proof, CTA.
2. **Services** — web dev, app dev, + the offerings below.
3. **About** — who we are, values, team/story.
4. **Location** — where to find us, map, contact.

**HQ:** Dipolog City, Zamboanga del Norte (single source of truth: `lib/site.ts`).
**Hero:** WebGL gradient blob (no photo). **Selected Work = real client projects**
(FameCRM, PhysioPano, SHM, Rally's Equities, Coffee Shop) — screenshots in `public/work/`.
**Team (real):** Jhade Banquiao (Project Lead), James Calunsag (Frontend), Haron Diniay
(Backend), Ralph Andilab (Mobile), Sean Jacinto (AI Automation), Hasnain Fayyaz (Marketing).
**Nav:** logo mark (`public/brand/logo.png`) + MYKT wordmark, top-left.

## Landing page rhythm (each section structurally distinct — avoid repeating the card grid)
Hero (2-col, photo + parallax + scroll cue) → client marquee → **Services** (interactive
index + sticky dark panel, `ServicesShowcase`) → **Selected Work** (asymmetric image tiles
7/5·5/7, hover zoom, `SelectedWork`) → **Testimonials** (auto-rotating carousel) →
**Stats** (borderless editorial row) → **Process** (vertical timeline) → belief band → footer.
Global: `ScrollProgress` gradient bar fixed at top. Work images in `public/work/` (Pexels).

## Services (prototype set — refine later)
- Web Development
- App Development (mobile)
- UI/UX Design
- Cloud & DevOps
- AI & Automation
- IT Consulting

## Brand

### Logo
- Wordmark **MYKT** (also stacked "MY / KT" in a shield/keyhole mark).
- The signature move: the final letter (**T** / the **KT** descender) carries a
  **magenta→gold gradient**. Everything else is near-black on light, or white on dark.
- Assets in repo root: `logo.png` (shield, gradient KT), `myktech logo.png` (business-card
  mockup), `myktech no logo.png` (horizontal MYKT wordmark on laptop). Keep generous clear
  space around the mark.

### Color palette
| Role | Hex | Use |
|------|-----|-----|
| Neutral (bg) | `#F8FAFC` | page background, light surfaces |
| Primary (slate-300) | `#CBD5E1` | borders, muted fills, dividers |
| Tertiary (slate-400) | `#94A3B8` | secondary text, captions, icons |
| Secondary (ink) | `#1E293B` | headings, body text, dark sections/footer |

**Accent — the only color in the system. Use sparingly, as the gradient:**
```
--accent-from: #9D5A8F;  /* magenta-purple */
--accent-mid:  #B85C7A;  /* mauve-rose      */
--accent-to:   #E0A23A;  /* gold            */
--accent: linear-gradient(135deg, var(--accent-from), var(--accent-mid), var(--accent-to));
```
Reserve the gradient for: the logo's letter, one key word in a headline, CTA hover/underline,
a single hero glow, link/active states. If a second thing on screen uses it, remove one.

### Typography
- **Geist** (Geist Sans for everything; Geist Mono only for tiny labels/code chips).
- Big, confident display headings (tight tracking, weight 600–700). Generous body line-height.
- Scale leans editorial — let headings breathe with whitespace, not effects.

## Design direction
- **Editorial & airy**, not corporate-techy. Lots of `#F8FAFC` whitespace, ink type,
  one gradient accent. Think a design studio's site, not an SaaS dashboard.
- Soft, large radii (`16–24px`), subtle shadows, thin slate borders. No hard tech edges.
- Imagery: real, warm, human/abstract (people collaborating, soft 3D, paper/light textures).
  Source from Pexels/Pinterest. Avoid stocky "hacker/server-room" shots.
- A dark `#1E293B` section or two for rhythm/contrast (e.g. footer, a feature band).

## Motion
- Tasteful, not flashy. Scroll-reveal fades/translates, staggered list entrances,
  gradient-shift on the accent, magnetic/hover micro-interactions on CTAs, smooth page
  transitions. Respect `prefers-reduced-motion`. Keep easing soft (e.g. `cubic-bezier(0.22,1,0.36,1)`),
  durations 300–700ms.

## Tech stack
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config in `app/globals.css` via `@theme`)
- **Motion engine: GSAP + ScrollTrigger** (scroll choreography) and **Lenis** (smooth scroll),
  synced via the GSAP ticker. **Framer Motion** still used for small component-level reveals
  (`Reveal`, nav, testimonials).
- **Three.js + @react-three/fiber + drei** — the hero's soft gradient blob only.
- **Geist** font (`geist` package: `GeistSans`, `GeistMono`)
- Brand assets live in `public/` (logo, mockups, `work/` tiles).
- Run: `npm run dev` → http://localhost:3000

### Motion architecture (the "awwwards" layer)
- `components/fx/`: `AmbientBackground` (CSS-only drifting **gray** gradient clouds behind
  every page — accent stays reserved), `SmoothScroll` (Lenis↔GSAP), `Cursor` (dot+ring, fine-pointer only),
  `Preloader` (first-load counter wipe, sessionStorage-gated, dispatches `mykt:ready`),
  `ScrollFX` (global `[data-animate]` reveal via `ScrollTrigger.batch`; adds `reveal-ready`
  to `<html>` so content is never stuck hidden with JS off). `app/template.tsx` = per-route
  fade (opacity-only — a transform would break `position:fixed`/sticky descendants).
- `components/hero/`: `Hero` (kinetic line-mask headline, gated on `mykt:ready`),
  `BlobScene` (R3F, two accent point-lights paint the magenta→gold gradient; window-pointer
  parallax so the canvas can sit behind content). WebGL is desktop + WebGL-capable only;
  mobile/reduced-motion get a CSS gradient fallback.
- `components/landing/`: `VelocityMarquee` (speed/skew react to scroll velocity),
  `VideoReveal` (`public/brand/landing-page-vid.mp4` — starts inset/rounded, pins + expands
  to full-bleed while the clip **scrubs with scroll**; mobile = contained autoplay loop),
  `ServicesPinned` (desktop horizontal pinned scroll via `gsap.matchMedia`; mobile stacks),
  `StatsCounter` (count-up on enter), `ProcessTimeline` (scrubbed draw-line).
- **All motion respects `prefers-reduced-motion`.**

### Verification
`scripts/verify.mjs` drives headless Chromium (Playwright) over all routes at desktop
(1440) + mobile (390): checks console errors, horizontal overflow, and writes screenshots
to `.verify/`. Playwright is **not** a project dependency (it would break the Vercel build);
the script installs it on demand with `--no-save`, so it never touches `package.json`/lockfile.
Run: `npm run build && npx next start -p 3100 &` then `npm run verify`.

### ⚠️ OneDrive caveat
This project lives under OneDrive, which has **twice silently removed binary files**
(`public/work/*.jpg`, and once a `.tsx`). If images 404 / a component "vanishes", re-download
work tiles (Pexels IDs in `SelectedWork.tsx`) or restore the file. Consider moving the repo
outside OneDrive.

## Conventions
- Mobile-first, fully responsive. Accessible (semantic HTML, focus states, alt text, contrast).
- Reusable components: `Button`, `Section`, `Nav`, `Footer`, `ServiceCard`, `Reveal` (motion wrapper).
- Footer is a **feature**, not a sigh-off: big brand wordmark, gradient accent, sitemap,
  contact, socials, subtle motion.

## Open questions / notes
- MCP tooling requested ("ui ux pro max", "design thinking", "glif-mcp") is **not yet
  configured** in this environment — need install details/keys from the user. Available
  design MCPs: `magic` (21st.dev), `stitch`, `canva`, `figma`.
