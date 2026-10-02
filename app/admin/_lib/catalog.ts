import type { EmploymentType, Workplace } from "@/lib/supabase/types";

/**
 * Labels and limits shared by the products / careers / blog panel pages
 * (server components) and their forms (client components).
 *
 * A plain module ON PURPOSE — no "use client", no "server-only". A server
 * component that imports a value out of a "use client" file gets a client
 * reference proxy, not the value (the bug that once made the theme key
 * `undefined`), so constants both sides need live here.
 */

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

export const WORKPLACES: { value: Workplace; label: string }[] = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export const employmentLabel = (v: string) =>
  EMPLOYMENT_TYPES.find((t) => t.value === v)?.label ?? v;
export const workplaceLabel = (v: string) => WORKPLACES.find((w) => w.value === v)?.label ?? v;

/** Repeating-row caps — the forms disable "add" at these, the actions enforce them. */
export const MAX_PRODUCT_GALLERY = 12;
export const MAX_FEATURES = 20;
export const MAX_LIST_ITEMS = 20;
export const MAX_POST_TAGS = 12;

/** The three sections' public URL prefixes (English; /fil/… is the i18n layer's job). */
export const PUBLIC_PATH = {
  product: "/products",
  job: "/careers",
  post: "/blog",
} as const;

export type CatalogKind = keyof typeof PUBLIC_PATH;

/** Panel URL prefixes, same keys. */
export const ADMIN_PATH = {
  product: "/admin/products",
  job: "/admin/careers",
  post: "/admin/blog",
} as const;

/** "2026-10-02T07:13:22Z" -> "2026-10-02" on the studio's calendar (for <input type="date">). */
export function manilaDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "2026-10-02" -> "Oct 2, 2026" (a calendar date, so no timezone shift). */
export function formatDay(day: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return "";
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}
