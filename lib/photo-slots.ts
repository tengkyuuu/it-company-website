/**
 * Photo slots on the home page — one entry per picture the layout needs.
 *
 * Every slot currently holds a TEMPORARY stand-in: a grayscale stock photo
 * (Unsplash licence, fetched via picsum.photos, stored locally in
 * public/placeholder/ so nothing is hot-linked). The real photos are requested
 * from the team in docs/content-request.md.
 *
 * To swap one: put the real photo in public/photos/ (any size ≥ the slot's
 * width; it is shown at the slot's aspect ratio, so give it roughly that
 * shape), point `src` at it, set `temporary: false`, and write a true `alt`.
 * Nothing else needs to change.
 *
 * Rules for stand-ins (PRODUCT.md "Nothing invented"): no faces, nothing that
 * a visitor would read as "this is the team" or "this is a client". Hands,
 * desks, places. tests/photo-slots.test.ts checks every file exists.
 *
 * Deliberately not a "use client" module: server pages import these values.
 */
export type PhotoSlot = {
  src: string;
  /** intrinsic size of the file — used for width/height (no layout shift) */
  width: number;
  height: number;
  alt: string;
  /** what the real photo should show, for whoever replaces it */
  wanted: string;
  temporary: boolean;
};

// full paths spelled out (not templated) so tests/data-integrity.test.ts sees them too
const temp = (
  src: string,
  width: number,
  height: number,
  alt: string,
  wanted: string
): PhotoSlot => ({ src, width, height, alt, wanted, temporary: true });

/** "The studio" — the asymmetric text + photo spread (StudioIntro). */
export const studioPhotos = {
  tall: temp("/placeholder/studio-hands.webp", 900, 1125, "Hands sketching notes beside a laptop", "A teammate at work, close in — hands, screen, sketches (4:5)"),
  wide: temp("/placeholder/studio-desk.webp", 1200, 800, "A tidy desk with a monitor and keyboard", "The studio desk or a detail of the workspace (3:2)"),
};

/** "Built in Dipolog" — the scattered collage (DipologCollage), in reading order. */
export const collagePhotos = [
  temp("/placeholder/dipolog-coast.webp", 1200, 800, "A calm coastline under a clear sky", "Dipolog boulevard / the seafront (3:2, the large centre photo)"),
  temp("/placeholder/workspace.webp", 900, 600, "A long wooden table in a bright workspace", "Our workspace, wide (3:2)"),
  temp("/placeholder/planning.webp", 800, 600, "Papers and sketches spread across a desk", "A planning session — whiteboard or sketches (4:3)"),
  temp("/placeholder/laptop-notes.webp", 900, 600, "A laptop and an open notebook on a desk", "A call with a client abroad, screen visible (3:2)"),
  temp("/placeholder/desk-detail.webp", 800, 600, "Devices and tools laid out flat", "A desk detail — keyboard, keycap, tools (4:3)"),
  temp("/placeholder/seaside-dusk.webp", 900, 600, "The sea at dusk", "Dipolog at dusk (3:2)"),
  temp("/placeholder/window-silhouettes.webp", 900, 600, "Silhouettes of people at a bright window", "A candid team moment (3:2)"),
] satisfies PhotoSlot[];

export const allPhotoSlots: PhotoSlot[] = [studioPhotos.tall, studioPhotos.wide, ...collagePhotos];
