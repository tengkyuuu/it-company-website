# mykTech() — Company Website

Marketing website for **mykTech()**, an IT company. Prototype. Goal: a sleek,
modern, *graphic-designer-grade* site that tells customers who we are and what we build.
Clean and human — **not** "techy" (avoid circuit boards, matrix code, neon-on-black clichés).
The impression to leave: *we make software and we innovate, with taste.*

## Pages
1. **Landing** — hero, what we do, proof, CTA.
2. **Services** — web dev, app dev, + the offerings below.
3. **Projects** — `/projects` index + `/projects/[slug]` detail, each with a preview.
4. **About** — who we are, values, team/story.
5. **Location** — where to find us, map, contact.
6. **Admin** — `/admin`, the CMS (not in `nav`; noindex + robots-disallowed).

**HQ:** Dipolog City, Zamboanga del Norte (single source of truth: `lib/site.ts`).
**Hero:** immersive WebGL "constellation" (no photo). **Selected Work = real client projects**
(FameCRM, PhysioPano, SHM, Rally's Equities, Coffee Shop) — screenshots in `public/work/`,
data in `lib/work.ts`.
**Team (real):** Jhade Banquiao (Project Lead), James Calunsag (Frontend), Haron Diniay
(Backend), Ralph Andilab (Mobile), Sean Jacinto (AI Automation), Hasnain Fayyaz (Marketing).
**Nav:** logo mark (`public/brand/logo.png`) + `mykTech()` wordmark, top-left.

## Landing page rhythm (each section structurally distinct — avoid repeating the card grid)
**3D hero** (`Hero` — sticky 175vh stage; scroll scatters the constellation) →
**tech-stack marquee** (`TechMarquee`, velocity-reactive, real logos via `simple-icons`,
colorise on hover) → showreel (`VideoReveal`) → **Services** (`ServicesGalaxy` — theme-following
band on `bg-surface`,
sticky WebGL glyph morphs per service as the index scrolls) → **Selected Work**
(`WorkGallery` — pinned horizontal gallery, parallax plates, live counter) →
**Process** (`ProcessDeck` — sticky stacked cards) → belief band (`BeliefScrub` —
words ink in with scroll) → footer.
(Removed the testimonials carousel — it used famous design quotes, misleading as
"client" quotes — and the invented stats row, per client feedback.)
Global: `ScrollProgress` gradient bar fixed at top. Work images in `public/work/` (real
client screenshots).

## Services (prototype set — refine later)
- Web Development
- App Development (mobile)
- UI/UX Design
- Cloud & DevOps
- AI & Automation
- IT Consulting

## Brand

### Logo — the primary mark is a raster, used as a CSS mask
The real wordmark is the client's artwork: **`public/brand/mykTech().png`**, a lockup that
sets each glyph in a *different* typeface —
`m` Canva Sans · `y` Brittany · `k` Roboto · `T` Horizon · `e` Ahsing · `c` Brick Sans ·
`h` Sanchez · `()` Alatsi. **It therefore cannot be reproduced in a web font**; treat it as
artwork, not text.

- **`components/Logo.tsx`** is the only way to render it. Two derived assets, both painted as
  a **CSS `mask` over `currentColor`** (not `<img>`), so the mark inherits the text colour and
  follows light/dark and `.band` for free:
  - `public/brand/wordmark.png` — the source trimmed to its ink box with `alpha = 255 − luminance`
  - `public/brand/wordmark-outline.png` — that silhouette dilated by 5px **minus itself**, i.e. a
    real ring. Use `variant="outline"`. This exists because CSS `drop-shadow` is applied
    *before* masking, so a shadow-based outline on a masked element gets clipped straight off.
  - Sizing: the element carries the wordmark's aspect ratio — set **one** axis (`h-7`, `w-full`).
  - Used in `Nav` (h-26px, beside `logo.png`), `FooterWordmark`, `Preloader`, and the admin chrome.
- ⚠️ **It's ~1199px of ink and there is no vector.** Displaying it wider than ~820 CSS px
  upscales on a retina screen and goes soft — that's why `FooterWordmark` is width-capped.
  **Ask the client for an SVG/EPS** and the cap can go.
- To regenerate the derived assets, see the sharp scripts referenced in the git history for
  this change (trim → alpha, then separable box-dilate → subtract).
- **Casing is fixed and deliberate: lowercase `myk`, capital `T`, trailing `()`. Never
  MYKTECH, never myktech.** ⚠️ Never place *text* spellings inside an `uppercase` /
  `text-transform` context — bitten twice (Hero badge, Preloader label). The mask can't be
  transformed, which is another reason to prefer `Logo` over set type.
- `components/Wordmark.tsx` (Syne, gradient parens) + `components/KMark.tsx` are the older
  type-set treatment. Superseded by `Logo` everywhere; kept because `logo.png` still shows the
  gradient KT and the Syne version is the fallback if the raster ever has to go.
- Assets in repo root: `logo.png` (shield, gradient KT), `myktech logo.png` (business-card
  mockup), `myktech no logo.png` (horizontal wordmark on laptop). Filenames keep the old
  spelling; so do technical identifiers (`mykt-website`, `mykt.studio`, `mykt-theme`,
  `mykt-preloaded`, `mykt:ready`) — those are **not** the brand name, leave them alone.
- In an email `From` header the display name **must be quoted** (`"mykTech()" <…>`) — bare
  parens are RFC 5322 comment delimiters and clients drop them (see `lib/email.ts`).

### Color palette
| Role | Token | Light | Dark |
|------|-------|-------|------|
| Page background | `paper` | `#F8FAFC` | `#0B1220` |
| Raised card | `surface` | `#FFFFFF` | `#131D30` |
| Borders / dividers | `mist` | `#CBD5E1` | `#2A3647` |
| Secondary text | `slatey` | `#94A3B8` | `#8496B0` |
| Headings / body | `ink` | `#1E293B` | `#E6EDF7` |

**Never hardcode these** — use the Tailwind utilities (`bg-paper`, `text-ink`,
`border-mist`, `bg-surface`). They're generated from `--color-*` in `@theme`, and
dark mode works purely by re-declaring those variables (see Dark mode below), so a
literal `bg-white` or `#1E293B` is what breaks the theme.

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
- **Display/brand: Syne** (`--font-display`, via next/font) — free stand-in for the paid
  "Inline" by Letters from Sweden. Used for the `mykTech()` wordmark + big headings (Hero h1,
  `SectionHeader` titles). Swap in real Inline `.woff2` via next/font/local if licensed.
- **Geist** (Geist Sans for body/UI; Geist Mono only for tiny labels/code chips).
- Big, confident display headings (tight tracking, weight 600–700). Generous body line-height.
- Scale leans editorial — let headings breathe with whitespace, not effects.

## Design direction
- **Editorial & airy**, not corporate-techy. Lots of `paper` whitespace, ink type,
  one gradient accent. Think a design studio's site, not an SaaS dashboard.
- Soft, large radii (`16–24px`), subtle shadows, thin slate borders. No hard tech edges.
- Imagery: real, warm, human/abstract (people collaborating, soft 3D, paper/light textures).
  Source from Pexels/Pinterest. Avoid stocky "hacker/server-room" shots.
- A dark section or two for rhythm/contrast (footer, belief band) — see `.band` below.

## Dark mode
Light/dark is driven by a **`data-theme` attribute on `<html>`**, not `prefers-color-scheme`
alone, and not `dark:` variants sprinkled through the markup.

- `[data-theme="dark"]` in `globals.css` **re-declares the `--color-*` ramp**, so every
  existing `bg-paper` / `text-ink` / `border-mist` flips at once. Adding a new component
  usually needs *zero* dark-mode work — just use the tokens.
  These rules are **unlayered**, so they beat Tailwind's `@layer theme` defaults.
- **`.band`** = a section deliberately dark in *both* themes (footer, `BeliefScrub`, the last
  `ProcessDeck` card, `VideoReveal`'s frame, `Preloader`, the `WorkGallery` plates). It pins the
  neutral ramp *locally* to its light-on-dark values, so descendants keep using
  `bg-ink` / `text-paper` / `text-slatey` and read correctly either way. In dark mode a band sits
  slightly **above** the page background, so it reads as an elevated surface, not a hole.
  Literal `border-white/10`-style alphas are fine inside a band (it's dark in both themes).
- `components/theme/`: `ThemeScript` (blocking inline script in `<head>`; stamps `data-theme`
  before first paint so there's no flash), `ThemeProvider` (mirrors the attribute into React
  for the WebGL scenes; `setTheme` writes the DOM **synchronously** so it can run inside a View
  Transition), `ThemeToggle` (pill in the `Nav`).
  ⚠️ The shared key/type live in **`lib/theme.ts`, which must NOT have `"use client"`** —
  `ThemeScript` is a server component, and importing a value out of a client module across the
  RSC boundary yields a client-reference proxy that serialises to `undefined`. That exact bug
  silently made the stored preference unreadable (`localStorage.getItem(undefined)`).
- **Toggle transition**: `document.startViewTransition()` + an animated `clip-path` circle
  expanding from the button, so the incoming theme wipes over the outgoing one. Browsers without
  the API and `prefers-reduced-motion` get an instant swap. Because the API holds a static
  snapshot for the whole animation, prop-driven repaints (the Three.js material colors) are
  hidden by the wipe — no lerping needed.
- `dark:` **does** work if you need it — registered via
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`.
- `HeroScene` keeps a light mesh albedo in dark mode but drops `ambientLight` hard, so the accent
  point-lights still paint the gradient while unlit faces fall into shadow (otherwise the forms
  read as blown-out white blobs). `GlyphScene` needs nothing — near-white lit forms already work
  on both grounds.
- Reveal note: `Reveal direction="left"/"right"` offsets by ±28px, which **overflows a
  full-width mobile column** (and sticks, because framer-motion fixes `initial` at mount). Use
  the default vertical reveal for anything full-bleed.

## Motion
- Tasteful, not flashy. Scroll-reveal fades/translates, staggered list entrances,
  gradient-shift on the accent, magnetic/hover micro-interactions on CTAs, smooth page
  transitions. Respect `prefers-reduced-motion`. Keep easing soft (e.g. `cubic-bezier(0.22,1,0.36,1)`),
  durations 300–700ms.

### Opening sequence (`components/fx/Preloader.tsx`)
Plays on **every full load** (client request — no sessionStorage gate; client-side route
changes don't remount it). On `#111a24`: the gray mark → a raked band of white light sweeps
left→right leaving the mark **white** behind it → it resolves to **black with a thin white
outline** → the panel lifts away and dispatches `mykt:ready`. ~2.14s.

Every state is the same wordmark mask in a different colour, so there is no font swap and no
reflow. Two non-obvious rules, both learned the hard way here:
1. **The choreography is CSS, not GSAP** (`.pl-*` in `globals.css`). GSAP can't start until React
   hydrates, which left a ~0.75s dead pause on the gray frame, and the sequence only got ~4fps
   because hydration + the hero's WebGL boot + the showreel preload own the main thread. CSS
   starts at first paint (`.pl` is in the SSR HTML) and every keyframe animates **only
   `transform`/`opacity`**, so it composites and stays smooth regardless. Don't animate `width`
   here — the reveal is a wrapper/child counter-translate pair for exactly this reason.
2. **The reveal and the light share one delay/duration/easing.** Give them different easings and
   the eased reveal races ahead, leaving the flash trailing behind the edge it's meant to create.
3. Handover is scheduled from the animation's own clock (`root.getAnimations()[0].currentTime`),
   **not** its `animationend` event — that event dispatches on the busy main thread and measured
   ~700ms late, holding `lenis-stopped` well after the panel had visually cleared.
   Read the animation off the element, not by keyframe name (a minifier may rename it).
- `VideoReveal` defers its 160-frame preload until `mykt:ready` (with a 4s backstop) so those
  requests stop competing with the sequence.

## Tech stack
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config in `app/globals.css` via `@theme`)
- **Motion engine: GSAP + ScrollTrigger** (scroll choreography) and **Lenis** (smooth scroll),
  synced via the GSAP ticker. **Framer Motion** for component-level interaction
  (`Reveal`, nav, accordion, roster orb, magnetic `Button`).
- **Three.js + @react-three/fiber + drei** — two scenes in `components/three/`:
  `HeroScene` (constellation) and `GlyphScene` (per-service morphing glyphs). Gating util:
  `lib/webgl.ts` (`wants3D()` = desktop + WebGL + no reduced-motion; CSS gradient fallback otherwise).
- **Geist** font (`geist` package: `GeistSans`, `GeistMono`)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — auth + Postgres + Storage behind
  the `/admin` CMS. Entirely optional: with no env vars the site serves the static content.
- Brand assets live in `public/` (logo, mockups, `work/` tiles).
- Run: `npm run dev` → http://localhost:3000

### Motion architecture (the "awwwards" layer)
- `components/fx/`: `AmbientBackground` (drifting **gray** gradient clouds + a depth veil +
  a soft **cursor-following spotlight** on desktop — accent stays reserved),
  `SmoothScroll` (Lenis↔GSAP), `Cursor` (dot+ring, fine-pointer only),
  `Preloader` (the opening sequence — see below — dispatches `mykt:ready`),
  `ScrollFX` (global `[data-animate]` reveal via `ScrollTrigger.batch`; adds `reveal-ready`
  to `<html>` so content is never stuck hidden with JS off). `app/template.tsx` = per-route
  fade (opacity-only — a transform would break `position:fixed`/sticky descendants).
- `components/hero/`: `Hero` — sticky stage inside a 175vh section. Kinetic line-mask
  headline (one line outlined via `.text-stroke`, one gradient word), gated on `mykt:ready`;
  a scrubbed ScrollTrigger pipes progress into `HeroScene` (satellites scatter, camera pulls
  back) and lifts the copy away. Extras: rotating circular-text badge, live PHT clock
  (`fx/LocalTime`), geo coordinates from `lib/site.ts`. Accent point-lights paint the
  magenta→gold gradient onto near-white meshes (the "one gradient" rule, in 3D).
- `components/landing/`: `TechMarquee` (speed/skew react to scroll velocity),
  `VideoReveal` (160-frame webp sequence in `public/brand/reel/` — pins + expands to
  full-bleed while **scrubbing with scroll**; mobile = contained loop),
  `ServicesGalaxy` (**follows the theme** — `bg-surface text-ink`, so it is light in light
  mode and an elevated slate in dark; deliberately does NOT use `.band`, and therefore
  carries no hardcoded `white/XX` alphas — use the neutral ramp inside it. Left panel
  sticky with `GlyphScene` — IntersectionObserver
  marks the row crossing mid-viewport "active", glyph + label crossfade; mobile stacks with
  animated `Icon`s), `WorkGallery` (pinned horizontal scroll via `gsap.matchMedia`; each
  plate is tinted with the project's own `dots` colors and layers 1–2 **browser-framed
  screenshots contained at native aspect** — sources are only ~1536×743, so never
  cover-crop/upscale them (that's what made them blurry once); parallax is translate-only
  (`.work-shot-drift` + `data-depth`, sign flips direction) via `containerAnimation`; live
  `01/05` counter + progress rail; mobile stacks, main shot only; `img2` in `lib/work.ts`
  is the optional secondary shot), `ProcessDeck` (position-sticky card stack; GSAP scales covered cards back),
  `BeliefScrub` (scrubbed per-word opacity; words default visible so no-JS still reads).
- Inner pages: Services = `services/ServiceIndex` (framer-motion accordion, outlined
  numerals) + `services/ServicesGlyph` (cycling `GlyphScene`); About = outline-type marquee
  band + `about/TeamRoster` (cursor-following gradient monogram orb, rows recede on hover);
  Location = giant `mailto:` typographic moment + live clock, hairline detail rows,
  grayscale→color map hover.
- **Projects** (`app/projects/`): index is **alternating editorial feature rows** (deliberately
  not another card grid — it has to differ from both `WorkGallery` and the Services accordion);
  `[slug]` detail = header + spec rail (`<dl>`) + highlights, a large preview, a Screens grid,
  and wrapping prev/next. `components/projects/LivePreview` renders browser chrome around either
  a real **live `<iframe>`** (only when the project has a `liveUrl`) or the screenshot:
  IntersectionObserver-gated mount, rendered at 1440px then CSS-scaled via ResizeObserver so you
  see the *desktop* layout, pointer-events off until "Interact" is clicked (otherwise the iframe
  eats the page scroll), and the screenshot poster is **never** removed on a timeout — a site that
  refuses framing can't be detected cross-origin, so "Open ↗" is always present.
- `Button` is **magnetic** (springs toward the cursor on mouse). A subtle filmic
  **grain** overlay sits site-wide (`.grain`, fixed, z-40) over the ambient gray gradients.
- `fx/KeySwitch` — the site-wide mascot object (client request, ref. midu.design): two
  client-supplied alpha-AVIF renders layered in CSS — `public/brand/keyswitch.avif`
  (housing, stays neutral) under `public/brand/keycap.avif` (translucent resin cap).
  **Hover only flares the under-cap glow — the cap does not move; the press (cap travels
  down onto the housing) is reserved for `:active`**, so the click has its own payoff
  (`.keyswitch` CSS in `globals.css`: fast press w/ overshoot, slow spring release;
  reduced-motion = no travel, glow alone carries both states). A `tint` prop hue-rotates cap+glow together (red/gold/plum/rose/sky/mint) so
  **each placement wears a different color**: hero=gold, ServicesGalaxy=plum,
  WorkGallery=sky, ProcessDeck=rose, BeliefScrub=mint, Services page=rose, About=sky,
  Location=plum, Footer=red. Decorative (`aria-hidden`).
- `.beam` utility (`globals.css`, via `@property --beam-angle`) draws an animated accent
  border-comet — used sparingly (the contact card). One accent moment per view.
- **All motion respects `prefers-reduced-motion`.**

### Backend & production
- **Contact form (working)**: a **Route Handler** `app/api/contact/route.ts` (chosen over a
  Server Action to avoid deployment-skew "Failed to find Server Action" errors — a stable
  URL survives redeploys) validates with a shared Zod schema (`lib/contact-schema.ts`,
  service list derived from `lib/services.ts`) and emails via **Resend** (`lib/email.ts` —
  studio notification with `replyTo` = lead + best-effort auto-reply). Client
  `ContactForm.tsx` `fetch`es it (pending/success/error/field-errors, `aria-live`/`aria-invalid`).
  **Spam**: hidden honeypot (`company`) + `startedAt` time-trap (<3s = silent drop). No DB.
  **Env** (`.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` —
  set in `.env.local` and on Vercel. Until set, submit returns a graceful error banner.
- **SEO**: per-page metadata + canonicals + twitter card; `app/sitemap.ts`, `app/robots.ts`,
  dynamic `app/opengraph-image.tsx` (+ `twitter-image`), JSON-LD `ProfessionalService`
  (Organization/LocalBusiness) in `app/layout.tsx`. Canonical base = `site.url`
  (`NEXT_PUBLIC_SITE_URL` override).
- **Admin panel / CMS** (`/admin`, Supabase) — **entirely optional**. With the env vars unset
  the marketing site builds and renders exactly as before and `/admin` shows setup steps
  (`components/admin/SetupNotice`); nothing hard-depends on a database.
  - **Schema**: `supabase/schema.sql` — paste into the Supabase SQL editor, idempotent. Creates
    `profiles` (role: owner > admin > editor), `projects`, single-row `site_settings`, the public
    `work` storage bucket, explicit grants, and RLS. The **first** account to sign up becomes the
    `owner` (via the `handle_new_user` trigger); everyone else arrives by invite. Policy role
    checks go through `SECURITY DEFINER` helpers (`is_staff()`, `is_admin()`) — reading a role
    inside a policy on `profiles` would otherwise recurse infinitely.
  - **Clients** (`lib/supabase/`): `client.ts` (browser), `server.ts` (cookies, for the panel),
    `admin.ts` (service-role, `import "server-only"` so leaking it to the client is a *build*
    error), and **`public.ts` — a cookie-less anon client used for all public reads**. That last
    one matters: the `@supabase/ssr` server client calls `cookies()`, which would opt `/projects`
    out of static rendering. With it, `/projects` stays `○ Static` and `[slug]` stays SSG, and the
    admin's `revalidatePath()` calls invalidate them on publish.
  - **Read layer**: `lib/cms.ts` (`getProjects`, `getProjectBySlug`, `getSiteContent`) —
    Supabase when configured, **falling back field-by-field** to `lib/work.ts` / `lib/site.ts`
    on missing config, error, or empty result. A blank cell in the panel can't blank the site.
  - **Auth**: `middleware.ts` refreshes the session cookie (the only place that can) and gates
    `/admin/**`, bouncing to `/admin/login?next=…` (internal redirects only). Login also offers
    first-run sign-up and password reset.
  - **Panel**: overview, projects CRUD (publish toggle, reorder, delete, **"import the 5 existing
    projects"** to seed from `lib/work.ts`), team (invite by email w/ role, change role, remove —
    needs `SUPABASE_SERVICE_ROLE_KEY`), and site settings (brand/contact/availability/socials).
    Screenshot uploads go **browser → Storage directly**, not through a server action, whose body
    is capped ~1MB and would reject most captures.
  - `components/SiteChrome.tsx` gates the marketing chrome (Lenis, preloader, cursor, nav,
    footer, grain) off `/admin` by pathname. `Footer` is passed to it **as a prop**, not imported
    — `SiteChrome` is a client component and `Footer` is now an async server component.
- **Robustness**: `app/not-found.tsx` (branded 404) + `app/error.tsx` boundary.
- **Analytics**: `@vercel/analytics` + `@vercel/speed-insights` in layout (the
  `/_vercel/*/script.js` 404s seen under local `next start` are expected — they resolve on
  Vercel).
- **To finalize (content)**: real social URLs + verified email/phone in `lib/site.ts`;
  verify the Resend sending domain.
- ⚠️ **The project URLs are placeholders.** Checked 2026-08-03: `famecrm.app`,
  `physiopano.com`, `rallys-equities.com` and `coffee.shop` are all **NXDOMAIN**, and `shm.app`
  is a GoDaddy *domain-for-sale* parking page. So `liveUrl` is deliberately unset on every
  project — `url` is only a display label in the browser chrome, and there are no outbound links
  to dead domains. The live-embed path is built and ready: set `liveUrl` (in `lib/work.ts`, or the
  Live URL field in the admin) and that project's preview becomes a real iframe. **Re-check before
  setting one** — don't point the portfolio at a parked domain.

### Verification
`scripts/verify.mjs` drives headless Chromium (Playwright) over all routes at desktop
(1440) + mobile (390): checks console errors, horizontal overflow, and writes screenshots
to `.verify/`. Playwright is **not** a project dependency (it would break the Vercel build);
the script installs it on demand with `--no-save`, so it never touches `package.json`/lockfile.
Run: `npm run build && npx next start -p 3100 &` then `npm run verify`.

### ⚠️ Stale `.next` cache (build/dev collision) — and how to sidestep it
`next build` (production) and `next dev` write **different** client-reference/module
manifests into the same `.next`. Running one after the other — e.g. `npm run verify`
(which does `next build` + `next start`) while a `next dev` server is up — leaves mismatched
artifacts and throws runtime errors like `Cannot read properties of undefined (reading 'call')`
or `Invariant: Expected clientReferenceManifest to be defined`. **These are cache artifacts,
not code bugs.** Fix: `npm run clean` (removes `.next`) then restart the dev server. OneDrive
syncing `.next` mid-write makes it worse (see below). Rule of thumb: don't leave `.next` in a
production-built state under an active dev server.

**Preferred: build somewhere else.** `next.config.mjs` reads `distDir` from `NEXT_DIST_DIR`, so a
production build can be verified without touching the dev server's `.next` at all:
```
NEXT_DIST_DIR=.next-verify npx next build
NEXT_DIST_DIR=.next-verify npx next start -p 3210
```
(`.next-verify` is gitignored.) Note that a `next build` also rewrites `tsconfig.json`'s
`include` to add `<distDir>/types` — harmless, and why both `.next` and `.next-verify` are listed.

Also: when the dev server is **recompiling under active edits**, headless checks throw transient
`ChunkLoadError` / `SyntaxError: Invalid or unexpected token` / one-off 500s. Confirm with `curl`
before believing them — they're HMR artifacts, not code bugs.

### ⚠️ OneDrive caveat
This project lives under OneDrive, which has **twice silently removed binary files**
(`public/work/*.jpg`, and once a `.tsx`). If images 404 / a component "vanishes", restore the
file from git (`git checkout -- <path>`); work-tile paths live in `lib/work.ts`. Consider
moving the repo outside OneDrive.

## Conventions
- Mobile-first, fully responsive. Accessible (semantic HTML, focus states, alt text, contrast).
- Reusable components: `Button`, `Section`, `Nav`, `Footer`, `ServiceCard`, `Reveal` (motion wrapper).
- Footer is a **feature**, not a sigh-off: interactive giant wordmark
  (`FooterWordmark` — the outlined `Logo` mask, ghosted, with the accent gradient inking in
  under a cursor-following spotlight; `.fw` CSS; touch = quiet static fill; width-capped at
  820px because the mark is a raster), availability status + live PHT clock, social pill chips,
  `fx/BackToTop` (uses `scrollToTop()` exported from `fx/SmoothScroll`), and a
  `Developed by mykTech() · for mykTech()` credit line at the very bottom.
- `text-accent`/`bg-accent` are Tailwind v4 `@utility`s (not plain classes) so
  `hover:`/`group-hover:` variants work — keep it that way.
- **Theme-safe styling**: reach for the semantic tokens (`bg-paper`, `bg-surface`, `text-ink`,
  `border-mist`, `text-slatey`). A literal `bg-white` / hex won't flip in dark mode. Inside a
  `.band`, `white/N` alphas are fine. See **Dark mode** above.

## Open questions / notes
- MCP tooling requested ("ui ux pro max", "design thinking", "glif-mcp") is **not yet
  configured** in this environment — need install details/keys from the user. Available
  design MCPs: `magic` (21st.dev), `stitch`, `canva`, `figma`.
