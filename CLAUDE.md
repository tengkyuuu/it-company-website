# MykTech() — Company Website

Marketing website for **MykTech()**, an IT company. Prototype. Goal: a sleek,
modern, *graphic-designer-grade* site that tells customers who we are and what we build.
Clean and human — **not** "techy" (avoid circuit boards, matrix code, neon-on-black clichés).
The impression to leave: *we make software and we innovate, with taste.*

**Where the decisions live** (read these before changing a page):
- `PRODUCT.md` — who the site is for (local businesses, teams abroad, founders), what counts as
  success (a sent contact form), the evidence on hand, and the principles: **every fact has one
  home** and **nothing invented**.
- `DESIGN.md` — the v2 visual system (tokens, gold rules, type, keycaps, hero spec).
- `docs/content-plan.md` — what each page says, adds and removes (Parts A and B built 2026-11-04;
  Part C waits on material). `docs/content-request.md` — the material asked of the team (case
  studies, photos, client names + quotes, FAQ answers, About story). `docs/part-b-copy.md` — the
  team's confirmed answers (in-person meetings **by arrangement**, clients abroad **already**,
  languages **English, Filipino, Bisaya**, reply **within one business day**, a first call of
  varying length, **price agreed after scoping**). Don't state anything beyond these.
- `docs/redesign-plan.md` — the v2 build phases.

## Pages
Nav: `Home · Services · Work · About · Contact`.
1. **Home** `/` — hero reel, tech marquee, who we build for, featured services keycap, process, belief.
2. **Services** `/services` — the single home for service detail; engagement models
   (`#engagements`, each with a "Good for" line). FAQ waits on the team's answers.
3. **Work** `/projects` (nav label "Work", URL unchanged) + `/projects/[slug]` case studies.
4. **About** — story, values, team, where we work.
5. **Contact** `/contact` — form first + what happens next. **`/location` and `/fil/location`
   308 here** (`next.config.mjs` `redirects()`, which run before middleware). Some keys and
   identifiers still say `location` (e.g. the `location.*` i18n namespace) — intentional.
6. **Admin** — `/admin`, the CMS (not in `nav`; noindex + robots-disallowed).

**One home per fact:** project screenshots appear only in the hero reel (motion, no text) and on
Work; full service detail only on Services; the closing call to action only in the footer band —
no per-page CTA rows. Selected Work gallery, showreel, About marquee and the old MYKT
business-card image were removed for this reason (2026-11-04).

Every public page exists in **English (unprefixed: `/projects`) and Filipino (`/fil/projects`)**
— routes live under `app/[lang]/`; see "Internationalisation" below. ⚠️ The EN/FIL **switcher was
removed** (client: "does not make sense"), so nothing links to `/fil` any more; the pages are
still built (open decision — leave them for now). `components/i18n/LanguageSwitcher.tsx` remains,
unused. Plus CMS-driven
**Products** (`/products`, `/products/[slug]`), **Careers** (`/careers`, `/careers/[slug]` with
an apply form) and **Blog** (`/blog`, `/blog/[slug]`) — their nav/footer links appear only once
something is published (`getPublishedSections()`); see "Products / Careers / Blog".

