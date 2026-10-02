/**
 * Formatting helpers for the Products / Careers / Blog pages. SERVER-side
 * (they take the server dictionary's `t`); plain functions, no React.
 *
 * Dates are the studio's calendar (Asia/Manila), not the server's: Vercel runs
 * in UTC, which would print yesterday's date until 08:00 PHT.
 */
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { EmploymentType, Workplace } from "@/lib/supabase/types";

const TZ = "Asia/Manila";
const intl = (lang: Locale) => (lang === "fil" ? "fil-PH" : "en-PH");

/** ISO timestamp → "Oct 2, 2026" (or the Filipino form), in Manila. */
export function formatDate(iso: string | undefined, lang: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(intl(lang), { dateStyle: "medium", timeZone: TZ });
}

/** Calendar date 'YYYY-MM-DD' → "Oct 30, 2026" — no timezone shift (it's a day, not an instant). */
export function formatDay(day: string | undefined, lang: Locale): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return "";
  const [y, m, dd] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString(intl(lang), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/** For the blog's typographic date plate: { day: "02", monthYear: "Oct 2026" }. */
export function dateParts(iso: string, lang: Locale): { day: string; monthYear: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "", monthYear: "" };
  return {
    day: d.toLocaleDateString(intl(lang), { day: "2-digit", timeZone: TZ }),
    monthYear: d.toLocaleDateString(intl(lang), { month: "short", year: "numeric", timeZone: TZ }),
  };
}

/** ISO date attribute for <time dateTime>, Manila calendar. */
export function isoDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA = YYYY-MM-DD
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Paragraphs are separated by a blank line in the panel's textareas. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Translated labels for a role's employment type and workplace. Spelled out
 * key by key — tests/i18n.test.ts can only check string-literal keys.
 */
export function jobLabels(t: Dictionary["t"]) {
  const type: Record<EmploymentType, string> = {
    "full-time": t("job.fullTime"),
    "part-time": t("job.partTime"),
    contract: t("job.contract"),
    internship: t("job.internship"),
  };
  const workplace: Record<Workplace, string> = {
    onsite: t("job.onsite"),
    hybrid: t("job.hybrid"),
    remote: t("job.remote"),
  };
  return { type, workplace };
}
