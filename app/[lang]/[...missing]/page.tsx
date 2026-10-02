import { notFound } from "next/navigation";

/**
 * Every unmatched public URL lands here, so it 404s INSIDE the [lang] layout —
 * branded, in the right language, with the nav and footer — instead of falling
 * through to Next's bare built-in 404 (with no app/layout.tsx there is no root
 * not-found to fall back to). middleware.ts rewrites unprefixed URLs to /en/…,
 * so `/nope` arrives as `/en/nope` and `/fil/nope` as itself.
 *
 * Specific routes always win over a catch-all, so this shadows nothing. Unlike
 * app/admin/[...missing] there is no loading.tsx above it, so the response is a
 * real 404 status.
 */
export default function MissingPage() {
  notFound();
}
