import { z } from "zod";

/**
 * The job-application form's contract, shared by the Route Handler
 * (app/api/apply/route.ts) and — types only — the client form
 * (components/catalog/ApplyForm.tsx). Neutral module: no secrets, no
 * "use client", no "server-only".
 *
 * The client imports nothing but TYPES from here, so zod never ships to the
 * browser for this form. Field messages live in the dictionary (catalog
 * namespace) and the handler answers with field NAMES / error CODES, so every
 * word the applicant reads is translated.
 *
 * No file uploads, by design: a CV arrives as a link. Uploads would mean a
 * public write path into Storage (size, type and malware handling) for a form
 * anyone can POST to.
 */

/** Version-agnostic email check (same as lib/contact-schema.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** digits with the usual separators: "+63 912 345 6789", "(065) 212-3344" */
const PHONE_RE = /^\+?[\d\s().-]{6,32}$/;

export const MAX_APPLY_LINKS = 3;
export const MAX_COVER_NOTE = 4000;
export const MIN_COVER_NOTE = 20;

/**
 * A link an applicant may give us: https only, and it must parse with a real
 * host. http:// is refused (we don't open applicants' links over plain HTTP),
 * and so is anything that isn't a web address at all.
 */
export function isApplyLink(v: string): boolean {
  if (!/^https:\/\/\S+$/i.test(v) || v.length > 500) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** The form sends a textarea ("one per line"); accept an array too. */
function toLinks(v: unknown): unknown {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,]+/) : v == null ? [] : v;
  if (!Array.isArray(list)) return list;
  return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
}

export const applySchema = z.object({
  jobId: z.string().trim().regex(UUID_RE),
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((v) => EMAIL_RE.test(v)),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || PHONE_RE.test(v))
    .optional()
    .default(""),
  links: z
    .preprocess(toLinks, z.array(z.string().refine(isApplyLink)).max(MAX_APPLY_LINKS))
    .optional()
    .default([]),
  message: z.string().trim().min(MIN_COVER_NOTE).max(MAX_COVER_NOTE),
  // anti-spam: the honeypot must stay empty; startedAt powers the time-trap
  company: z.string().max(0).optional().default(""),
  startedAt: z.coerce.number().optional(),
});

export type ApplyInput = z.infer<typeof applySchema>;

/** Fields the applicant can fix — the handler reports these by name. */
export const APPLY_FIELDS = ["name", "email", "phone", "links", "message"] as const;
export type ApplyField = (typeof APPLY_FIELDS)[number];

/**
 * Why a submission was refused, as a code the form turns into a sentence:
 *  - request: malformed body / bad job id (a tampered or stale form)
 *  - rate:    this visitor's limit (3 per 10 minutes)
 *  - busy:    the site-wide daily ceiling (100)
 *  - closed:  the role is closed, unpublished or gone
 *  - server:  couldn't record or deliver it — email us instead
 */
export type ApplyErrorCode = "request" | "rate" | "busy" | "closed" | "server";

/** What /api/apply answers and the form renders. */
export type ApplyState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: ApplyErrorCode }
  | { status: "invalid"; fields: ApplyField[] };
