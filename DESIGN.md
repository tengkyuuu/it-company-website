# MykTech — Design System v2 ("Monochrome + Gold")

> **Status: DRAFT, 2026-11-04.** This replaces the v1 look (slate neutrals and a
> magenta→rose→gold gradient over gooey `MeshDistortMaterial` blobs). Nothing in code has
> changed yet. The build order is in [`docs/redesign-plan.md`](docs/redesign-plan.md).
> **All decisions locked 2026-11-04** (dark mode kept; type is Geist-only; keycaps become
> the services visual; hero = 21st.dev "Tilted Grid Hero" fed with our project
> screenshots). Until Phase 1 ships, CLAUDE.md's "Brand" section describes what is **live**,
> and this file describes the **target**.

---

## 1. The idea in one line

**A black-and-white studio with one gold spark — and a keycap you can press.**

v1 said "we innovate" with colour and goo. v2 says it with restraint. There is high-contrast
editorial type on white, solid black bands for weight, and gold only where something matters.
The keycap is the one playful, tactile object, and it is the brand's signature.

What we keep from v1, because it was never the problem:
- The logo lockup (`components/Logo.tsx`). It is already monochrome and follows `currentColor`.
- Real data only: no invented stats, testimonials or client names.
- Editorial pacing: each landing section is structurally different from the next.
- The motion rules: soft easing, nothing that runs every frame while the visitor is idle, and
  reduced-motion respected.
- **The keycaps** (see §5). They are not optional.

What goes:
- The magenta / mauve / rose hues, and the gradient as a concept. Gold is a **flat** colour now.
- `MeshDistortMaterial` blobs: the hero "constellation" core and the `GlyphScene` morphs.
- Gradient "glow" clouds (`.accent-glow`, the corner glows, `AmbientBackground`'s coloured
  radials).
- Per-project colour tints on `WorkGallery` plates. The screenshots carry their own colour.
- Brand-colour logos on hover in `TechMarquee`.

---

## 2. Colour: 70 / 20 / 10

| Share | Role | What it covers |
|------:|------|----------------|
| **70%** | **White** | Page background, cards, most of every viewport |
| **20%** | **Black** | Type, `.band` sections (footer, belief band, the final process card, work plates, the video frame), the primary button |
| **10%** | **Gold** | The spark. This is a **ceiling, not a target**. |

The ratio is measured **per page, by area**, roughly the way you would squint at a screenshot.
It is not counted per component. A page made of white sections with one black band and
a gold keycap is on-system.

### Tokens: light theme (the default)

