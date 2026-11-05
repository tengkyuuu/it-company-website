import type { PhotoSlot } from "@/lib/photo-slots";

/**
 * A photo from lib/photo-slots, shown at its own aspect ratio (never cropped
 * to a different shape, never upscaled past its file). Plain <img>, lazy: none
 * of these are above the fold, and the slots will later point at whatever the
 * team supplies.
 */
export default function Photo({
  slot,
  className = "",
  sizes,
}: {
  slot: PhotoSlot;
  className?: string;
  sizes?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slot.src}
      width={slot.width}
      height={slot.height}
      alt={slot.alt}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      data-temporary={slot.temporary || undefined}
      className={`block h-auto w-full rounded-2xl bg-mist object-cover ${className}`}
    />
  );
}
