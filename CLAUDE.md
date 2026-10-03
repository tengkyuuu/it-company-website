# R Ally's Tech — Company Website

Marketing website for **R Ally's Tech**, an IT company. Prototype. Goal: a sleek,
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

Every public page exists in **English (unprefixed: `/projects`) and Filipino (`/fil/projects`)**
— routes live under `app/[lang]/`; see "Internationalisation" below. Plus CMS-driven
**Products** (`/products`, `/products/[slug]`), **Careers** (`/careers`, `/careers/[slug]` with
an apply form) and **Blog** (`/blog`, `/blog/[slug]`) — their nav/footer links appear only once
something is published (`getPublishedSections()`); see "Products / Careers / Blog".

**HQ:** Dipolog City, Zamboanga del Norte (single source of truth: `lib/site.ts`).
**Hero:** immersive WebGL "constellation" (no photo). **Selected Work = real client projects**
(FameCRM, PhysioPano, SHM, Rally's Equities, Coffee Shop) — screenshots in `public/work/`,
data in `lib/work.ts`.
**Team (real):** Jhade Banquiao (Project Lead), James Calunsag (Frontend), Haron Diniay
(Backend), Ralph Andilab (Mobile), Sean Jacinto (AI Automation), Hasnain Fayyaz (Marketing).
**Nav:** logo mark (`public/brand/logo.png`) + `R Ally's Tech` wordmark, top-left.

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

### Logo — a generated vector lockup, used as a CSS mask
The wordmark is **`R Ally's Tech`** set as a *ransom-note* lockup: every glyph in a different
typeface. It is **generated, not artwork** — `scripts/build-wordmark.mjs` fetches each family
from Google Fonts, converts the glyph to **outlines**, and composes one SVG:

`R` Abril Fatface · `A` Bebas Neue · `l` Courier Prime · `l` Playfair Display ·
`y` Pacifico · `'` Playfair Display · `s` Righteous · `T` Archivo Black ·
`e` Caveat · `c` Zilla Slab · `h` Lobster

- **To restyle**: edit the `LOCKUP` map in `scripts/build-wordmark.mjs`, re-run
  `node scripts/build-wordmark.mjs`, then paste the printed ratio into `aspect-ratio` in
  `globals.css` (it appears **twice** — `.wm/.wm-outline` and `.pl-stage`).
  Needs `npm install --no-save opentype.js` (build-time only — deliberately not a dependency,
  same reasoning as Playwright in `scripts/verify.mjs`).
- Glyphs are normalised by **cap height**, not font size, so wildly different faces sit
  optically consistent on a shared baseline instead of one dwarfing the next.
- **`components/Logo.tsx`** is the only way to render it. Two generated assets, both painted as
  a **CSS `mask` over `currentColor`** (not `<img>`), so the mark inherits the text colour and
  follows light/dark and `.band` for free:
  - `public/brand/wordmark.svg` — the filled silhouette
  - `public/brand/wordmark-outline.svg` — the same paths **stroked** instead of filled, i.e. a
    real ring. Use `variant="outline"`. This exists because CSS `drop-shadow` is applied
    *before* masking, so a shadow-based outline on a masked element gets clipped straight off.
  - Sizing: the element carries the wordmark's aspect ratio — set **one** axis (`h-7`, `w-full`).
  - Used in `Nav` (h-26px, beside `logo.png`), `FooterWordmark`, `Preloader`, and the admin chrome.
- ✅ **It's vector, so there is no upscale limit.** The old raster's ~820px blur cap is gone and
  `FooterWordmark` is full-bleed again.
- **The apostrophe is the thing that bites now** (the old name's `()` did). Three places:
  - **SQL**: must be doubled — `default 'R Ally''s Tech'` in `supabase/schema.sql`.
  - **dotenv**: use **double** quotes. `CONTACT_FROM_EMAIL='...R Ally's Tech...'` ends the value
    early and truncates the name to `R Ally`.
  - **Email `From`**: no quoting needed any more — an apostrophe is valid RFC 5322 atext, so
    `R Ally's Tech <…>` is three legal atoms. (The old name *had* to be quoted.)
- ⚠️ Never place the wordmark inside an `uppercase` / `text-transform` context — bitten twice
  already under the old name (Hero badge, Preloader label). The mask can't be transformed,
  which is another reason to prefer `Logo` over set type.
- ⚠️ **`public/brand/logo.png` is still the old "KT" shield** and is rendered in `Nav` beside
  the wordmark. It contradicts the new brand — needs new artwork (or removal from `Nav`).
  `public/brand/mykTech().png` is the old client artwork, now unreferenced; kept, not deleted.
- Technical identifiers keep the old spelling on purpose — `mykt-website`, `mykt.studio`,
  `mykt-theme`, `mykt-preloaded`, `mykt:ready`. Those are **not** the brand name; renaming them
  would break a storage key, the preloader event, and the domain. Leave them alone.
- `components/Wordmark.tsx` and `components/KMark.tsx` (the old Syne + gradient-K type
  treatment) were **deleted** in this rebrand — both were unused and encoded the old name.

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
  "Inline" by Letters from Sweden. Used for the `R Ally's Tech` wordmark + big headings (Hero h1,
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
- `VideoReveal` defers its 80-frame preload until `mykt:ready` (with a 4s backstop) so those
  requests stop competing with the sequence.
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
- **Three.js + @react-three/fiber + drei** — two scenes in `components/three/`:
  `HeroScene` (constellation) and `GlyphScene` (per-service morphing glyphs). Gating util:
  `lib/webgl.ts` (`wants3D()` = desktop + WebGL + no reduced-motion; CSS gradient fallback otherwise;
  the WebGL probe runs **once**, is cached and its context released — it used to leak a context
  per call; `observeVisible()` is the shared on-screen observer both scenes use to pause).
- **Geist** font (`geist` package: `GeistSans`, `GeistMono`)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — auth + Postgres + Storage behind
  the `/admin` CMS. Entirely optional: with no env vars the site serves the static content.
- Brand assets live in `public/` (logo, mockups, `work/` tiles).
- Run: `npm run dev` → http://localhost:3000

### Motion architecture (the "awwwards" layer)
- `components/fx/`: `AmbientBackground` (**static** gray `radial-gradient` clouds + a depth veil
  + the grain texture, all *behind* content — no `filter`, no animation, no cursor tracking; it is
  drawn once and only composited), `SmoothScroll` (Lenis↔GSAP, `lerp: 0.12`, `autoRaf: false` so
  the GSAP ticker is the only loop driving it; `pauseSmoothScroll()`/`resumeSmoothScroll()` for
  overlays like the search palette),
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
- `components/landing/`: `TechMarquee` (speed reacts to scroll velocity; plays only while on
  screen), `VideoReveal` (80-frame webp sequence in `public/brand/reel/` — pins + expands to
  full-bleed while **scrubbing with scroll**; mobile = contained loop),
  `ServicesGalaxy` (**follows the theme** — `bg-surface text-ink`, so it is light in light
  mode and an elevated slate in dark; deliberately does NOT use `.band`, and therefore
  carries no hardcoded `white/XX` alphas — use the neutral ramp inside it. Left panel
  sticky with `GlyphScene` — IntersectionObserver
  marks the row crossing mid-viewport "active", glyph + label crossfade; mobile stacks with
  `Icon`s, which animate only on `.group` hover and rest fully drawn), `WorkGallery` (pinned horizontal scroll via `gsap.matchMedia`; each
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
  `[slug]` detail = header + spec rail (`<dl>`) + highlights + stack chips, a large preview,
  **The story** (numbered Challenge / Approach / Outcome), a Results row, a client testimonial,
  a Screens grid (secondary shot + gallery; mobile shots in phone frames), and wrapping
  prev/next. **Every case-study section renders only when filled in** — the static
  `lib/work.ts` entries have none of them, by design (never invent client names, quotes or
  metrics). The fields live on `projects` (`client`, `industry`, `timeline`, `services[]`,
  `team[]`, `stack[]`, `challenge`, `approach`, `outcome`, `results` jsonb, `gallery` jsonb,
  `testimonial_*`), are edited in `components/admin/ProjectForm.tsx` +
  `ProjectCaseStudy.tsx` (repeating rows submit as parallel `getAll()` arrays), and are also fed
  to the chatbot via `lib/chat-context.ts`. `components/projects/LivePreview` renders browser chrome around either
  a real **live `<iframe>`** (only when the project has a `liveUrl`) or the screenshot:
  IntersectionObserver-gated mount, rendered at 1440px then CSS-scaled via ResizeObserver so you
  see the *desktop* layout, pointer-events off until "Interact" is clicked (otherwise the iframe
  eats the page scroll), and the screenshot poster is **never** removed on a timeout — a site that
  refuses framing can't be detected cross-origin, so "Open ↗" is always present.
- `Button` is **magnetic** (springs toward the cursor on mouse; measures its rect once on
  `pointerenter`, never per move). The filmic **grain** lives inside `AmbientBackground`,
  *behind* content (it used to be a fixed z-40 layer over everything, composited every frame).
- **No custom cursor — deliberately.** A JS-drawn dot/ring (`fx/Cursor`, removed 2026-10)
  always trails the OS cursor by ≥1 frame and stutters whenever the main thread is busy, and its
  `mix-blend-mode: difference` re-blended everything beneath it every frame. That was the "I can
  feel it in my cursor" lag the client reported. Don't bring one back.
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
- `.beam` utility (`globals.css`, via `@property --beam-angle`) draws an accent border-comet —
  used sparingly (the contact card). It **rests as a still arc and travels only on hover**: an
  animated conic gradient can't be composited, so a looping one repainted the card every frame.
  One accent moment per view.
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
  **Env** (`.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` —
  set in `.env.local` and on Vercel. Until set, submit returns a graceful error banner.
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
  - **Env**: `GEMINI_API_KEY` (server-only, never `NEXT_PUBLIC_`). Unset ⇒ 503 + "chat isn't
    configured yet" in the widget; the rest of the site is unaffected.
- **Admin panel / CMS** (`/admin`, Supabase) — **entirely optional**. With the env vars unset
  the marketing site builds and renders exactly as before and `/admin` shows setup steps
  (`components/admin/SetupNotice`); nothing hard-depends on a database.
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
      delete invitation + tokens. The bulk "Invite the Rally's Tech team" card still works.
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
    - Both new tables treat **empty as "not set up"**, not "no content" — `lib/cms.ts` serves the
      static list, and each page offers an *import* rather than showing a scary warning.
  - **Two root layouts, one document shell.** `app/[lang]/layout.tsx` (public, `<html lang>` per
    locale, wraps `SiteChrome`) and `app/admin/layout.tsx` (`<html lang="en">`, no marketing
    chrome) both render `components/DocumentShell.tsx` — fonts, `globals.css`, `ThemeScript`
    first in `<head>`, `ThemeProvider`, analytics — so they can't drift. `SiteChrome` (Lenis,
    preloader, ambient, nav, footer) is no longer pathname-gated: the admin simply never renders
    inside it. `Footer` is passed to it **as a prop** (client component ← async server component).
    The per-route fade (`template.tsx`) is public-only.
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
- **To finalize (content)**: real social URLs + verified email/phone in `lib/site.ts`;
  verify the Resend sending domain.
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
- **`dynamicParams`**: single-param pages set it `false`; `[slug]` pages keep the default `true`
  **on purpose** — Next applies it per route, so `false` anywhere up the tree (e.g. the `[lang]`
  layout) would 404 every project published after the deploy.
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
- **Nav fit is link-count dependent.** Hamburger below `lg` with the five core links; once any
  CMS section is published (6+ links) the inline row starts at **`xl`** with tighter padding; with
  7+ links the desktop "Get in touch" button is dropped (it duplicates Location, which is in the
  row; it stays in the mobile sheet). Measured 2026-10-02 with all three sections published: 8
  links + search + EN/FIL + theme fit at 1280 px in both languages, hamburger at 1024. The bar is
  capped at `max-w-6xl`, so wider screens add no room — re-check before adding a 9th item. The
  switcher lives in the desktop bar, the mobile sheet and the footer — never the mobile top bar
  (390 px overflow). Nav links also light up on detail pages (`/projects/x` → Projects).

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

### Search (⌘K) & live updates
- **Palette**: always-loaded part is only `components/search/SearchLauncher.tsx` (key + event
  listeners); `SearchPalette.tsx` is a separate chunk loaded on first open, inert until
  `whenReady()`. ⌘K/Ctrl+K anywhere, `/` when not typing; `openSearch()`
  (`components/search/open.ts`, a window event) for buttons. Index from `lib/search.ts`
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
`tests/` — **25 suites, 581 tests** (2026-10-03, after Phase 3). Philosophy (from the reference project): test
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
The landing page used to ship **7.99 MB / 210 requests**. Now: **0.81 MB / 43 requests** if the
visitor doesn't scroll, **3.11 MB / 139** for a full scroll. Main-thread blocking on a normal
desktop went from 13 long tasks (2288 ms) to 3 (417 ms); JS heap from 48–87 MB to 14–17 MB.

- ⚠️ **Never benchmark this site in default headless Chromium.** It falls back to SwiftShader
  (software rendering), which makes the blur/WebGL/canvas work look catastrophic — it reported
  ~250 ms median frames and 24 s of blocking, i.e. ~4 fps, none of it real. Launch with
  `chromium.launch({ args: ["--enable-gpu", "--ignore-gpu-blocklist"] })` and the same page is a
  flat **16.7 ms (60 fps)**. Frame rate was never the problem; **bytes and blocked interaction
  were**. Throttle CPU (`Emulation.setCPUThrottlingRate`, 4x) to model a real mid-range machine.
- **The showreel was the bulk of it.** `public/brand/reel/` is now **80 frames at 1280×960**
  (was 160 at 1600×1200): 7.07 MB → 2.14 MB. Frame *count* is a **memory** decision, not just
  bandwidth — `VideoReveal` holds every frame as a decoded bitmap, so the old set had a ceiling of
  160 × 1600 × 1200 × 4 B ≈ **1.14 GB** of bitmap vs ~0.37 GB now. Re-encode with
  `node scripts/build-reel.mjs`, then update `FRAME_COUNT`/`FRAME_W`/`FRAME_H` to match.
- **The preload is gated twice**: `mykt:ready` (don't starve the opening sequence) **and** an
  IntersectionObserver (don't spend 2 MB on someone who never scrolls there). It loads every 4th
  frame first so the scrub is usable at once, then backfills on `requestIdleCallback`; `draw()`
  falls back to the nearest *arrived* frame, which is what makes the coarse pass look right.
- ⚠️ **`rootMargin` on that observer must be in PIXELS.** `"150%"` = 1350 px, which already
  overlaps the section at scroll 0 and silently defeated the gate (all 80 frames still loaded).
  It's `"400px"`: measured, the section starts **805 px** below the fold at 1440×900. Note it is
  only **130 px** down at 390×844 (mobile hero is 100svh, not 175vh), so **mobile still starts
  immediately** — no percentage or pixel value satisfies both. The coarse-first pass is what
  keeps that acceptable.
- **Geometry was wildly over-tessellated.** `icosahedronGeometry(r, 64)` is **84,500 faces**, and
  `MeshDistortMaterial` runs a vertex shader over all of them every frame. Both scenes had one:
  hero core → detail 20 (8,820), Glyph blob → detail 16 (5,780). Torus/knot segment counts came
  down similarly. Detail above ~20 is invisible under a smooth distort — don't raise it back.
- **DPR is capped at `[1, 1.25]`** on both `<Canvas>`es, and drei `PerformanceMonitor` drops it
  to 1 on sustained low fps (it's restarted on every resume so a pause doesn't read as a slow frame).
- **`GlyphScene` mounts only when its section is near** (`show3d && near`). It's far below the
  fold, and booting a second WebGL context + compiling shaders during the hydration burst was
  contention for work nobody could see.
- **Both canvases render only while on screen** — r3f `frameloop` flips to `"demand"` offscreen
  (and the hero stays idle until `mykt:ready`, after one hidden frame to compile shaders). An r3f
  canvas otherwise draws every frame forever once mounted.
- **The 2026-10 lag pass** (client: "I can feel it in my cursor"). Removed every *constant* cost:
  the JS cursor + its `mix-blend-mode`, the ambient spotlight's forever-rAF, `filter: blur()` on
  animated full-viewport layers, the z-40 grain over everything, `backdrop-blur` on the fixed nav
  (now `bg-paper/[0.93]`), looping repaint-only animations (`.beam`, SVG icon dashes), per-move
  `getBoundingClientRect()` (magnetic button, roster orb, footer wordmark), and the 140px shadow
  on the resizing `VideoReveal` frame. Measured on a real AMD iGPU, same probe before/after —
  4x CPU: idle hero 27 → 64 fps, mouse-move input delay p95 54 → 19 ms, landing scroll 14 → 34
  fps with long tasks 366 → 23; 1x: idle mid-page main-thread busy ~70% → ~26%, scroll jank
  frames 14% → 1.5%. **Rule going forward: nothing may run every frame while the visitor is
  doing nothing.** What's left during scroll is spread across layout/paint/commit with no single
  hotspot (BeliefScrub per-word opacity and WorkGallery plates are the next candidates).
- **Remaining lever**: time-to-interactive on the landing page is now *hydration*-bound, ~2.6 s
  desktop / ~3.7 s at 4x CPU. A floor of ~2.14 s of that is the `Preloader`, which by client
  request has **no sessionStorage gate** and so replays on every full load. Shortening it (or
  gating repeat loads within a session) is the single biggest remaining win — but it's a client
  decision, not a technical one.

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
  under the cursor: a soft "hole" in an ink cover clipped to the letters, moved by `transform`
  only and measured once per hover; `.fw` CSS; touch = quiet static fill; full-bleed — the mark
  is vector), availability status + live PHT clock, social pill chips,
  `fx/BackToTop` (uses `scrollToTop()` exported from `fx/SmoothScroll`), and a
  `Developed by R Ally's Tech · for R Ally's Tech` credit line at the very bottom.
- `text-accent`/`bg-accent` are Tailwind v4 `@utility`s (not plain classes) so
  `hover:`/`group-hover:` variants work — keep it that way.
- **Theme-safe styling**: reach for the semantic tokens (`bg-paper`, `bg-surface`, `text-ink`,
  `border-mist`, `text-slatey`). A literal `bg-white` / hex won't flip in dark mode. Inside a
  `.band`, `white/N` alphas are fine. See **Dark mode** above.

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
- ⏳ **Phase 4**: chat human takeover (`chat_sessions.mode`), real inbox replies via Resend,
  `/status` (GitHub Action → `STATUS_INGEST_TOKEN`, its own secret; label Lighthouse — CI has
  no GPU), live-URL embed probe at save time (SSRF-guarded), PWA (shell-only, RSC-aware, don't
  replay the Preloader on install), security headers, Gemini model as env.

## Open questions / notes
- MCP tooling requested ("ui ux pro max", "design thinking", "glif-mcp") is **not yet
  configured** in this environment — need install details/keys from the user. Available
  design MCPs: `magic` (21st.dev), `stitch`, `canva`, `figma`.
