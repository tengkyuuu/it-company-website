# MykTech() — Ignition identity v2.0

Approved direction: **Ignition**. Created November 4, 2026.

Open `index.html` for the offline guide, color previews and downloads. `MykTech-Brand-Guidelines.pdf` is the printable guide; `brand-board.png` is the shareable overview. Assets and fonts are local. All logo lettering is outlined vector artwork.

## The idea

A keycap represents the step from thinking to making. The integrated M/T identifies MykTech(), while the spark at its open corner represents an idea coming to life. The expressive italic name includes a clean native k terminal. Myk is the leader's name; the design does not assign a fabricated meaning to it. The parentheses remain part of **MykTech()**.

## Logo family

35 production SVGs: horizontal, wordmark, stacked, signature, emblem and micro in five treatments (30); two decorative outlines; three avatars. 33 PNGs accompany all solid assets. The six `*-accent-mask.svg` files are additional internal website masks.

- `primary`: ink artwork and a gold spark, for light grounds.
- `reversed`: paper artwork and a gold spark, for dark grounds.
- `ink`, `white`, `gold`: single-color artwork for restricted-color use.

Use horizontal by default. Use stacked for square or vertical spaces, wordmark for a minimal name-only treatment, and the full emblem when the brand is already understood. At tiny sizes use the MT-only micro mark, which omits the keycap and spark. Use the signature only when its tagline remains legible. Decorative outlines are SVG only and intended for widths of at least 600px.

PNG lockups are 2400px wide; emblems and avatars are 1024px wide. All logo PNGs have native alpha transparency. Avatar backgrounds are intentional. White logos can appear blank in a white preview.

## Clear space and minimum sizes

Clear space = one eighth of the complete emblem's visible width, including the spark, on every side of the visible artwork. The SVG canvas includes safety padding; add the remaining clear space in your layout. Preserve the cap's angle, symbol/name relationship and supplied letter spacing.

| Arrangement | Minimum screen width | Minimum print width |
| --- | ---: | ---: |
| Horizontal | 160px | 36mm |
| Wordmark | 120px | 27mm |
| Stacked | 160px | 36mm |
| Signature | 320px | 72mm |
| Full emblem | 40px | 10mm |
| MT-only micro | 16px | 5mm |

The micro mark is intended for 16–39px. Widths refer to the supplied export canvas. Do not stretch, rotate, add effects, remove parentheses or recolor individual letters. Use a quiet panel over busy imagery.

## Color and type

Ink #0C0A09, paper #FAFAF9, surface #FFFFFF, mist #E7E5E4, muted #78716C. Gold #D4AF37 is the spark and a restrained accent. Use #8C6D1F for readable gold body text on white. Gold occupies no more than about 10% of a page; the logo spark counts toward that area.

The logo is based on **DM Serif Display Italic**, with adjusted spacing and a clean native k terminal. Its TTF and SIL Open Font License are included. Use the supplied artwork rather than typing a replacement logo. The website and other communications use **Geist**: Medium 500 for display, Regular 400 for body and Geist Mono 400 for metadata. WOFF2 files and their license are in `fonts/`.

Screen masters are RGB/sRGB. Supply outlined SVGs to your printer and approve final dimensions and a physical color proof for the chosen paper and process. No universal CMYK, Pantone or foil equivalent is specified.

## Applications and source

`social-cover.svg` and `.png` are a 1584 × 396 social banner. Three square avatars cover light, dark and gold grounds. `email-signature.html` contains a company signature; host its logo at a stable public HTTPS URL before sending and add personal or contact details only when real ones are available. `favicon.ico` contains 16, 32 and 48px optical MT marks. The website's PWA and Apple icons use the full emblem.

`tokens.css`, `tokens.json` and `manifest.json` contain the values and inventory. SVGs can be edited in Figma, Illustrator, Affinity, Inkscape or a text editor. They contain native paths, with no raster image or font dependency.

From the website repository, run `npm ci` then `npm run build:brand`. `scripts/build-brand.mjs` rebuilds SVGs, PNGs, the board, banner, color tokens, offline artwork, and `lib/brand-geometry.ts`; `scripts/build-icons.mjs` rebuilds favicon and app icons. `node scripts/build-wordmark.mjs` remains a compatibility entry point. Keep the included DM Serif Display font in place when regenerating. The HTML guide is maintained directly; the reviewed PDF and ZIP are packaged after verification.

The existing website palette, keycap object, content and behavior are retained. No unconfirmed contact details, testimonials or company claims are introduced.
