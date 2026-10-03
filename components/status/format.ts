/**
 * Display formatting for /status. Plain functions, server-side.
 *
 * The page's one rule: a number may lose precision only in the UNFLATTERING
 * direction. Timings (lower = better) round UP; scores arrive as integers and
 * are shown as-is; counts are exact. Nothing here ever turns 89.6 into 90.
 *
 * Dates are the studio's clock (Asia/Manila), labelled PHT — Vercel renders in
 * UTC, which would otherwise print a different day for half of it.
 */
import type { Locale } from "@/lib/i18n/config";

const TZ = "Asia/Manila";
const intl = (lang: Locale) => (lang === "fil" ? "fil-PH" : "en-PH");

/** "Oct 3, 2026, 2:05 PM PHT" */
export function formatReported(iso: string, lang: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleString(intl(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TZ })} PHT`;
}

/** Exact integer with grouping: 1,204 */
export const formatCount = (n: number, lang: Locale) => n.toLocaleString(intl(lang));

/** Suite wall time → seconds, one decimal, rounded UP: 38412 → "38.5" */
export const formatDurationSeconds = (ms: number) => (Math.ceil(ms / 100) / 10).toFixed(1);

/** LCP → seconds, two decimals, rounded UP: 3421 → "3.43 s" */
export const formatLcp = (ms: number) => `${(Math.ceil(ms / 10) / 100).toFixed(2)} s`;

/** TBT is already whole ms (rounded up at the source) */
export const formatTbt = (ms: number, lang: Locale) => `${formatCount(ms, lang)} ms`;

/** CLS arrives rounded UP to three decimals; toFixed only pads. */
export const formatCls = (v: number) => v.toFixed(3);

export const shortSha = (sha: string) => sha.slice(0, 7);
