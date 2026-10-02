/**
 * Translation keys for the primary nav (`nav` in lib/site.ts stays the
 * structural source of truth — hrefs + English labels — and the sitemap reads
 * it). A nav item without a key here falls back to its English `label`.
 */
import type { ClientMessageKey } from "./dictionary";

export const navKeys: Record<string, ClientMessageKey> = {
  "/": "nav.home",
  "/services": "nav.services",
  "/projects": "nav.projects",
  "/about": "nav.about",
  "/location": "nav.location",
  "/products": "nav.products",
  "/careers": "nav.careers",
  "/blog": "nav.blog",
};

/** The translated label for a nav item, given any `t` over the common keys. */
export function navLabel(
  t: (key: ClientMessageKey) => string,
  item: { href: string; label: string }
): string {
  const key = navKeys[item.href];
  return key ? t(key) : item.label;
}