**HQ:** Dipolog City, Zamboanga del Norte (single source of truth: `lib/site.ts`).
**Hero:** a curved reel of our own project screenshots (CSS 3D, no WebGL, no photo).
**Real client projects** (FameCRM, PhysioPano, SHM, Rally's Equities, Coffee Shop) —
screenshots in `public/work/` (+ hero derivatives in `public/work/hero/`), data in `lib/work.ts`.
**Team (real, seven — `lib/team.ts` is the source):** Hasnain Fayyaz (Founder · Marketing), Sean
Jacinto (Co-founder · AI Automation), Jhade Banquiao (Project Lead), James Calunsag (UI/UX), Haron
Diniay (Backend), Ralph Andilab (Mobile), Rhett Manubag (Mobile / Web).
**Nav (2026-11-05, after spykercars.com):** burger (left) · the Ignition horizontal lockup
(`components/Logo.tsx`) **centred**, 160px / 176px wide with its gold spark · theme toggle (right).
Nothing else in the bar — no inline links, no "Get in touch", **no search button** (search is
⌘K / Ctrl K / `/` only). The burger drops a full-width paper panel from the top: big numbered
links + a side column (studio, live PHT clock, "Within one business day", Start a project).

## Landing page rhythm (each section structurally distinct — avoid repeating the card grid)
**Hero** (`Hero` — 100svh, `CurvedReel` behind the headline, gold keycap) →
**tech-stack marquee** (`TechMarquee`, velocity-reactive, monochrome logos via `simple-icons`) →
**The studio** (`StudioIntro` — About's taste: asymmetric editorial spread, copy left, a tall
photo right starting lower and a wide one under the copy, drifting at different speeds) →
**Who we build for** (`Audiences` — three editorial columns) → **Services** (`ServicesGalaxy` —
theme-following surface on `bg-surface`, one sticky featured key with six navigation targets) →
**Selected work** (`WorkIndex` — Work's taste as a typographic index: name + category per row,
each a link to its case study; **no screenshots**, they stay in the hero reel and on Work) →
**Process** (`ProcessDeck` — sticky stacked cards) → **Built in Dipolog** (`DipologCollage` — a
scattered photo collage around one centred message; near photos large and drifting further, far
ones smaller and washed back; phones get photo · copy · three-up strip) → belief band
(`BeliefScrub` — words ink in with scroll) → footer.
The three photo sections (added 2026-11-05 after spykercars.com) exist because the nav is a
burger now: Home gives every inner page a one-line taste and a link. **Their photos are
TEMPORARY stand-ins** — grayscale stock (Unsplash licence via picsum.photos), local in
`public/placeholder/`, no faces. Every slot is in `lib/photo-slots.ts` with the real photo it
wants; swap by changing `src` and `temporary`. Don't ship the stand-ins to real visitors as if
they were ours. Drift is `fx/Parallax` (scrubbed, translate-only, off on phones and with reduced
motion). Headline counts ("Seven people", "Five platforms") come from the data via
`lib/count-word.ts`, so they stay true when the roster or projects change.
Removed: the testimonials carousel (famous design quotes, misleading as "client" quotes), the
invented stats row, the showreel (`VideoReveal`) and the Selected Work gallery (`WorkGallery`).
A **proof band** (permitted client names + one real quote) is planned, hidden until the material
arrives. Global: `ScrollProgress` gold bar fixed at top.

## Services (prototype set — refine later)
- Web Development
- App Development (mobile)
- UI/UX Design
- Cloud & DevOps
- AI & Automation
- IT Consulting

## Brand
The visual system is **v2 "Monochrome + Gold"** (shipped on branch `redesign-v2`, 2026-11-04);
`DESIGN.md` is the spec.

### Logo — Ignition, a generated vector family
**The brand is MykTech()** in ordinary writing (capital M and T, no spaces inside the
parentheses). Myk is the founder's name; do not invent an acronym or origin story. Approved
2026-11-04: **"Ignition — keycap, M/T, gold spark"**. The angled keycap carries an integrated
M/T, with a gold four-point spark at its open corner. The wordmark is outlined **DM Serif
Display Italic**, with adjusted spacing and a clean native k terminal. The website remains
Geist Sans / Geist Mono; the serif is logo artwork only.

- **Source and rebuild:** `npm run build:brand` runs `scripts/build-brand.mjs` then
  `scripts/build-icons.mjs`. It regenerates SVGs, transparent PNGs, social cover, brand board,
  `lib/brand-geometry.ts`, the inline offline emblem, favicon and PWA/Apple icons. The stable
  legacy command `node scripts/build-wordmark.mjs` delegates to the brand generator. Fonts are
  local, with SIL Open Font Licenses in `public/brand/myktech/fonts/`; no live font fetch is
  needed. The HTML usage guide, PDF and packaging are reviewed separately.
- **Use `components/Logo.tsx` to render the website identity.** It paints vector CSS masks in
  `currentColor`, following light/dark and `.band`. Set one dimension; the generated
  `brandGeometry` supplies the other. `accent` overlays a flat gold spark for primary identity
  placements; it has no effect on wordmark, micro or outline layouts. Nav uses the accent;
  primary header, footer identity and admin placements use the gold spark. The preloader
  resolves with that spark; the oversized footer uses the minimal monochrome wordmark.
- **Six layouts, native canvas / minimum screen width / minimum print width:** horizontal
  `561 / 112`, 160px / 36mm; wordmark `421 / 112`, 120px / 27mm; stacked `453 / 332`,
  160px / 36mm; signature `561 / 148`, 320px / 72mm; symbol `252 / 220`, 40px / 10mm;
  micro `252 / 220`, 16px / 5mm. Screen widths include canvas padding. Nav is 160px / 176px
  wide. Use the complete emblem at 40px and above and the MT-only micro at 16–39px; the micro
  intentionally omits cap and spark.
- **Space and treatment:** clear space on every side is one eighth of the complete emblem's
  visible width, including the spark. Safety padding in the SVG is not the full clear space.
  Preserve proportions, the original keycap angle and supplied spacing. Keep the parentheses.
  Do not reconstruct the wordmark with live type or add gradients, shadows or letter-by-letter
  recoloring. `variant="outline"` is decorative, horizontal/wordmark only, at least 600px wide.
  Footer and preloader container queries switch smaller artwork to solid fills.
- **Supplied tones:** primary ink + gold, reversed warm white + gold, and ink / white / gold
  monochrome. Logo gold shares the existing restrained accent palette; it does not introduce
  a new website color or type system.
- **Assets:** `public/brand/myktech/index.html` is the offline guide; `tokens.json` and
  `manifest.json` are identity values and inventory. The kit contains 35 production SVGs and
  33 PNGs, plus six internal accent-mask SVGs. PNG lockups are 2400px wide; symbol, micro and
  avatar PNGs are 1024px wide. Use the SVGs for unlimited scaling and editable native vectors.
- **Site masks:** all placements load the explicit Ignition paths in
  `public/brand/myktech/svg/`, avoiding stale artwork at legacy mask URLs. The preloader uses
  horizontal masks; the oversized footer uses wordmark-only masks. `public/brand/wordmark.svg`,
  `wordmark-outline.svg` and `wordmark-accent.svg` remain compatibility exports. `monogram.svg`
  and `monogram-micro.svg` feed application icons. PWA and Apple icons use the explicit
  `public/brand/myktech/app-icons/` paths. OG imagery reads the generated SVG from disk.
- Changing mask files in place means returning visitors can receive cached artwork:
  **bump `VERSION` in `public/sw.js` whenever the logo changes**.
- **Written name versus technical values:** use MykTech() in ordinary body copy. Keep existing
  SQL identifiers, dotenv values, storage/event keys and email-header display names intact.
  Parentheses are RFC 5322 comment delimiters, so do not mechanically add them to email `From`
  headers. Vercel's `CONTACT_FROM_EMAIL` / `ADMIN_FROM_EMAIL` can override code defaults.
- Technical identifiers keep `mykt`: `mykt-website`, `mykt.studio`, `mykt-theme`,
  `mykt-preloaded`, `mykt:ready`. Renaming them can break storage, events or domains.
- **"Rally's Equities" is a client project, not the brand** — keep its name in `lib/work.ts`.

**Historical logo record (superseded, retained for context):** ransom-note `mykTech()` with eleven
typefaces → R Ally's house lockup (2026-10-12, adapted from "Rally's Tours & Transfers") →
MykTech re-lettering (2026-11-04, client request). That former mark used an oversized Cinzel
500 M, a four-point spark, tracked YK and Geist 500 TECH between hairline rules. The short-lived
premium split-M proposal was rejected before Ignition was selected. Neither earlier design is
an approved alternate.

Former generator lessons: `opentype.js` `toPathData()` could emit `NaN` for near-zero coordinates
such as `1.1e-13`; custom command serialization avoids it. Overlapping glyph contours can expose
internal seams when stroked, and opposing winding directions can cancel fill. The old outline
therefore masked out the filled silhouette; CSS drop shadows applied before a mask were clipped.
The former spark tucked over an R bowl and `HAIRLINE` (then 0) was positioned for Cinzel R only.
The old manual workflow pasted `2958 / 1226` into CSS / preloader / OG code and copied the offline
path by hand; generated geometry and the brand build now replace those steps. Earlier live-type
wordmarks were twice altered by uppercase contexts (hero badge and preloader); use the supplied
artwork. `public/brand/logo.png` (old KT shield), `mykTech().png`, `wordmark.png` and
`wordmark-outline.png` are unreferenced legacy artwork, retained rather than deleted.

For the former lockup only: the generator fetched Cinzel / Geist from Google Fonts and needed
`npm install --no-save opentype.js` as a build-time tool, deliberately outside the runtime
dependencies like the verification script's Playwright. Its rules extended under the spark
and YK together because under YK alone they looked like hyphen-length stubs. Its M occupied the
full height while the name's capitals were under half-height, so TECH failed below roughly
36px tall. Former placements were Nav `h-10`, admin chrome `h-9` and auth cards `h-11`;
those measurements and its approximately 2.4:1 ratio are historical, not Ignition sizing rules.
The earlier MykTech rename removed parentheses and the related quoting traps; Ignition
restores them in ordinary writing, with the email-header distinction documented above.

### Colour palette (v2 "Monochrome + Gold", 2026-11-04 — full spec in `DESIGN.md`)
Warm stone neutrals at roughly **white 70% / black 20% / gold 10%**.

| Role | Token | Light | Dark |
|------|-------|-------|------|
| Page background | `paper` | `#FAFAF9` | `#0C0A09` |
| Raised card | `surface` | `#FFFFFF` | `#1C1917` |
| Borders / dividers | `mist` | `#E7E5E4` | `#292524` |
| Secondary text | `slatey` | `#78716C` | `#A8A29E` |
| Headings / body | `ink` | `#0C0A09` | `#F5F5F4` |

**Never hardcode these** — use the Tailwind utilities (`bg-paper`, `text-ink`,
`border-mist`, `bg-surface`). They're generated from `--color-*` in `@theme`, and
dark mode works purely by re-declaring those variables (see Dark mode below), so a
literal `bg-white` or `#0C0A09` is what breaks the theme.

**Gold — the only colour in the system, and it is flat (no gradient anywhere):**
```
--color-gold:       #D4AF37;  /* marks, fills, gold ON black            */
--color-gold-ink:   #8C6D1F;  /* gold TEXT on white (4.9:1); #D4AF37 in dark mode and in .band */
--color-gold-press: #B8962E;
```
The v1 names `--accent-from/-mid/-to` and `--accent` still exist so old call sites compile, but
all point at the same gold. Rules: **one gold moment per viewport** (a headline word, the gold
keycap, the progress bar…); **no `#D4AF37` small text on white** (use `text-accent` /
`gold-ink`); if a second gold thing appears on screen, make one of them ink. The magenta/rose v1
gradient, its glows (`.aurora`, `.accent-glow`) and the goo blobs are **gone** — don't bring
them back.

### Typography
- **Geist only** (decided 2026-11-04): Geist Sans for display, body and UI; Geist Mono for tiny
  labels and code chips. `--font-display` points at Geist Sans (Syne was removed). The only serif
  on the site is inside the logo artwork.
- Display headings: medium weight (500–600), tight tracking (≈ −0.035 to −0.045em). Generous body
  line-height.
- Scale leans editorial — let headings breathe with whitespace, not effects.

## Design direction
- **Editorial & airy**, not corporate-techy. Lots of `paper` whitespace, ink type,
  one flat gold accent. Think a design studio's site, not an SaaS dashboard.
- Moderate radii — sharpened 2026-11-04 at the client's request: `rounded-xl` 10px,
  `rounded-2xl` 14px, `rounded-3xl` 16px (tokens in `@theme`); pills stay pills. Subtle shadows,
  thin stone borders.
- Imagery: our own project screenshots (never cropped or upscaled — sources are ~1536px wide);
  team and workspace photos are requested from the client (`docs/content-request.md`), not stock.
- A dark section or two for rhythm/contrast (footer, belief band, last process card) — see
  `.band` below.
## Dark mode
Light/dark is driven by a **`data-theme` attribute on `<html>`**, not `prefers-color-scheme`
alone, and not `dark:` variants sprinkled through the markup.

- `[data-theme="dark"]` in `globals.css` **re-declares the `--color-*` ramp**, so every
  existing `bg-paper` / `text-ink` / `border-mist` flips at once. Adding a new component
  usually needs *zero* dark-mode work — just use the tokens.
  These rules are **unlayered**, so they beat Tailwind's `@layer theme` defaults.
- **`.band`** = a section deliberately dark in *both* themes (footer, `BeliefScrub`, the last
  `ProcessDeck` card, `Preloader`, `LivePreview`'s browser frame). It pins the
  neutral ramp *locally* to its light-on-dark values, so descendants keep using
  `bg-ink` / `text-paper` / `text-slatey` and read correctly either way. In dark mode a band sits
  slightly **above** the page background, so it reads as an elevated surface, not a hole.
  Literal `border-white/10`-style alphas are fine inside a band (it's dark in both themes).
- `components/theme/`: `ThemeScript` (blocking inline script in `<head>`; stamps `data-theme`
  before first paint so there's no flash), `ThemeProvider` (mirrors the attribute into React
  for components that need it; `setTheme` writes the DOM **synchronously** so it can run inside a View
  Transition), `ThemeToggle` (pill in the `Nav`).
  ⚠️ The shared key/type live in **`lib/theme.ts`, which must NOT have `"use client"`** —
  `ThemeScript` is a server component, and importing a value out of a client module across the
  RSC boundary yields a client-reference proxy that serialises to `undefined`. That exact bug
  silently made the stored preference unreadable (`localStorage.getItem(undefined)`).
- **Toggle transition**: `document.startViewTransition()` + an animated `clip-path` circle
  expanding from the button, so the incoming theme wipes over the outgoing one. Browsers without
  the API and `prefers-reduced-motion` get an instant swap. Because the API holds a static
  snapshot for the whole animation, prop-driven repaints are
  hidden by the wipe — no lerping needed.
- `dark:` **does** work if you need it — registered via
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`.
- Reveal note: `Reveal direction="left"/"right"` offsets by ±28px, which **overflows a
  full-width mobile column** (and sticks, because framer-motion fixes `initial` at mount). Use
  the default vertical reveal for anything full-bleed.

## Motion
- Tasteful, not flashy. Scroll-reveal fades/translates, staggered list entrances,
  magnetic/hover micro-interactions on CTAs, keycap presses, smooth page transitions. Respect
  `prefers-reduced-motion`. Keep easing soft (e.g. `cubic-bezier(0.22,1,0.36,1)`),
  durations 300–700ms.

### Opening sequence (`components/fx/Preloader.tsx`)
Plays on **every full load** (client request — no sessionStorage gate; client-side route
changes don't remount it). Redesigned 2026-11-05 after spykercars.com: on the **page colour**
(follows the theme): a faint mark → a gold band of light sweeps left→right inking it in → the
gold spark resolves (now identical to the nav logo) → at 1.15s the mark **shrinks and flies to the
nav's centre slot** while the background fades and the hero intro plays beneath it → lands at
1.95s and unmounts; the real nav logo (`.nav-logo`, hidden by `html:has(.pl)`) takes over.
`mykt:ready` fires at the **start** of the flight (READY_MS), not the end (TOTAL_MS).

- **The landing spot is CSS arithmetic on the Nav's constants** — `--nav-h` (72px / 80px from
  md, defined next to `.pl-*`), logo 160px / 176px, centred by the bar's `1fr auto 1fr` grid. The
  stage has a fixed width per breakpoint (280 / 440 / 640px) because CSS can't divide lengths, and
  scales **down** (never up, so the mask lands crisp). Change any of those in `Nav.tsx` and update
  `.pl-*` too. Measured landing error: < 0.05px at 390 and 1440. The bar's hairline is an inset
  shadow, not a border, because a border ate 1px of `--nav-h`.
- **The hero intro is pre-hidden by CSS while `.pl` exists** (`html[data-js]:has(.pl)`), so the
  copy doesn't flash as the background fades before GSAP takes over; `Hero` therefore uses
  `fromTo` (a `from` would read the hidden state as its destination). `data-js` is stamped by the
  head script (`ThemeScript`) — with JS off the splash just stays parked in the nav slot.

Every state is the same wordmark mask in a different colour, so there is no font swap and no
reflow. Non-obvious rules, learned the hard way here:
1. **The choreography is CSS, not GSAP** (`.pl-*` in `globals.css`). GSAP can't start until React
   hydrates, which left a ~0.75s dead pause on the gray frame, and the sequence only got ~4fps
   because hydration + the (v1) hero WebGL boot + the showreel preload owned the main thread. CSS
   starts at first paint (`.pl` is in the SSR HTML) and every keyframe animates **only
   `transform`/`opacity`**, so it composites and stays smooth regardless. Don't animate `width`
   here — the reveal is a wrapper/child counter-translate pair for exactly this reason.
2. **The reveal and the light share one delay/duration/easing.** Give them different easings and
   the eased reveal races ahead, leaving the flash trailing behind the edge it's meant to create.
3. Handover is scheduled from the animation's own clock (`.pl-bg`'s `getAnimations()[0].currentTime`),
   **not** its `animationend` event — that event dispatches on the busy main thread and measured
   ~700ms late, holding `lenis-stopped` well after the panel had visually cleared.
   Read the animation off the element, not by keyframe name (a minifier may rename it).
- `fx/ready.ts` (`markReady` / `isReady` / `whenReady`) is the source of truth for "the sequence
  is done" — `Preloader` calls `markReady()`. Use `whenReady()`, **not** a bare
  `addEventListener("mykt:ready")`: a component mounted *after* the event fired (client-side
  navigation back to `/`) would otherwise sit out its backstop timeout.

## Tech stack
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config in `app/globals.css` via `@theme`)
- **Motion engine: GSAP + ScrollTrigger** (scroll choreography) and **Lenis** (smooth scroll),
  synced via the GSAP ticker. **Framer Motion** for component-level interaction
  (`Reveal`, nav, accordion, roster orb, magnetic `Button`).
- **No WebGL any more.** v2 removed both Three.js scenes (`HeroScene`, `GlyphScene`) and
  uninstalled `three`, `@react-three/fiber` and `drei`. `lib/webgl.ts` keeps only
  `observeVisible()`, the shared on-screen observer that pauses the hero reel and the services
  keycap. (`components/three/` may linger as an empty folder on disk; git doesn't track it.)
- **Geist** font (`geist` package: `GeistSans`, `GeistMono`)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — auth + Postgres + Storage behind
  the `/admin` CMS. Entirely optional: with no env vars the site serves the static content.
- Brand assets live in `public/` (logo, mockups, `work/` tiles).
- Run: `npm run dev` → http://localhost:3000

### Motion architecture
- `components/fx/`: `AmbientBackground` (**static** monochrome `radial-gradient` clouds + a depth
  veil + the grain texture, all *behind* content — no `filter`, no animation, no cursor tracking;
  drawn once and only composited), `SmoothScroll` (Lenis↔GSAP, `lerp: 0.12`, `autoRaf: false` so
  the GSAP ticker is the only loop driving it; `pauseSmoothScroll()`/`resumeSmoothScroll()` for
  overlays like the search palette),
  `Preloader` (the opening sequence — see above — dispatches `mykt:ready`),
  `ScrollFX` (global `[data-animate]` reveal via `ScrollTrigger.batch`; adds `reveal-ready`
  to `<html>` so content is never stuck hidden with JS off). `app/template.tsx` = per-route
  fade (opacity-only — a transform would break `position:fixed`/sticky descendants).
  `ScrollProgress` = a thin gold bar fixed at the top.
- `components/hero/`: `Hero` — **one 100svh viewport** (the v1 175vh sticky runway and its
  ScrollTrigger are gone). Line-mask headline "We build software / that feels *designed.*"
  (`designed.` outlined via `.text-stroke`), gated on `whenReady()`; "See our work" (→ Work) +
  "Start a project" (→ Contact); a **gold keycap** that is a link to Contact (the hero's one gold
  moment); coordinates + "Dipolog City · live PHT clock" in the bottom bar. Behind the copy,
  **`CurvedReel`** — a port of 21st.dev "Tilted Grid Hero" (ruixen.ui; the untouched source is
  `docs/reference/tilted-grid-hero.tsx.txt`): one row of browser-framed screenshots streams round
  the inside of a cylinder, **pure CSS 3D** (each tile cut into strips, one `rotateY` keyframe per
  tile). Each strip overhangs its neighbours by `OVERLAP` (12% of a strip) — without it the compositor left a crack between two facets that showed the page through as a dark vertical line (client report, 2026-11-04). Tuned `curve` 45 / `gap` 5 / `tileHeight` 25 — the reference defaults put too few,
  too-large tiles on a tall hero, and at 1919px they swelled and overlapped. Images come from
  `heroShots()` (`lib/hero-shots.ts`: interleaves projects, maps `/work/x.ext` →
  `/work/hero/x.webp`, **skips `physiopano-app.webp`** whose 1.78 shape stretched in the strip);
  the server page passes them as a prop. Screenshots are **never cropped or upscaled**.
- `components/landing/`: `TechMarquee` (monochrome logos via `simple-icons`, hover = full ink;
  speed reacts to scroll velocity; plays only while on screen), `Audiences` ("Who we build
  for": three editorial columns — Local businesses / Teams abroad / Founders with an idea — each
  ending "Usually starts as …" → `/services#engagements`; copy approved in
  `docs/part-b-copy.md`), `ServicesGalaxy` (**follows the theme** — `bg-surface text-ink`; does
  NOT use `.band`, so no hardcoded `white/XX` alphas inside. Desktop: **one sticky featured
  keycap** up to 356px wide / about 420px tall, further viewport-clamped; IntersectionObserver
  swaps the active cap source without a crossfade.
  Six 44px navigation buttons select a service and scroll to its row. `services/ServiceKeycap`
  is an accessible button wrapping `KeySwitch` with `capSrc` and `size="100%"`. Six generated
  cap-only onyx PBT images carry integrated champagne-gold icons aligned to the top face using
  the user's green keycap reference. PNG masters and 1024 × 828 alpha AVIFs live in
  `public/brand/services/caps/`; final prompts are in `caps/prompts.json` there. The original
  separate `/brand/keyswitch.avif` housing remains stationary. Click/touch/keyboard activation
  gives a 180ms press pulse with the original CSS press/glow; only the cap moves. No new tokens. Rows
  are title + one-line `blurb` only — full detail lives on Services — then "All services →".
  Mobile: each row carries a 96px key; reduced motion suppresses cap travel, keeps glow and uses
  instant navigation scrolling), `ProcessDeck` (position-sticky card stack; GSAP scales
  covered cards back), `BeliefScrub` (scrubbed per-word opacity; words default visible so no-JS
  still reads).
- Inner pages: Services = `services/ServiceIndex` (framer-motion accordion, outlined numerals)
  + `services/ServicesGlyph` (the same layered clickable keycap cycles through the six inlaid
  symbols every 2.6 s while visible; reduced motion rests on the first symbol) + engagement models
  with a "Good for" line each (`#engagements`); About = values + `about/TeamRoster`
  (cursor-following gold monogram orb, rows recede on hover) + "Where we work" (studio, hours with
  live clock, languages English · Filipino · Bisaya); Contact = **form first** beside a sticky
  column with the reply promise and "What happens next" (We read it → A short call → A written
  proposal, price agreed after scoping), then hairline detail rows and a grayscale map.
- **Projects / Work** (`app/[lang]/projects/`): index is **alternating editorial feature rows**
  (deliberately not another card grid — it has to differ from the hero reel and the Services
  accordion);
  `[slug]` detail = header + spec rail (`<dl>`) + highlights + stack chips, a large preview,
  **The story** (numbered Challenge / Approach / Outcome), a Results row, a client testimonial,
  a Screens grid (secondary shot + gallery; mobile shots in phone frames), and wrapping
  prev/next. **Every case-study section renders only when filled in** — the static
  `lib/work.ts` entries have none of them, by design (never invent client names, quotes or
  metrics; the team's write-ups are requested in `docs/content-request.md`). The fields live on
  `projects` (`client`, `industry`, `timeline`, `services[]`,
  `team[]`, `stack[]`, `challenge`, `approach`, `outcome`, `results` jsonb, `gallery` jsonb,
  `testimonial_*`), are edited in `components/admin/ProjectForm.tsx` +
  `ProjectCaseStudy.tsx` (repeating rows submit as parallel `getAll()` arrays), and are also fed
  to the chatbot via `lib/chat-context.ts`. The per-project `dots` colours are **stored but no
  longer rendered** (v2 shows neutral chrome). `components/projects/LivePreview` renders browser
  chrome (a `.band`, so dark in both themes) around either
  a real **live `<iframe>`** (only when the project has a `liveUrl`) or the screenshot:
  IntersectionObserver-gated mount, rendered at 1440px then CSS-scaled via ResizeObserver so you
  see the *desktop* layout, pointer-events off until "Interact" is clicked (otherwise the iframe
  eats the page scroll), and the screenshot poster is **never** removed on a timeout — a site that
  refuses framing can't be detected cross-origin, so "Open ↗" is always present. Since Phase 4
  the **server** checks instead (see "Embed probe"): `embeddable === false` skips the iframe and
  shows the screenshot + "Open ↗"; never-checked behaves as before. ⚠️ Inside another link (the
  `/projects` index cards) render it with **`still`** — an `<a>`/`<button>` inside an `<a>` is
  invalid HTML, the browser re-parents it, and hydration fails (React #418) as soon as a project
  has a `liveUrl`.
- `Button` is **magnetic** (springs toward the cursor on mouse; measures its rect once on
  `pointerenter`, never per move). The filmic **grain** lives inside `AmbientBackground`,
  *behind* content (it used to be a fixed z-40 layer over everything, composited every frame).
- **No custom cursor — deliberately.** A JS-drawn dot/ring (`fx/Cursor`, removed 2026-10)
  always trails the OS cursor by ≥1 frame and stutters whenever the main thread is busy, and its
  `mix-blend-mode: difference` re-blended everything beneath it every frame. That was the "I can
  feel it in my cursor" lag the client reported. Don't bring one back.
- **`fx/KeySwitch` — the brand's signature object; the client "really really" wants it kept
  through every redesign.** Two client-supplied alpha-AVIF renders layered in CSS —
  `public/brand/keyswitch.avif` (housing, stays neutral) under `public/brand/keycap.avif`
  (translucent resin cap). Props: `size`, `tint` (`gold` | `onyx` | `ivory` — CSS filters on the
  **cap image only**, so the under-cap glow stays gold), `legend` (a node printed on the cap's top
  face, transformed into the render's perspective, with a face-coloured patch hiding the source
  cap's embossed squiggle), `pressed` (adds `.is-pressed` = the `:active` travel).
  **Hover only flares the glow — the cap does not move; the press is reserved for `:active`**
  (`.keyswitch` CSS in `globals.css`: fast press w/ overshoot, slow spring release;
  reduced-motion = no travel, glow alone carries both states). A parent with class
  **`.ks-trigger`** presses the key when *it* is pressed — that's how the hero and footer keys
  (links to Contact) and the contact form's **keycap Send button** (gold, `pressed` while
  sending, "↵ Press to send") work. Tints: hero / Send / careers = gold; white sections = onyx;
  `.band`s (footer, BeliefScrub, ProcessDeck) = ivory. **At most one gold key per page.**
  Every key has a job (`docs/content-plan.md` §5); purely decorative ones were removed.
  Decorative keys are `aria-hidden`.
- `.beam` utility (`globals.css`, via `@property --beam-angle`) draws an accent border-comet —
  used sparingly (the contact card). It **rests as a still arc and travels only on hover**: an
  animated conic gradient can't be composited, so a looping one repainted the card every frame.
- **All motion respects `prefers-reduced-motion`.**
- **All motion respects `prefers-reduced-motion`.**

### Backend & production
- **Contact form (working)**: a **Route Handler** `app/api/contact/route.ts` (chosen over a
  Server Action to avoid deployment-skew "Failed to find Server Action" errors — a stable
  URL survives redeploys) validates with a shared Zod schema (`lib/contact-schema.ts`,
  service list derived from `lib/services.ts`) and emails via **Resend** (`lib/email.ts` —
  studio notification with `replyTo` = lead + best-effort auto-reply). Client
  `ContactForm.tsx` `fetch`es it (pending/success/error/field-errors, `aria-live`/`aria-invalid`).
  **Spam**: hidden honeypot (`company`) + `startedAt` time-trap (<3s = silent drop — doesn't
  consume the rate limit). **Rate limit**: 5 / 10 min per IP + 200 / day globally, durable (see
  `lib/security.ts` below), charged before any email or DB write; blocked → 429 in-band message.
  The lead is also recorded in `leads` (the inbox) with the IP **hashed**, never raw.
  **Delivery (2026-10-19): email and the inbox record run in parallel, and the visitor sees
  success if EITHER worked** — the same rule as `/api/apply`. With no domain, Resend's sandbox
  sender reaches only the Resend account's owner, and the CMS may be off, so neither alone may
  decide. If both fail the form says the message **wasn't sent** (never a fake success).
  **Env** (`.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (must be the Resend account
  owner's address until a domain is verified; server-only, never shown on the site),
  `CONTACT_FROM_EMAIL` — set in `.env.local` and on Vercel.
- **`lib/security.ts`** (server-only) — the one place for: `clientIp()` (first XFF hop),
  `hashIp()` (HMAC-SHA256 with `IP_HASH_SECRET`, 32 hex — deterministic, so inbox threading
  still works), `hashKey()` for limiter keys, `consumeLimit()`, `sha256Hex()`, `randomToken()`.
  - `consumeLimit()` calls the atomic `consume_security_limit` RPC (service role, 2 s timeout,
    **no retries**, plus a 15 s per-instance circuit breaker after a failure). **Failure policy:**
    contact + chat **fail open** to an in-memory limiter (a paused free-tier DB must never block
    an enquiry); auth endpoints pass `failClosed: true`.
  - `IP_HASH_SECRET` must be its **own** secret — never derived from or reused as another (the
    reference project reused its session secret as a CI bearer, so a leaked GitHub secret could
    mint owner sessions). Changing it re-keys every hash. Don't import this file from
    `middleware.ts` — it uses `node:crypto` and middleware runs on the Edge runtime.
- **SEO**: per-page metadata + canonicals + twitter card; `app/sitemap.ts`, `app/robots.ts`,
  dynamic `app/opengraph-image.tsx` (+ `twitter-image`), JSON-LD `ProfessionalService`
  (Organization/LocalBusiness) in `app/layout.tsx`. Canonical base = `site.url`
  (`NEXT_PUBLIC_SITE_URL` override).
- **Site assistant / chatbot** — `components/chat/ChatWidget.tsx` (launcher + panel, bottom
  right) talking to the Route Handler `app/api/chat/route.ts`. Route Handler for the same reason
  as the contact form: a stable URL survives redeploys.
  - **Google Gemini** via `@google/genai`, model **`gemini-3.6-flash`** — the model docs name
    that exact id as the *stable* choice for production apps. ⚠️ Don't swap in a `-preview` id:
    previews get tighter rate limits and only ~2 weeks' shutdown notice. `thinkingLevel: LOW`
    (a FAQ turn doesn't need depth, and latency is visible in a bubble), `temperature: 0.4`
    (answers are lookups over the grounding block, so creativity is a liability), and safety
    explicitly at `BLOCK_MEDIUM_AND_ABOVE` rather than Gemini's defaults — a brand-facing bot
    shouldn't be the thing that says something ugly.
  - ⚠️ **Gemini calls the assistant turn `"model"`, not `"assistant"`.** The route maps our
    stored vocabulary at the boundary; getting it wrong makes the model read its own past replies
    as if the visitor had said them. The system prompt goes in `config.systemInstruction`, **not**
    as a leading `contents` entry — it isn't part of the conversation and shouldn't be something
    a visitor can argue it out of.
  - `chunk.text` is a **getter that's undefined** on metadata-only chunks (usage, finish reason),
    so never assume it's present. Two distinct failure shapes to handle: `promptFeedback.blockReason`
    means the *input* was rejected and nothing generated, while `candidates[0].finishReason` of
    `SAFETY`/`MAX_TOKENS`/`RECITATION` means generation stopped early.
  - **Grounded, not general.** `lib/chat-context.ts` builds the system prompt from
    `getSiteContent`/`getServices`/`getProjects`/`getTeam` — the same sources the pages render
    from — so editing a service in `/admin` changes the bot's answers. The hard rules in that
    prompt exist for real reasons: there are **no published prices** and the project domains are
    **placeholders that don't resolve**, so it must never quote a figure or hand out a URL.
    ⚠️ Keep that prompt **byte-stable per request** — it's prompt-cached, and interpolating a
    timestamp would silently break the cache and pay full price every call.
  - **Wire protocol is NDJSON**, one object per line: `{t}` delta, `{error}`, `{done}`. Errors
    can arrive **mid-stream** (the status is already 200 by then), which is exactly why they're
    in-band rather than an HTTP code.
  - Mounted in `SiteChrome` **outside `<SmoothScroll>`** — Lenis transforms its wrapper, and a
    `position: fixed` child of a transformed element resolves against that wrapper, so the
    launcher would scroll away. Hidden until `mykt:ready` so it can't cover the opening sequence.
  - Rate limiting is **durable**: 15 / 10 min per IP + 300 / day globally via `consumeLimit()`
    (`lib/security.ts`), charged before Gemini runs or anything is stored. (It used to be an
    in-memory Map per warm instance, which reset on every cold start.)
  - **Env**: `GEMINI_API_KEY` (server-only, never `NEXT_PUBLIC_`). Unset ⇒ **no launcher at all**
    (the `[lang]` layout passes `chat` to `SiteChrome`; read at build, so adding the key needs a
    redeploy) and `/api/chat` answers 503. "Talk to a person" shows only when chats are being
    stored (`storeOk`) — with the CMS off there is no console for a teammate to answer from. `GEMINI_MODEL` overrides
    the model (`lib/chat-config.ts`, the one place it's read; default `gemini-3.6-flash`).
    `GOOGLE_GEMINI_BASE_URL` is honoured by the SDK — handy for pointing it at a local stub.
  - **Sessions & human takeover** (Phase 4). The widget makes a session id **and a separate
    256-bit visitor key** (sessionStorage); the server stores only `sha256(key)`
    (`chat_sessions.visitor_key_hash`) and checks it on every request — a session id alone gets
    a 403. Sessions are insert-then-reread, never upserted (mode / key can't be overwritten).
    Messages live in `chat_messages` (service role, `lib/chat-store.ts`: non-throwing, 2.5 s
    timeout, 15 s circuit breaker → a DB outage falls back to the old behaviour: answer from the
    browser's history, transcript to `leads`). `mode = 'human'` ⇒ the visitor message is stored
    and **Gemini is not called**. On hand-back the model reads the stored conversation, with a
    person's turns as model turns tagged `[Name from the team, writing in person]` (a fixed
    system-prompt rule explains the tag, so the prompt stays byte-stable). Visitor polling
    (`GET /api/chat/messages`, key in `x-chat-key`) runs only while the panel is open, the tab
    visible, and a person has the chat / was asked for / ≤3 min since the visitor's last message;
    4→8→15 s backoff, 240 / 10 min per IP. "Talk to a person" sets `wants_human_at` (5 / 10 min) —
    the copy promises working hours, never instant. Console: `/admin/chats` (waiting first,
    "Live chat" nav badge), take over / hand back / reply via `app/admin/chat-actions.ts`;
    only `chat.takeover` / `chat.handback` are logged, never messages. New chats live only in
    sessions; the inbox keeps legacy/fallback `leads` chat rows.
- **Admin panel / CMS** (`/admin`, Supabase) — **entirely optional**. With the env vars unset
  the marketing site builds and renders exactly as before and `/admin` shows setup steps
  (`components/admin/SetupNotice`); nothing hard-depends on a database.
  - ⚠️ **Currently OFF (since 2026-10-19).** The Supabase project (`tniduyhmuwtflzqenvtr`) was
    **deleted** — its host is NXDOMAIN — while its URL stayed in the Vercel settings, which sit
    in James's Vercel account (`jamescalunsag13`) and couldn't be edited from here. The client
    chose to run without the CMS for now. So the CMS is now **opt-in**: `lib/supabase/env.mjs`
    (`cmsEnabled()` / `supabaseUrl()`, plain .mjs so next.config, Edge middleware, server and
    client share it) treats Supabase as configured only with **`NEXT_PUBLIC_CMS_ENABLED=true`
    AND** the keys. `isSupabaseConfigured()` goes through it, and `tests/cms-switch.test.ts`
    fails if any file reads `process.env.NEXT_PUBLIC_SUPABASE_URL` around it (allow-list: the
    client factories, admin storage, SetupNotice). Off ⇒ no Supabase request from any page, no
    Supabase origin in the CSP, `/status` 404s (and leaves footer/sitemap/search), `/admin`
    shows setup steps. Vitest sets the switch on (`vitest.config.ts` `env`).
    **To turn it back on:** new project → run `supabase/schema.sql` → set the three Supabase
    vars + `NEXT_PUBLIC_CMS_ENABLED=true` + `OWNER_EMAIL` on Vercel → redeploy.
  - **Schema**: `supabase/schema.sql` — paste into the Supabase SQL editor, **idempotent and
    re-runnable on the live DB** (the PGlite tests apply it twice, and also upgrade the previous
    committed version, `tests/fixtures/schema-v0.sql`). Roles are **owner > admin** only — the
    `editor` role is retired (re-running migrates editors to admin). Tables: `profiles`,
    `invitations`, `auth_tokens`, `projects`, `services`, `team_members`, single-row
    `site_settings`, `products`, `jobs`, `posts`, `leads`, `chat_sessions`/`chat_messages`,
    `content_revisions`, `activity_log`, `security_limits`, `status_reports`, single-row
    `site_revision`; the public `work` bucket (raster only — **no SVG**, it can carry script —
    10 MB cap). Policy role checks go through `SECURITY DEFINER` helpers (`is_staff()`,
    `is_owner()`; `is_admin()` is kept as an alias of `is_staff()`) — reading a role inside a
    policy on `profiles` would otherwise recurse infinitely.
  - **`is_staff()`** = a profile exists, **not `disabled`**, and the JWT's `iat` ≥
    `floor(sessions_valid_after)`. That last clause is how disable/reset sign someone out
    *immediately*: `revoke_user_sessions(uid)` (service role) deletes their `auth.sessions` /
    refresh tokens and stamps `sessions_valid_after`, so even a still-valid access token stops
    being staff. (`floor`, not a rounding cast — signing back in within the same second as a
    reset must not be rejected.) No end user can write `sessions_valid_after`, or a revoked token
    could reset it to 'epoch' and un-revoke itself.
  - **History & audit (triggers — can't be forgotten or faked by a client):** every content table
    (projects, services, team_members, site_settings, products, jobs, posts) has three:
    `content_revisions` snapshots the OLD row on update/delete — **one per editor per 5-minute
    window**, deletes always, no-op saves skipped, pruned to the newest **20** per item;
    `activity_log` records create/update/publish/unpublish/delete (updates coalesced per editor
    per item over 5 min; `detail.label` survives deletion); and a statement-level bump of
    `site_revision.rev` (in the `supabase_realtime` publication — Phase 2's live-update ping).
    `entity_type` is the table name, `entity_id` the id as text (`'1'` for site_settings).
    Team/auth/restore/inbox/chat events are inserted by **server code with the service role**
    (`logActivity()` in `app/admin/_lib/server.ts`, never-throwing). No client insert policy.
  - **Who gets a profile (= panel access)** — `handle_new_user()`: the **first** account becomes
    `owner` (advisory-locked so two simultaneous sign-ups can't both win); after that a profile is
    created **only if an open `invitations` row matches the email**, always as `admin`. No
    invitation ⇒ an auth user with **zero** access (`getAccess()` → `"no-access"` screen).
    Profiles are created when the invitee **redeems** their link (the server calls
    `admin.auth.admin.createUser` then), not at invite time.
    ⚠️ Never read a role from `raw_user_meta_data` — it is **user-controlled** (`signUp({ options:
    { data: { role: "admin" } } })`). The old trigger did exactly that, so anyone could sign up at
    `/admin/login` and become admin. Fixed 2026-10; if you re-deploy an old schema, that hole
    comes back.
  - **`profiles_guard` trigger** (before insert/update/delete): signed-in users may change only
    `full_name`; changing a role or `disabled` needs `is_owner()`, never on yourself, and `owner`
    can't be granted, removed or deleted except by the service role / SQL editor. A CHECK
    (`profiles_owner_not_disabled`) means **even the service role can't disable the owner**. (The
    old `profiles_update_self` policy let an editor set their own role to `owner`.)
    `has_owner()` is a `security definer` fn granted to anon so the login page can hide
    first-run owner creation once an owner exists.
  - **Owner anchored to `OWNER_EMAIL`** (server-only env): `getAccess()` treats the signed-in,
    confirmed `OWNER_EMAIL` user as owner and re-asserts their profile with the service role, so
    **nothing in the database can lock the owner out** (a deleted/altered row is repaired on next
    sign-in). First-run "Create the owner account" appears only when `OWNER_EMAIL` is set and
    `has_owner()` is false, and the server action refuses any other address. No code calls
    `signUp` any more — **turn off "Allow new users to sign up" in Supabase**; every user is
    created through the service-role admin API, which ignores that setting. Grants are decided
    only by what the user's *own* client can read (`is_staff()`); the service-role read in
    `getAccess()` only explains a refusal (not invited / disabled / session ended).
  - **Clients** (`lib/supabase/`): `client.ts` (browser), `server.ts` (cookies, for the panel),
    `admin.ts` (service-role, `import "server-only"` so leaking it to the client is a *build*
    error), and **`public.ts` — a cookie-less anon client used for all public reads**. That last
    one matters: the `@supabase/ssr` server client calls `cookies()`, which would opt `/projects`
    out of static rendering. With it, `/projects` stays `○ Static` and `[slug]` stays SSG, and the
    admin's `revalidatePath()` calls invalidate them on publish.
  - **Read layer**: `lib/cms.ts` (`getProjects`, `getProjectBySlug`, `getSiteContent`) —
    Supabase when configured, **falling back field-by-field** to `lib/work.ts` / `lib/site.ts`
    on missing config, error, or empty result. A blank cell in the panel can't blank the site.
    ⚠️ **Every read must fail fast**: `.abortSignal(AbortSignal.timeout(3000)).retry(false)`
    (abortSignal *before* `.single()`), and the getters are wrapped in React `cache()`.
    postgrest-js **retries failed GET/HEAD 3x with 1s/2s/4s backoff by default**, so an
    unreachable project cost ~7 s per query — the footer's two sequential reads made every dev
    render take ~14 s (measured 2026-10-02, when the project's `*.supabase.co` host stopped
    resolving). A fallback is only worth having if it's quick.
  - **Auth**: `middleware.ts` does Supabase work **only in its `/admin` branch** — nothing public
    reads the session, and `getUser()` is a Supabase round-trip for anyone holding a session
    cookie, so running it site-wide taxed every page view by a signed-in teammate. (The matcher is
    wider now, but only for the path-only locale routing — see Internationalisation.) The admin
    branch refreshes the session cookie (the only place that can), gates
    `/admin/**` (bouncing to `/admin/login?next=…`, internal redirects only) and stamps an
    `x-admin-pathname` header the layout uses to render `/admin/auth/*` without the shell.
    `lib/supabase/server.ts` → `getAccess()` returns `signed-out | no-access | ok`; `getProfile()`
    returns `null` without a profile row (there is **no** synthetic "editor" fallback any more).
    Login offers first-run owner sign-up **only while `has_owner()` is false**.
  - **Invites & password reset use OUR OWN tokens, sent through Resend** — not Supabase's mailer
    (~2/hour, project owner only) and **not** `generateLink()`. Why: `generateLink`'s
    `hashed_token` is the same value Supabase stores in `auth.users` / `auth.one_time_tokens`, so
    anyone able to read the auth schema (service key, SQL editor, a backup) could redeem a pending
    invite or a live reset — including the owner's. Now: raw = `randomToken()` goes in the link,
    **only `sha256Hex(raw)` is stored** in `auth_tokens` (service-role only), purpose
    `invite` (**7 days**) or `reset` (**1 hour**); issuing a new one deletes that person's open
    token, so the old link dies. Helpers + TTLs: `app/admin/auth/_lib/tokens.ts`.
    - Invite (owner only, `app/admin/team-actions.ts`): upsert `invitations` → issue token →
      email `${origin}/admin/auth/confirm?t=<raw>` (branded, `lib/admin-email.ts`) or return the
      link to copy. **No auth user is created until redemption.** Resend = new token; revoke =
      delete invitation + tokens. The bulk "Invite the MykTech team" card still works.
    - Reset (`requestPasswordReset`, unauthenticated): same "if an account exists…" reply, work
      done in `after()`, durable limits (8 / 15 min per IP hash, 3 / 15 min per email hash,
      `failClosed`). The owner can also "Send reset" to a member from Team — the owner never
      chooses or sees a password; whoever opens the link does.
    - ⚠️ **The emailed link must not consume the token on GET.** `/admin/auth/confirm` only
      *peeks* (not used, not expired) and renders the right form; link previewers
      (Messenger/Viber/Slack/Outlook) GET every URL, and "copy the link and send it by chat" is
      the main path until Resend is verified. It also strips `?t` from the address bar and sets
      `no-referrer`. The POST (`redeemToken`) checks the form and a per-IP limit *before* touching
      the token (a typo never burns a link), then consumes it atomically
      (`UPDATE … WHERE token_hash=… AND consumed_at IS NULL AND expires_at > now() RETURNING`) →
      invite: `createUser({ email_confirm: true })`; reset: `updateUserById` +
      `revoke_user_sessions`. If Supabase rejects the password the token is released for retry.
    - **Sign-in after redeem / owner creation happens in the browser**, not the action: a server
      action that sets cookies makes Next re-render the current page in the response — on the
      confirm page that re-render is "link already used", which wiped the success state before
      the redirect. The action returns `signInAs` and the form signs in with the browser client.
    - Old `/admin/auth/verify` and `/admin/auth/set-password` are gone; "Forgot password?" is
      the way to change a password. Unknown `/admin/*` URLs hit `app/admin/[...missing]` so they
      404 inside the admin segment (see that file for why — React #418 otherwise).
    - ⚠️ **Resend sandbox**: with `onboarding@resend.dev` Resend delivers only to the Resend
      account owner. Anyone else's invite returns an error, so the UI **always** offers the link
      to copy. Verify a domain, then set `ADMIN_FROM_EMAIL` (double-quoted — the apostrophe).
    - Link origin: admin actions use the request's own origin (local/preview work); the
      **unauthenticated** reset only uses an allow-listed host (`site.url`, localhost, `VERCEL_*`)
      — building it from the `Host` header would be password-reset poisoning.
    - Link lifetime is ours (above) — Supabase's "Email OTP Expiration" no longer applies, and
      `AUTH_LINK_EXPIRY_HOURS` is gone.
  - **Panel**: overview (real counts, each query independent so one missing table shows "Not set
    up"), projects CRUD (publish toggle, reorder, delete, **"import the 5 existing projects"** to
    seed from `lib/work.ts`), team (**owner-only** management: invite, bulk "Invite the Rally's
    Tech team" card pre-filled from the public roster, resend / copy link / revoke, disable /
    enable, send reset, remove — needs `SUPABASE_SERVICE_ROLE_KEY`; admins see a read-only
    list), and site settings (brand/contact/availability/socials). `requireOwner()` sits next to
    `requireStaff()` in `app/admin/_lib/server.ts`.
    Screenshot uploads go **browser → Storage directly**, not through a server action, whose body
    is capped ~1MB and would reject most captures.
  - **Products / Careers / Blog** (`/admin/products`, `/admin/careers`, `/admin/blog`; actions in
    `app/admin/catalog-actions.ts`; forms share `components/admin/CatalogFormParts.tsx`). Public
    reads in `lib/cms.ts`: `getProducts`, `getJobs` (open roles only), `getJobBySlug` (includes
    closed roles, flagged `.closed`, so a stale link says "closed" instead of 404ing), `getPosts`
    (summaries, no body), `getPostBySlug`, `getPublishedSections()` (drives nav/footer links).
    **Fallbacks are empty, never invented** — there is no static list for these. CTA URLs must be
    `https://…` or an internal `/path` (`ctaUrl` in `_lib/validators.ts`); "closed" is decided at
    render time in Asia/Manila, so pages listing roles need a timed `revalidate`. Job applications
    land in the inbox as kind `application` with `job_id` (own card + filter; never threaded).
  - **Upload cleanup** (`app/admin/_lib/storage.ts` → `removeOrphanedUploads`): a Storage file is
    deleted only if **nothing** references it — projects (img, img2, gallery), products (image,
    gallery), posts (cover, and URLs in the markdown body) **and every `content_revisions`
    snapshot**, so a restore can never point at a deleted file. Deletes nothing if any source
    fails to read. Consequence: a replaced/deleted image survives until its revisions are pruned.
    ⚠️ **Supabase silently caps a response at 1000 rows.** `content_revisions` passes that at
    ~50 items × 20 revisions, and an image referenced only in the unread rows would have looked
    unused and been deleted — reads now request an exact count and page when truncated. Any new
    "is this referenced anywhere" check must do the same. The **unused-image sweep** (card on
    `/admin/settings`) finds files only *pruned* revisions referenced; it skips uploads < 24 h old
    and re-scans on the server before deleting.
  - **Autosave** (Phase 3) — every editor saves ~1 s after typing stops, via the Route Handler
    `app/api/admin/autosave/route.ts` (stable URL: a Server Action would break mid-edit on
    deploy). Client hook `components/admin/useAutosave.ts`; pure logic `app/admin/_lib/autosave.ts`;
    parsers shared with the explicit Save in `app/admin/_lib/schemas.ts` (so the two can't drift);
    the version-checked write in `app/admin/_lib/content.ts` → `guardedUpdate()`.
    - **Optimistic concurrency**: every write — autosave AND Save — is
      `.eq("id").eq("updated_at", <exact string Postgres returned>)`. Never round-trip that value
      through `new Date()` (JS drops the microseconds and nothing would ever match). 0 rows →
      re-read: gone → "deleted in another tab"; newer → **conflict banner** ("Reload their
      version" / "Keep mine"); a stale Save never overwrites.
    - Only dirty fields are sent, as whole **save units** (gallery rows, CTA label+url… travel
      together — `SAVE_UNITS`). A field stays dirty until a save that *included it* succeeds; failed
      saves retry 2 s → 5 s → 15 s → 30 s and on `online`/focus (the reference cleared pending edits
      before the response, so a blip lost them). Flushes with `keepalive` on hide/unload.
    - **Never autosaved: `slug`, `published`, `sort_order`** (`NEVER_AUTOSAVE`) — a half-typed slug
      on a live item would break its URL mid-typing; publishing is deliberate. The status says
      "URL, visibility or order changes need Save"; typing a Save-only field back to its loaded
      value clears that (baseline recorded by the hook — **not** `defaultValue`, which React keeps
      in step with a controlled input on every keystroke).
    - ⚠️ **Never set React state synchronously inside a native `input` listener** on a form with
      controlled inputs. The browser runs a microtask checkpoint between listeners, so React
      flushes that render *before* its own handler sees the event and re-renders the controlled
      input with its old value — the first keystroke into an untouched slug box was silently
      dropped. Keep refs synchronous; defer the state update (`syncFlagsSoon`).
  - **History, restore, activity** (Phase 3) — `HistoryPanel` on every edit page (inline toggle on
    services/roster cards): field-level before → after per revision, Preview, Restore. Loaded on
    open through staff-only actions (`app/admin/history-actions.ts`). Restore
    (`app/admin/_lib/history-restore.ts`, one sequence shared with the tests): snapshot filtered
    to current columns, never writes `id`/`created_at`/`updated_at`; refuses a taken slug before
    writing; takes a **pre-restore backup** with the service role (marked by a reserved
    `__revision` key inside the snapshot — no schema column for it yet), deleted again if the
    write fails; writes through the user's own session so the trigger records the real actor;
    prunes to 20 and hands pruned images to cleanup; logs `content.restore`; then a **full
    reload** (the forms are uncontrolled and carry a concurrency token — never `router.refresh()`).
    "Recently deleted" on each list page re-inserts a DELETE snapshot with its original id
    (capped at 25; deleted items' revisions are never pruned). `/admin/activity` + an overview
    card render `activity_log` as sentences (Asia/Manila, formatted on the server), filterable by
    section / person / kind, paged by id; chat/limiter noise is excluded by query.
  - Panel plumbing worth knowing: `app/admin/_lib/server.ts` maps Postgres errors to plain English
    (`23505` slug taken, RLS denial, missing table, paused project); **every write checks affected
    rows** — RLS-blocked updates "succeed" with 0 rows, which used to show "Saved."; forms submit
    through `useFormAction` (`components/admin/ui.tsx`) because React 19 resets a `<form action>`
    after the action and a failed submit used to wipe the project form; `AdminNav` is a server
    wrapper (inbox badge) around client `AdminNavLinks`.
  - **Added later** (actions in `app/admin/content-actions.ts`, a second `"use server"` module so
    `actions.ts` stays readable — the tiny `ok`/`fail` helpers are duplicated because a
    `"use server"` file may only export async functions):
    - **`/admin/services`** — the six offerings were `lib/services.ts` only, so they couldn't be
      changed without a deploy. ⚠️ Services render on the landing page, `/services` **and the
      footer of every page**, so `saveService` must `revalidatePath("/[lang]", "layout")` too —
      miss that and an edit looks saved while the footer keeps the old list. (Since the i18n move,
      every public `revalidatePath` uses the **route pattern** — `"/[lang]/projects/[slug]",
      "page"` — not a URL, so both locales refresh.) `ServicesGalaxy` and
      `ServiceIndex` now take `services` as a **prop** (they're client components; their server
      parents fetch).
    - **`/admin/roster`** — the PUBLIC team on `/about`, previously hardcoded in `TeamRoster.tsx`
      (now a prop; fallback lives in `lib/team.ts`). **Deliberately separate from `/admin/team`**:
      that page is panel *logins*. Conflating them would mean handing someone a password to appear
      on the site, or leaking a contractor's login onto the marketing page.
    - **`/admin/inbox`** — contact submissions **and** chat transcripts in one list (`leads`).
      Each chat exchange writes a new row, so `app/admin/_lib/inbox.ts` groups rows into one
      thread per conversation (handle/delete act on the whole thread).
      Writes go through `lib/leads.ts` with the **service-role** client, because `leads` has no
      public insert policy — so a leaked anon key can neither spam it nor read anyone's enquiry.
      Every function there is **non-throwing**: the contact form's job is to email and the bot's
      is to answer, so a paused database must never turn a delivered enquiry into an error banner.
      Contact leads are still emailed; this is a record, not a replacement.
      **Replies** (Phase 4, `app/admin/inbox-actions.ts` → `replyToLead`): plain text + escaped
      HTML via Resend, from `ADMIN_FROM_EMAIL`/`CONTACT_FROM_EMAIL`, `replyTo` = `CONTACT_TO_EMAIL`
      so the conversation continues in the real mailbox; 30 / hour per staff member. Every attempt
      is stored in `lead_replies` (`sent` + Resend id, or `failed` + reason); `replied_at` and the
      `inbox.reply` log line only on a real send. On failure (e.g. the Resend sandbox) the panel
      says why and offers "Copy reply" + a prefilled `mailto:` — it never claims a send it didn't make.
    - Both new tables treat **empty as "not set up"**, not "no content" — `lib/cms.ts` serves the
      static list, and each page offers an *import* rather than showing a scary warning.
  - **Two root layouts, one document shell.** `app/[lang]/layout.tsx` (public, `<html lang>` per
    locale, wraps `SiteChrome`) and `app/admin/layout.tsx` (`<html lang="en">`, no marketing
    chrome) both render `components/DocumentShell.tsx` — fonts, `globals.css`, `ThemeScript`
    first in `<head>`, `ThemeProvider`, analytics — so they can't drift. `SiteChrome` (Lenis,
    preloader, ambient, nav, footer) is no longer pathname-gated: the admin simply never renders
    inside it. `Footer` is passed to it **as a prop** (client component ← async server component).
    The per-route fade (`template.tsx`) is public-only.
- **Security headers** (Phase 4, `lib/security-headers.mjs` → `next.config.mjs` `headers()`):
  CSP + nosniff + `strict-origin-when-cross-origin` + Permissions-Policy + COOP on every route;
  `/admin` adds `X-Frame-Options: DENY`, `frame-src 'none'`, `noindex`. **No nonce**: a nonce
  makes every page render per request and loses static rendering, so `script-src` allows
  `'unsafe-inline'` (Next's inline RSC payload, ThemeScript); everything else is locked down
  (`connect-src` = self + the Supabase origin https/wss from env; `img-src`/`frame-src` https:
  because CMS images and live previews may be any host). HSTS and `upgrade-insecure-requests` are
  gated on `VERCEL=1`, **not** `NODE_ENV` — a local `next start` is "production" over http.
  `tests/security-headers.test.ts` scans the source for every absolute origin; a new external
  origin fails it until it's allowed or listed as never-fetched. zod 4 tries `new Function` in
  the browser, so `lib/contact-schema.ts` sets `z.config({ jitless: true })` client-side.
- **PWA** (Phase 4): `app/manifest.ts`, icons in `public/icons/` (`scripts/build-icons.mjs`, from the logo monogram),
  `public/sw.js` registered from the public layout only, after `whenReady()` + idle, production
  only. Precaches `/offline.html` (self-contained, bilingual) + icons + wordmarks;
  `/_next/static/**` cache-first; navigations network-first → offline page; **never touches**
  `/admin`, `/api`, `/_next/image`, `/_vercel`, or RSC requests (a cached RSC payload from
  another build breaks hydration). A new SW waits — `skipWaiting` only on a posted message, no
  `clients.claim()`. Bump the cache version string in `sw.js` when its strategy changes.
  **Standalone launch skips the Preloader**: the blocking head script sets
  `<html data-display="standalone">` before paint, CSS hides `.pl`, and `Preloader` calls
  `markReady()` at once so everything gated on `whenReady()` still starts.
- **Embed probe** (Phase 4, `lib/net/`): after a project's `live_url` is saved (explicit Save or
  autosave), `after()` probes it — **SSRF-guarded** (`safe-fetch.ts`: https on the default port
  only, private/loopback/link-local/CGNAT/ULA/mapped addresses refused, the IP validated **inside
  the connection's own DNS lookup** so rebinding can't slip through, ≤3 redirects each
  re-checked, 5 s, headers only) — and stores `embeddable` / `embed_reason` / `embed_checked_at`
  from `frame-ancestors` (wins) or `X-Frame-Options`. ⚠️ `touch_updated_at` and the
  revision/activity triggers **ignore probe-only updates** — otherwise the background write would
  move `updated_at` and every editor would see a false autosave conflict.
- **Robustness**: `app/[lang]/not-found.tsx` + `error.tsx` (branded, in the visitor's language);
  unmatched public URLs reach them through `app/[lang]/[...missing]` with a real 404 status
  (middleware rewrites everything public under `/en`/`/fil`, and there is no root not-found any
  more — junk paths *with a file extension* get Next's bare 404). The panel has its own
  `app/admin/{loading,error,not-found,[...missing]}`.
- **Analytics**: `@vercel/analytics` (via `components/SiteAnalytics.tsx`, which **drops every
  `/admin` page view** — panel traffic isn't marketing data, and the invite/reset URL carries a
  one-time token; it's a client wrapper only because `beforeSend` is a function a server layout
  can't pass) + `@vercel/speed-insights` in layout (the `/_vercel/*/script.js` 404s seen under
  local `next start` are expected — they resolve on Vercel).
- **Contact details are deliberately empty (2026-10-19, client decision).** No domain ⇒ no
  company mailbox, so `site.email` is `""`; the scaffold's phone and street address were
  placeholders, so `site.phone` is `""` and the address is just "Dipolog City, Zamboanga del
  Norte, Philippines"; `socials` is `[]` (they pointed at linkedin.com etc., not profiles).
  Every renderer treats them as optional: footer (shows "Send us a message" →
  `/contact#contact`), `/contact` (no email line; the form is the way in), JSON-LD (fields omitted, not emitted empty), the chat prompt (says outright there
  is no public email — otherwise the model guesses one), and every error string has a
  `…NoEmail` variant. Fill them in `lib/site.ts` (or Site settings, once the CMS is on) when
  real ones exist; nothing else needs to change.
- **Canonical origin** (`site.url`): `NEXT_PUBLIC_SITE_URL` → the Vercel production domain
  (`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_PROJECT_PRODUCTION_URL`, provided by
  Vercel) → localhost. It used to fall back to `https://mykt.studio`, a domain nobody owns, so
  production canonicals, sitemap and OG URLs all pointed at a dead host. Live production
  domain (2026-10-19): **`https://rallys-tech.vercel.app`** — what Vercel reports, so it's
  what canonicals now use (also reachable as
  `it-company-website-jamescalunsag13-9119s-projects.vercel.app`;
  `it-company-website.vercel.app` is somebody else's site). In-page `#anchors` now work with
  Lenis (`anchors` option + the route-change reset honours a fragment).
- **To finalize (content)**: real email/phone/socials when they exist; a domain (then verify
  it in Resend and set `NEXT_PUBLIC_SITE_URL`).
- ⚠️ **The project URLs are placeholders.** Checked 2026-08-03: `famecrm.app`,
  `physiopano.com`, `rallys-equities.com` and `coffee.shop` are all **NXDOMAIN**, and `shm.app`
  is a GoDaddy *domain-for-sale* parking page. So `liveUrl` is deliberately unset on every
  project — `url` is only a display label in the browser chrome, and there are no outbound links
  to dead domains. The live-embed path is built and ready: set `liveUrl` (in `lib/work.ts`, or the
  Live URL field in the admin) and that project's preview becomes a real iframe. **Re-check before
  setting one** — don't point the portfolio at a parked domain.

### Internationalisation (English / Filipino)
- **What's translated: UI chrome only** — nav, footer chrome, CTAs, form labels/messages, section
  eyebrows and short titles, the 404/error pages, the chat widget's own UI, aria-labels, meta
  titles. **Not** CMS content (projects, services, team, posts stay in whatever language an editor
  wrote) and not long-form marketing copy (hero headline/subline, section intros, ProcessDeck,
  the belief sentence) or the model's chat replies. Filipino strings are **drafts — have a native
  speaker review** `lib/i18n/messages/fil/*`.
- **Routing**: everything public is under `app/[lang]/` and prerendered for `en` + `fil`.
  `middleware.ts` → `resolveLocaleRoute()` (`lib/i18n/route.ts`, pure, unit-tested, Edge-safe):
  `/fil/*` served as-is; `/en/*` → **308** to the unprefixed URL (one canonical English address);
  everything else → **rewrite** to `/en/…`. Path-only — no DB, no cookies, **no Accept-Language
  redirect** (uncacheable, and it hides pages from crawlers). Switching language is a full
  navigation between two prerendered pages; there is no client-side locale state.
- ⚠️ **Never set `dynamicParams = false` on a public page.** In Next 15 such a page 404s after
  *on-demand* revalidation: the admin's `revalidatePath("/[lang]", "layout")` (or the status
  ingest's revalidation) regenerates it, the regeneration throws `Internal: NoFallbackError`, and
  it serves a 404 — or stale HTML that fails to hydrate — until the next deploy. The Phase 2 i18n
  move had put it on the nine single-param pages; that shipped to production, and any admin save
  could knock home / `/projects` / `/fil/*` offline (found and fixed 2026-10-03). It isn't needed:
  middleware only lets `/en/*` and `/fil/*` reach `app/[lang]`, and `pageLocale()` 404s anything
  else. `tests/static-params.test.ts` enforces both. (`[slug]` pages also keep the default `true`
  so content published after a deploy renders on demand.)
- **API**: server `getDictionary(lang)` → `{ t }` (typed keys, `{var}` interpolation, fallback
  lang → en → key); page pattern `const lang = await pageLocale(params)` (404s junk locales) and
  `...localeMetadata(lang, "/path")` in `generateMetadata` (canonical, hreflang en/fil/x-default,
  `og:locale` en_PH/fil_PH, explicit OG images — a page-level `openGraph` replaces the inherited
  one wholesale). Client: `useI18n()` → `{ lang, t, href }`, only the `common` namespace is
  shipped to the browser. Links: `localizePath(lang, href)` / `switchLocalePath()`
  (`lib/i18n/paths`) — leaves hashes, mailto/tel, external, `/admin`, `/api` alone.
- **Namespaces**: `common` (client chrome), `site` (server chrome), `catalog` (products, careers,
  blog). A new nav item needs an entry in `lib/site.ts` `nav`, a key in `lib/i18n/nav.ts`, and
  `nav.*` strings in **both** `common` files — `tests/i18n.test.ts` fails otherwise, and also on
  any key used at a call site but missing in either language (the reference project once shipped
  raw keys like "nav.file" to production).
- `usePathname()` is `/en/…` while prerendering and `/…` in the browser — anything comparing
  paths must go through `stripLocale`, or it hydrates differently.
- **Nav**: every link lives in the burger menu (since 2026-11-05), so the old link-count /
  breakpoint juggling is gone — Products / Careers / Blog just add rows. While open the menu is a
  `role="dialog"`: page frozen (`pauseSmoothScroll` + overflow), `main`/`footer` made `inert`, focus
  to the first link, Esc / scrim / route change close it and focus returns to the burger. Keep
  the top bar to burger · logo · toggle (390 px). Nav links also light up on detail pages
  (`/projects/x` → Work).

### Products / Careers / Blog — public pages
- Each is **structurally distinct** from the rest of the site: Products = stacked enclosed "spec
  sheets" (mono header strip, numbered features, the screenshot on a plate at native size);
  Careers = a scannable roles table (Role / Team / Location / Type / Workplace), role pages with a
  spec rail + numbered sections + the apply form at `#apply`; Blog = latest post featured large,
  then a contents-page archive, and a narrow (`68ch`) article column styled by `.prose-rt` in
  `globals.css`. Empty sections render a warm empty state, `noindex`, and drop out of the sitemap.
  A closed role renders a "closed" panel instead of the form and is `noindex`.
- **CMS images use a plain `<img>` (`components/catalog/parts.tsx` → `Shot`), not `next/image`**:
  the admin's `imagePath` allows any https host, but `remotePatterns` only allows the Supabase one.
- **Markdown** (`lib/markdown.tsx`, no dependency): headings, emphasis, code, lists, quotes, rules,
  links, images — **never raw HTML** (it renders as literal text; `dangerouslySetInnerHTML` is
  banned). Links only for `https:`, `mailto:` and internal paths (others become plain text);
  images only if they pass `imagePath`. Written with `createElement`, not JSX, because Vitest
  transforms with the tsconfig's `jsx: "preserve"` and couldn't import a JSX module.
  `tests/markdown.test.ts` holds the XSS cases.
- **Apply** (`app/api/apply/route.ts`, Route Handler for the same deploy-skew reason as contact;
  schema `lib/apply-schema.ts`): honeypot + time-trap (silent success, nothing charged) → durable
  limit **3 / 10 min per IP + 100 / day** → `getJobById` re-checks the role is published and open
  (closed → 410; **database unreachable → 503, never "closed"** — `getJobById` distinguishes
  `null` from `undefined` for exactly that) → `saveApplicationLead` + `sendApplicationEmail` in
  parallel; success if either worked. The role title is written into the message because `job_id`
  goes null if the role is later deleted. The handler returns codes, never sentences — the form
  maps them to dictionary strings. **No confirmation email to applicants** (it would let anyone
  make the site email arbitrary addresses) and **no file uploads** (CVs are links).
- Careers, the sitemap and the `[lang]` layout use `revalidate = 3600`: "closed" is decided at
  render time in Asia/Manila, so pages must refresh hourly even without an admin edit.

### /status (Phase 4)
- **Exists only while the CMS is on** (it's stored there) — otherwise 404, and out of the
  footer, sitemap and ⌘K.
- Public `app/[lang]/status` (both locales, ISR 1 h + on-demand): latest test run and Lighthouse
  scores per page × mobile/desktop, labelled **"CI runner, no GPU — performance is a lower
  bound"** (the WebGL hero renders in software there; see the SwiftShader trap). Never invents
  or rounds up; stale after 7 days; empty state per panel. Footer link + sitemap + ⌘K entry.
- Ingest `POST /api/status/ingest`: `Authorization: Bearer <STATUS_INGEST_TOKEN>` — its **own**
  random secret (≥ 32 chars), compared via sha256 + `timingSafeEqual`; rate limit **after**
  auth (before it, anyone could burn the budget and lock CI out); JSON ≤ 64 KB; strict zod
  (`lib/status-schema.ts`, shared with the CI builder `scripts/ci/status-payload.mjs`). Upserts
  `status_reports` (service role) and revalidates the page.
- CI `.github/workflows/status.yml`: tests on push to main (posted with `!cancelled()`, so a
  failing suite is still reported); Lighthouse on a successful **Production** `deployment_status`,
  weekly, and manually. Needs repo secret `STATUS_INGEST_TOKEN` (same value in Vercel) and repo
  variable `SITE_URL` — a public origin that doesn't redirect: **Vercel Deployment Protection
  on Production would block both the audits and the POST.** The Lighthouse job is **skipped**
  (not failed) while `SITE_URL` is unset — leave it unset while the CMS is off, since there is
  nowhere to store a report.

### Search (⌘K) & live updates
- **Palette**: always-loaded part is only `components/search/SearchLauncher.tsx` (key + event
  listeners); `SearchPalette.tsx` is a separate chunk loaded on first open, inert until
  `whenReady()`. ⌘K/Ctrl+K anywhere, `/` when not typing; `openSearch()`
  (`components/search/open.ts`, a window event) for buttons — though since 2026-11-05 no
  button calls it: search is a hidden, keyboard-only feature (client request). Index from `lib/search.ts`
  (`buildSearchIndex(lang)`, ~1.7 KB gzipped, a test fails over 10 KB — it rides in every page's
  RSC payload) built in the `[lang]` layout; scoring in `lib/search-score.ts` (all tokens must
  match; title prefix > word-start > substring > keywords > body; accent-insensitive). While open,
  Lenis is paused via `pauseSmoothScroll()`/`resumeSmoothScroll()` (exported from
  `fx/SmoothScroll.tsx`, nesting-counted) and the list carries `data-lenis-prevent`. Services and
  team results link to the page, not `#anchors` — SmoothScroll scrolls to top on route change.
- **Live updates** (`components/LiveUpdates.tsx`, logic in `lib/live-updates.ts`): a published edit
  reaches already-open pages via `router.refresh()` when `site_revision.rev` rises. Three layers:
  a **30 s poll only while visible** straight to Supabase REST with the anon key (no Vercel
  invocation; backs off 60→300 s after failures); a check on `visibilitychange`/`focus`;
  **Realtime** after `whenReady()` + idle, on a **session-less** client (the cookie client would
  subscribe with a teammate's admin session), closed while the tab is hidden so idle tabs don't
  hold one of the free plan's 200 connections, and dropped for the page view on any channel error
  (polling carries on). Refresh is debounced 2 s (max 8 s) so it lands after the admin's
  `revalidatePath`. No rAF, nothing finer than 750 ms, no timers while hidden, nothing at all
  without `NEXT_PUBLIC_SUPABASE_URL`.

### Tests (`npm test` — Vitest + PGlite)
`tests/` — **41 suites, 905 tests** (2026-11-05). Philosophy (from the reference project): test
derived logic and data integrity, not rendering — the valuable tests catch a *silent* failure.
- **PGlite runs the real `supabase/schema.sql`** (Postgres in WASM) with Supabase stubs
  (`tests/helpers/db.ts`: roles incl. `service_role` with `bypassrls`, `auth.users`/`sessions`,
  `auth.uid()`/`auth.jwt()` from GUCs, `storage`, the realtime publication, and Supabase's
  default privileges — anon/authenticated get ALL on new tables, so only RLS or an explicit
  revoke can make a test pass, never a missing grant). Helpers: `asAnon`, `asUser(claims)`,
  `asService`. Suites cover: idempotent apply + upgrade from `tests/fixtures/schema-v0.sql`, the
  limiter, RLS on every private table, the team guard + revocation, `handle_new_user`,
  revisions/activity/site_revision triggers.
- **PGlite is single-connection**, so "concurrent" limiter calls really run in sequence; a test
  therefore also asserts the RPC is written as an atomic `ON CONFLICT … DO UPDATE` (a
  read-then-write version would pass the burst test and still race in production).
- **`action-guards.test.ts`** parses every `"use server"` module (TS AST): each exported action
  must reach `requireStaff`/`requireOwner`, except an allow-list with a reason per entry
  (`signOut`, `requestPasswordReset`, `redeemToken`, `createOwnerAccount`) — and every public one
  but `signOut` must call `consumeLimit`. This is the real Next.js risk: a Server Action is
  directly POST-able regardless of middleware. (The reference's 12-function cap test and
  duplicated per-handler session block do **not** apply to Next.js — Vercel bundles Next routes
  into a few functions, and shared `lib/` imports are traced normally.)
  `route-guards.test.ts` does the same for every Route Handler under `app/api/admin/**`
  (must call `requireStaffForRoute`, which answers 401/403 JSON instead of redirecting).
- Also: data integrity (every image path in `lib/work.ts` exists under `public/` — catches the
  OneDrive deletions; no `data:image/`; no `liveUrl`), the screenshot validator
  (`app/admin/_lib/validators.ts` — rejects `data:`, `javascript:`, `//host` **and `/\host`**,
  which browsers read as `//host`), inbox threading, the guard helpers.
- Tests are **included in `tsconfig`**, so `next build` typechecks them — a test-only type error
  blocks a deploy (deliberate: tests never go unchecked). `server-only` is aliased to an empty
  module in `vitest.config.ts`. `maxWorkers: 2` — each DB suite holds ~400 MB.

### Verification
`scripts/verify.mjs` drives headless Chromium (Playwright) over all routes at desktop
(1440) + mobile (390): checks console errors, horizontal overflow, and writes screenshots
to `.verify/`. Playwright is **not** a project dependency (it would break the Vercel build);
the script installs it on demand with `--no-save`, so it never touches `package.json`/lockfile.
Run: `npm run build && npx next start -p 3100 &` then `npm run verify`.

### Performance — what was actually heavy, and the trap in measuring it
⚠️ **The figures below were measured on v1** (WebGL hero + glyph scenes + an 80-frame showreel).
v2 removed all three — the landing page has **no WebGL and no showreel**, and `three`,
`@react-three/fiber` and `drei` are uninstalled — so it should be lighter, but it has **not been
re-measured**. Re-run a GPU-enabled probe before quoting numbers.

v1 history: the landing page went from **7.99 MB / 210 requests** to **0.81 MB / 43** without
scrolling (**3.11 MB / 139** full scroll); long tasks 13 (2288 ms) → 3 (417 ms); JS heap
48–87 MB → 14–17 MB. Most of that was the showreel frames and over-tessellated WebGL geometry,
both now gone.

- ⚠️ **Never benchmark this site in default headless Chromium.** It falls back to SwiftShader
  (software rendering), which makes blur/canvas/3D work look catastrophic — it reported
  ~250 ms median frames and 24 s of blocking, i.e. ~4 fps, none of it real. Launch with
  `chromium.launch({ args: ["--enable-gpu", "--ignore-gpu-blocklist"] })` and the same page is a
  flat **16.7 ms (60 fps)**. Frame rate was never the problem; **bytes and blocked interaction
  were**. Throttle CPU (`Emulation.setCPUThrottlingRate`, 4x) to model a real mid-range machine.
- **The hero reel** (`CurvedReel`) is CSS 3D: one `rotateY` keyframe per tile, so it composites.
  Its images are ~1000px WebP derivatives in `public/work/hero/` (**~0.21 MB for all 11**, built by
  `node scripts/build-hero-shots.mjs`; `tests/hero-shots.test.ts` fails if one is missing), fetched
  only once `whenReady()` fires, and it pauses off screen via `observeVisible()`. Still to check
  with a GPU probe: the layer count of ~160 strip `<img>`s.
- **The 2026-10 lag pass** (client: "I can feel it in my cursor"). Removed every *constant* cost:
  the JS cursor + its `mix-blend-mode`, the ambient spotlight's forever-rAF, `filter: blur()` on
  animated full-viewport layers, the z-40 grain over everything, `backdrop-blur` on the fixed nav
  (now `bg-paper/[0.93]`), looping repaint-only animations (`.beam`, SVG icon dashes), and
  per-move `getBoundingClientRect()` (magnetic button, roster orb, footer wordmark). Measured on a
  real AMD iGPU — 4x CPU: idle hero 27 → 64 fps, mouse-move input delay p95 54 → 19 ms, landing
  scroll 14 → 34 fps. **Rule going forward: nothing may run every frame while the visitor is
  doing nothing.** `BeliefScrub`'s per-word opacity is the next scroll-cost candidate.
- **Remaining lever**: time-to-interactive is *hydration*-bound. A floor of ~1.15 s (hero starts) / 1.95 s (scroll unlocks) is the
  `Preloader`, which by client request has **no sessionStorage gate** and replays on every full
  load. Shortening it (or gating repeat loads within a session) is the biggest remaining win — but
  it's a client decision, not a technical one.

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
- Reusable components: `Button`, `Section` (+ `SectionHeader`, `Eyebrow`), `Nav`, `Footer`,
  `Reveal` (motion wrapper), `fx/KeySwitch`, `Icon`.
- Footer is a **feature**, not a sign-off: an ivory keycap "Start a project" band (the **one**
  closing call to action site-wide — pages no longer end in their own CTA row), interactive giant
  wordmark (`FooterWordmark` — the outlined `Logo` mask, ghosted, with flat gold inking in under
  the cursor: a soft "hole" in an ink cover clipped to the letters, moved by `transform` only and
  measured once per hover; `.fw` CSS; touch = quiet static fill; full-bleed — the mark is vector),
  availability status + live PHT clock, `fx/BackToTop` (uses `scrollToTop()` exported from
  `fx/SmoothScroll`). The "Developed by…" credit line was removed (2026-11-04).
- `text-accent`/`bg-accent` are Tailwind v4 `@utility`s (not plain classes) so
  `hover:`/`group-hover:` variants work — keep it that way. Since v2 they mean **gold-ink text**
  and **a flat gold fill**.
- **Theme-safe styling**: reach for the semantic tokens (`bg-paper`, `bg-surface`, `text-ink`,
  `border-mist`, `text-slatey`). A literal `bg-white` / hex won't flip in dark mode. Inside a
  `.band`, `white/N` alphas are fine. See **Dark mode** above. ⚠️ `ink-900` flips too (near-white
  in dark mode) — something meant to be black in both themes needs `.band` (as `LivePreview`'s
  frame does), not `bg-ink-900` alone.

## CMS upgrade — phased port of the "Portfolio Web v2" admin (in progress)
Porting the admin/backend strengths of the client's personal-portfolio project
(`C:\Users\User\OneDrive\Documents\Portfolio Web\v2`, Vite + Vercel Functions) onto **this**
stack — mapped, not copied. Decisions (2026-10-02): keep per-item tables (not the reference's
single JSON row — it stores all projects in one section, which is coarser than this); keep
Supabase Auth and meet the reference's intent on top; roles owner + admin; `/fil` URL prefix for
English/Filipino UI chrome; new pages Blog, Careers, Products; Vercel Hobby; no GitHub panel,
no changelog, no press kit, no Spotify/resume/"Now"/Word-document visuals.
- ✅ **Phase 1 — data model, migrations, tests**: schema above, our own hashed tokens,
  `OWNER_EMAIL`, owner-only team, disable/revoke, durable limiter, IP hashing, Vitest + PGlite.
- ✅ **Phase 2 — public pages**: `/fil` i18n; products/jobs/posts read layer + admin editors
  (pulled forward from Phase 3 so the pages can be filled); public Products / Careers (apply) /
  Blog; nav links via `getPublishedSections()`; ⌘K search; live updates. Verified against a local
  PostgREST stand-in with sample data (both locales, 390/1440, nav fit, palette, an end-to-end
  application) — the live project had no catalog content yet.
- ✅ **Phase 3 — admin console**: autosave with conflict detection on all seven editors;
  history panel + restore (pre-restore backup, pruning feeds upload cleanup); recently deleted;
  activity feed; unused-image sweep. Verified in a browser against a local in-memory Supabase
  stand-in with sign-in (two-tab conflict, offline recovery, restore, deleted-item restore).
  Optional schema follow-ups suggested, not applied: a `content_revisions.kind` column to
  replace the `__revision` marker, and a scheduled purge of revisions for long-deleted items.
- ✅ **Phase 4**: chat human takeover, inbox email replies, `GEMINI_MODEL`, security headers,
  PWA, SSRF-guarded embed probe, `/status` + CI ingest. Verified in a browser against local
  Supabase **and Gemini** stand-ins (takeover both ways, reply failure fallback, CSP sweep, offline
  navigation, the probe refusing 127.0.0.1). Also fixed two older bugs this testing surfaced:
  `dynamicParams = false` 404ing pages after revalidation (was live on main), and nested links
  in the `/projects` index breaking hydration once a project has a `liveUrl`.
  ~~Needs `supabase/schema.sql` re-run~~ — moot: that project was deleted (see "Currently OFF"
  under Admin panel). A new project gets the full schema in one run.

## Open questions / notes
- MCP tooling requested ("ui ux pro max", "design thinking", "glif-mcp") is **not yet
  configured** in this environment — need install details/keys from the user. Available
  design MCPs: `magic` (21st.dev), `stitch`, `canva`, `figma`.
