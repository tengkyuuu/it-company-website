# Redesign plan: v2 "Monochrome + Gold"

The target look is in [`DESIGN.md`](../DESIGN.md). This file is the order of work. Each phase
ships on its own branch and is verified (`npm test`, `next build` to `.next-verify`,
`npm run verify` at 1440 + 390, both themes, both locales) before the next one starts.

Today's footprint: the accent gradient is used **~150 times across ~70 files**, there are
**2** `MeshDistortMaterial` scenes and **19** keycap placements.

---

## Phase 0: Inputs and decisions (blocking)

- [x] **Hero reference**: ruixen.ui "Tilted Grid Hero" (id 36749). Code retrieved and saved
      as `docs/reference/tilted-grid-hero.tsx.txt`, so it never needs re-downloading.
- [x] Decisions (2026-11-04): dark mode **kept**; type = **Geist only** (Sans + Mono; the
      serif lives only in the logo); keycaps **are** the services visual.
- [ ] Prototype on a scratch page, before anything depends on it:
      - **onyx / ivory keycap filters**. If they look dull, get a neutral keycap source render.
      - **a legend on the cap's top face** (a service `Icon` transformed into the render's
        perspective) and a **class-driven press** (`.is-pressed` = the `:active` travel).

## Phase 1: Tokens (the whole site flips at once)

The goal is to change values, not markup, so every page moves together and nothing breaks.

- [ ] `app/globals.css`: replace the `--color-*` ramp (light, dark, `.band`) with the stone
      neutrals. Add `--color-gold`, `--color-gold-ink`, `--color-gold-press`.
- [ ] Redefine the `text-accent` / `bg-accent` `@utility`s as **flat gold** (they are gradient
      clips today). All ~70 call sites keep working; nothing is purple any more.
- [ ] Delete `.accent-glow`, the corner-glow utility and the `--accent` gradient. Remove their
      call sites.
- [ ] `AmbientBackground`: drop the coloured radials and keep only the monochrome grain + veil.
- [ ] Fonts in `components/DocumentShell.tsx`: remove Syne and repoint `--font-display` to
      Geist Sans (display weight 500–600, tracking −0.045em). Check every `font-display` use
      still looks right at medium weight.
- [ ] `KeySwitch`: tints become `gold | onyx | ivory`. Move `.ks-glow` out of the filtered
      wrapper so it is always gold. Re-map all 19 placements: hero = gold; white sections =
      onyx; bands = ivory; max one gold per page.
- [ ] Update CLAUDE.md's Brand/Colour/Typography sections to the new system (and the
      `design-direction` memory).
- [ ] Check: a contrast pass on every token pair; grep for leftover hexes
      (`#9D5A8F`, `#B85C7A`, `#E0A23A`, `#111a24`, the v1 slate values).

## Phase 2: Hero, the curved reel of our own work (DESIGN.md §6) — ✅ built 2026-11-04

Built: `scripts/build-hero-shots.mjs` (0.21 MB for all 11), `lib/hero-shots.ts`, `components/hero/CurvedReel.tsx`, new 100svh `Hero`, `HeroScene` deleted, `tests/hero-shots.test.ts`. Tuned `curve` 62 / `tileHeight` 25 (the reference defaults put too few, too-big tiles on a tall hero). Still to check: `VideoReveal` rootMargin, the mobile reel sitting close to the subline, and a GPU probe of layer cost.

- [ ] `scripts/build-hero-shots.mjs`: write ~1000px-wide WebP (q≈72) copies of the nine
      `img`/`img2` screenshots to `public/work/hero/`. Add an integrity test (like the
      existing `lib/work.ts` image-path test) so a missing derivative fails CI. (OneDrive has
      eaten `public/work/` before.)
- [ ] Port the reference to `components/hero/CurvedReel.tsx` (no `cn`; plain template strings).
      Changes from the reference:
      `aspectRatio` 2.07, a browser-chrome bar on each tile, `whenReady()` before the animation
      starts, paused via `observeVisible()` off-screen, and image pre-fetch also deferred to
      `whenReady()`.
- [ ] Image list: a `heroShots()` helper interleaves projects (A1, B1, C1… then A2, B2…), reads
      the CMS projects when on, and falls back to `lib/work.ts`. The server parent passes it
      as a prop.