The neutrals are a **warm** grey ramp (Tailwind's "stone"). Pure #FFF and #000 next to gold
read cold and cheap, while a hint of warmth makes the gold look like metal rather than mustard.

| Token | Hex | Use | Contrast |
|-------|-----|-----|----------|
| `paper` | `#FAFAF9` | page background | — |
| `surface` | `#FFFFFF` | raised cards, inputs | — |
| `mist` | `#E7E5E4` | borders, hairlines, dividers | decorative |
| `slatey` | `#78716C` | secondary text, captions | 4.6:1 on paper ✅ |
| `ink` | `#0C0A09` | headings, body, black bands | 19:1 on paper ✅ |
| `gold` | `#D4AF37` | marks, rules, keycap, gold fills, gold **on black** | 9.4:1 on ink ✅ · **2.1:1 on white ❌ never small text** |
| `gold-ink` | `#8C6D1F` | gold-coloured **text on white** (links, one emphasis word) | 4.9:1 on surface ✅ |
| `gold-press` | `#B8962E` | hover/pressed state of gold fills | — |

Token names stay the same as v1 (`paper`, `surface`, `mist`, `slatey`, `ink`), so the
hundreds of existing `bg-paper` / `text-ink` usages flip on their own. Only the values change.

### Dark mode (kept, client confirmed)

The theme toggle stays. In dark mode the ratio **inverts**: black 70 / white 20 / gold 10.

| Token | Dark hex |
|-------|----------|
| `paper` | `#0C0A09` |
| `surface` | `#1C1917` |
| `mist` | `#292524` |
| `slatey` | `#A8A29E` (7.7:1) |
| `ink` | `#F5F5F4` |
| `gold` / `gold-ink` | `#D4AF37` (both, because gold text is legible on black) |

`.band` keeps its meaning ("dark in both themes"). In dark mode a band sits one step above
the page (`#1C1917`), as it does today.

### Gold rules

1. **One gold moment per viewport.** If two things on screen are gold, remove one. (This
   carries over v1's "one gradient" rule.)
2. Gold is **never** small text on white. Use `gold-ink` for that, sparingly.
3. Gold is **flat**: no gradients, no metallic sheen, no glow halos. The only allowed
   exception is the keycap's under-glow (§5).
4. Places gold may go: the hero keycap, the primary CTA's hover state, one emphasised word
   per headline, active nav underline, focus rings, numerals in `ProcessDeck`, the hairline
   rule under a section eyebrow, and the PWA/favicon monogram.

---

## 3. Typography (decided: one family)

Syne is retired. It is quirky and belonged to the "gooey" era. The client left the choice to
us, so the site uses **Geist only**:

- **Display:** **Geist Sans 500–600**, very large and tightly tracked (−0.045em), the way the
  hero reference sets its headline. Medium weight at huge sizes reads calm and expensive,
  where bold reads loud.
- **Body / UI:** Geist Sans 400–500, line-height 1.6.
- **Labels / eyebrows / numerals / code chips:** Geist Mono, small, uppercase, tracked +0.12em.
  This is the one "we build software" signal, and it is quiet.
- **The serif lives only in the logo** (Cinzel, already outlined in the lockup). Keeping it out
  of the page makes the mark the only classical element on screen, so it stands out. A second
  display face beside it would compete.

Why not a serif accent or Cinzel eyebrows: tracked serif caps in gold on black reads as a law
firm or a hotel. Paired with gold, a clean grotesk keeps it an IT company.

Scale (desktop / mobile): display `clamp(3.5rem, 9vw, 9rem)`, h2 `clamp(2.25rem, 5vw, 4.5rem)`,
h3 `1.5rem`, body `1.0625rem`, small `0.875rem`, label `0.6875rem`.

---

## 4. Shape, space, depth

- **Radii (sharpened 2026-11-04, client):** `rounded-xl` 10px, `rounded-2xl` 14px (cards,
  frames), `rounded-3xl` 16px, `rounded-lg` 8px; buttons stay `9999px` (pill). Set as tokens in
  `@theme`, so one edit there moves every rectangle.
- **Borders:** 1px `mist`. On black bands, `white/10`.
- **Shadows:** almost none. Depth comes from black-on-white and from the keycap. Use one soft
  shadow token, `0 1px 2px rgb(12 10 9 / 0.06), 0 8px 24px rgb(12 10 9 / 0.06)`, for raised
  cards only.
- **Grain:** keep the static grain texture behind content, monochrome. It stops large white
  areas from looking flat on screen.
- **Spacing:** 8px base. Section padding `clamp(6rem, 12vw, 10rem)` vertical. White space is
  the 70%. Don't fill it.

---

## 5. The keycaps (signature, must survive)

All 19 current placements stay, and the component, press physics, CSS and reduced-motion
behaviour stay as they are. What changes is **colour**: the six hue-rotated resins
(red / gold / plum / rose / sky / mint) are off-palette. They collapse to three:

| Resin | Look | When |
|-------|------|------|
| **`gold`** | the accent resin | **The hero** and at most one other key on a page (it counts against the gold budget) |
| **`onyx`** | near-black translucent resin | Default on white sections |
| **`ivory`** | milky white / frosted resin | Default on black bands |

- **The under-glow is always gold**, whichever resin is on top. Pressing any key "lights it up"
  in the brand colour, so the gold appears only on interaction.
  (Implementation note: the glow currently sits inside `.ks-capwrap` and inherits the cap's
  filter. It must move outside that filter so an onyx cap can still glow gold.)
- The source render is red resin. Onyx/ivory are made with CSS filters
  (`grayscale` + `brightness`/`contrast`). **If the filtered result looks dull, re-render the
  cap** as a neutral source rather than fighting filters. Verify visually before committing.
- **Keycaps are the services visual (decided).** `ServicesGalaxy`'s sticky left panel drops
  `GlyphScene` (the goo) for **one large keycap per service** (~220–280px), with the service's
  `Icon` printed on the cap as its legend. As a service's row crosses mid-viewport, its key
  **presses** (the same `:active` travel, triggered by a class) and its under-glow lights gold,
  while the previous key releases. Six keys, one legend each. On mobile, each stacked row gets a
  small key beside its title. All of this is CSS and needs no WebGL, so the second WebGL
  context disappears from the landing page entirely.
  - The legend has to sit on the cap's top face in the render's perspective (a `transform`
    skew/scale measured against `keycap.avif`, the same way `.ks-capwrap`'s offsets were
    measured). Prototype it in Phase 0 alongside the onyx/ivory filters.

---

## 6. Hero: the curved reel of our own work

**Reference:** 21st.dev, ruixen.ui, "Tilted Grid Hero"
(https://21st.dev/@ruixen.ui/components/tilted-grid-hero). Its code was retrieved
2026-11-04 and is to be ported (not installed through the shadcn CLI; this repo has no
`components/ui` or `cn` setup).

**What it does:** one row of image tiles streams right→left around the inside of a cylinder.
The centre tile faces you flat, and the ends curve toward the viewer and fade into the page.
It is pure CSS 3D: each tile is cut into 16 vertical strips, each strip a flat facet of
the arc, and one `rotateY` keyframe per tile moves it. The only JS is a `ResizeObserver` that
sizes the loop, plus a handler that hands a tile its next image as it wraps out of sight.
It is compositor-only, uses no WebGL, needs no dependencies, and reduced-motion pauses it into
a still.

**Our version:**
- **Tiles = our real project screenshots** (`lib/work.ts` `img` + `img2`, the CMS projects
  when the CMS is on): nine shots across the five projects, interleaved so neighbouring tiles
  come from different projects. Log-in screens are left out because they are near-identical.
- **`aspectRatio` = 2.07**, the screenshots' native shape (1536×743), **not** the reference's
  16:9 default. `object-cover` then crops nothing, which honours the "never crop or upscale
  the screenshots" rule. Tiles render ~240px tall, so they are **downscaled** from 743px and
  stay crisp.
- Each tile gets a thin browser-chrome top bar (three dots + hairline), matching
  `WorkGallery`/`LivePreview`, so they read as *software*, not stock photos.
- Layout (100svh, no 175vh sticky runway any more):
  - top: eyebrow in Geist Mono · the headline, black, Geist 500, huge, with **one word**
    available for gold
  - middle: the curved reel (`axis` ≈ 55%, `tileHeight` ≈ 26%, `curve` 70–80, `fade` 12)
  - bottom: subline, two CTAs (primary black pill → gold on hover; "See our work" outline)
    and the **gold keycap**, which is the hero's one gold moment
  - small print kept from v1: the live PHT clock + Dipolog coordinates, bottom corners,
    Geist Mono
- **Dark mode:** the page goes black and the screenshots glow on it. No other changes needed.
- **Mobile:** the reference already caps a tile at 55% of the width so neighbours still show.
  Keep that. The headline sits above and the CTAs below; the clock/coords hide.
- Tiles stay `aria-hidden` and non-interactive (as in the reference); "See our work" is the
  way in. The real project links live in `WorkGallery` and `/projects`.

**Performance, the one real cost.** The reference pre-fetches **every** image at mount.
Three of our sources are PNGs (`rallys-equities.png` 787 KB, `coffee-shop*.png` ~510 KB
each), so the full set is ~2 MB, against a **0.81 MB** no-scroll budget for the whole landing
page. So the hero gets its own **hero-sized derivatives**: ~1000px-wide WebP at quality ~72
(~40–70 KB each), generated by a script into `public/work/hero/`, so all nine cost roughly
0.5 MB. Also:
- start the animation after `whenReady()` (the opening sequence owns the first ~2s)
- pause it (`animation-play-state`) while the hero is off-screen, using the same
  `observeVisible()` both WebGL scenes use. It is compositor-only, but "nothing runs while the
  visitor isn't looking" still applies.
- 16 strips × ~10 tiles ≈ 160 `<img>` elements, all pointing at nine URLs. The browser decodes
  each image once. Check that layer count and memory stay sane in the GPU-enabled probe.

Copy stays real. The headline/subline are marketing copy, English in both locales.

---

## 7. Motion (unchanged principles, new flavour)

- Easing `cubic-bezier(0.22, 1, 0.36, 1)`, 300–700ms. Reduced-motion = instant.
- Swap colour-driven effects for **contrast-driven** ones: text inking from `mist` to `ink`
  (BeliefScrub already does this), black bands wiping in, hairline rules drawing on.
- Gold should **arrive**, not loop. It fades or draws in once when its element enters view.
- Preloader: same choreography on black. The final state stays monochrome. Decide in Phase 4
  whether the light sweep goes gold.

---

## 8. Component checklist (what each piece becomes)

| Piece | v2 treatment |
|-------|--------------|
| `Nav` | white bar `bg-paper/[0.93]`, black logo, active link = gold underline |
| `Button` primary | black pill, white text → hover: gold fill, black text |
| `Button` secondary | 1px `ink` outline pill → hover: black fill |
| `TechMarquee` | monochrome logos at 50% → hover 100% ink. **No brand colours.** |
| `VideoReveal` | black frame (already `.band`). Check the reel frames for purple. |
| `Hero` | the curved screenshot reel (§6), replacing `HeroScene` |
| `ServicesGalaxy` | white section, black type; one large keycap per service presses as its row activates (§5) |
| `WorkGallery` | black plates, no per-project tint, screenshots provide the colour |
| `ProcessDeck` | white cards with black numerals; the last card black with a gold numeral |
| `BeliefScrub` | black band, words ink from `#44403C` to white, one word gold |
| `Footer` | black band, outlined wordmark; under the cursor it inks **white** (not gradient) |
| Inner pages | same tokens. Page headers lose their corner glows. |
| Admin | follows tokens automatically. No bespoke work. |
| Icons / OG / offline page | monogram gold on `#0C0A09` |
