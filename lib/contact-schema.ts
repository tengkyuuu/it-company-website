import { z } from "zod";
import { services } from "@/lib/services";

// Service <option>s — derived from the single source of truth in lib/services.ts.
export const serviceOptions: string[] = [
  ...services.map((s) => s.title),
  "Not sure yet",
];

// Version-agnostic email check (avoids zod-version-specific .email() API).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .max(200)
    .refine((v) => EMAIL_RE.test(v), { error: "Enter a valid email address." }),
  service: z
    .string()
    .refine((v) => serviceOptions.includes(v), {
      error: "Please pick a service.",
    }),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (10+ characters).")
    .max(5000),
  // anti-spam: honeypot must stay empty; startedAt powers the time-trap
  company: z.string().max(0).optional().default(""),
  startedAt: z.coerce.number().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Result the server action returns and the client form renders. */
export type ContactState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "invalid"; fieldErrors: Partial<Record<string, string>> };