- [ ] Rewrite `components/hero/Hero.tsx`: 100svh (drop the 175vh sticky runway and its
      ScrollTrigger), headline / reel / subline + CTAs + **gold keycap**, PHT clock + coords
      in the bottom corners. Keep the line-mask headline entrance on `whenReady()`.
- [ ] Delete `components/three/HeroScene.tsx` and its dynamic import.
- [ ] Re-measure `VideoReveal`'s observer `rootMargin` (it was tuned to the 175vh hero:
      "805 px below the fold" will change).
- [ ] Check: the no-scroll weight stays ≤ ~0.81 MB + the hero shots (~0.5 MB). Check the
      layer count and memory with ~160 strip `<img>`s, plus the 390px layout, reduced-motion
      (frozen still), and dark mode.

## Phase 3: Landing sections

- [ ] `ServicesGalaxy`: replace `GlyphScene` (goo) with **one large keycap per service**
      (DESIGN.md §5). The service `Icon` is the cap legend; the active row's key gets
      `.is-pressed` + a gold glow, and the previous one releases. Reuse the existing
      IntersectionObserver that already marks the active row. Mobile: a small key per stacked
      row. Delete `GlyphScene.tsx`, and `services/ServicesGlyph` on the Services page goes the
      same way (a keycap that cycles legends).
- [ ] `WorkGallery`: plates go black (`.band`); drop the `dots` tint. `dots` stays in data as
      the chatbot/admin may use it, but nothing renders it.
- [ ] `TechMarquee`: monochrome logos; hover = full ink, no brand colour.
- [ ] `ProcessDeck`, `BeliefScrub`: numerals/one word gold, the rest black/white.
- [ ] `VideoReveal`: check the 80 reel frames for purple. If they are on-brand-v1, re-grade
      (desaturate) or re-export via `scripts/build-reel.mjs`.
- [ ] `Footer` / `FooterWordmark`: the cursor "hole" inks white (or gold, if it is the only
      gold in view), not gradient.

## Phase 4: Inner pages, catalog, brand assets

- [ ] Services, Projects (+ detail), About, Location: remove corner glows, re-check every
      `text-accent` use against the one-gold-per-viewport rule (most should become `text-ink`).
- [ ] Products / Careers / Blog + `EmptyState`: same pass. `.prose-rt` link colour → `gold-ink`.
- [ ] `Preloader`: `#111a24` → `#0C0A09`; decide on a gold sweep.
- [ ] `scripts/build-icons.mjs`: gradient → flat gold on `#0C0A09`; regenerate the icons; re-paste
      the monogram into `public/offline.html`; update `app/opengraph-image.tsx` colours.
- [ ] Bump `VERSION` in `public/sw.js` (the shell cache holds the old icons and wordmarks).
- [ ] Chat widget + ⌘K palette: token check only.

## Phase 5: Polish and verify

- [ ] Full `npm run verify` sweep (all routes, 1440/390, light/dark, en/fil), with screenshots
      reviewed by eye.
- [ ] Squint test per page for 70/20/10: count gold moments per viewport.
- [ ] Reduced-motion pass. Keyboard focus rings visible on white **and** black.
- [ ] GPU-enabled perf probe (never default headless; see the SwiftShader trap in CLAUDE.md).
- [ ] Remove dead code: unused glow CSS, `lib/webgl.ts` if nothing uses `wants3D` any more,
      and **three / @react-three/fiber / drei entirely**. Checked 2026-11-04: the only
      importers are `Hero`, `ServicesGalaxy`, `services/ServicesGlyph` and the two scenes,
      all of which this redesign replaces. Landing on no WebGL at all is a big JS-weight win.

---

### Risks / notes
- **Gold on white fails contrast for text.** Lint for it in review: `text-accent` on a
  white section must become `text-gold-ink` or `text-ink`.
- **Filtered keycaps may look muddy.** This is why Phase 0 prototypes them before anything
  depends on it.
- **`.next` collisions / OneDrive.** Build to `.next-verify` (CLAUDE.md), and commit often.
  OneDrive has eaten binaries here before.
