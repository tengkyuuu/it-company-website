import { notFound } from "next/navigation";

/**
 * Unmatched /admin/* URLs land here, so they 404 *inside* the admin segment
 * (app/admin/not-found.tsx, in the admin layout) instead of falling through to
 * the root 404.
 *
 * Not cosmetic: the root 404 is prerendered once with the pathname
 * "/_not-found", so SiteChrome — which picks admin vs marketing chrome from
 * usePathname() — rendered marketing chrome on the server while the browser,
 * seeing "/admin/…", rendered none. That mismatch threw React #418 (hydration
 * failed) on every unknown admin URL, e.g. links to the retired
 * /admin/auth/verify. Rendering it here gives the server the real pathname.
 *
 * Specific routes always win over a catch-all, so this shadows nothing.
 * Known trade-off: the response status is 200, not 404 — app/admin/loading.tsx
 * starts streaming before notFound() runs. Harmless for a noindex,
 * robots-disallowed panel; don't "fix" it by deleting the loading skeleton.
 */
export default function MissingAdminPage() {
  notFound();
}
