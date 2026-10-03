/**
 * Which Gemini model the site assistant runs on — read in exactly one place.
 *
 * `gemini-3.6-flash` is the default: the model docs name that exact id as the
 * *stable* choice for production apps, and flash tier is the right shape for
 * short FAQ turns. GEMINI_MODEL (server-only) overrides it, so a model
 * retirement never needs a code change.
 *
 * ⚠️ Don't point it at a `-preview` / `-exp` id in production: previews carry
 * tighter rate limits and can be shut down with ~2 weeks' notice. One is
 * accepted (you may want to try one on a preview deploy) but logged once.
 *
 * The model id is NOT part of the system prompt, so changing it doesn't touch
 * the prompt cache key of lib/chat-context.ts beyond the model switch itself.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/** Model ids look like `gemini-3.6-flash`, `gemini-2.5-flash-lite`, `models/…`. */
const MODEL_ID_RE = /^(models\/)?[a-z0-9][a-z0-9.-]{2,63}$/i;

let warned = "";

export function geminiModel(env: Record<string, string | undefined> = process.env): string {
  const raw = env.GEMINI_MODEL?.trim();
  if (!raw) return DEFAULT_GEMINI_MODEL;
  if (!MODEL_ID_RE.test(raw)) {
    if (warned !== raw) {
      warned = raw;
      console.warn(`[chat] GEMINI_MODEL "${raw}" doesn't look like a model id — using ${DEFAULT_GEMINI_MODEL}.`);
    }
    return DEFAULT_GEMINI_MODEL;
  }
  if (/-(preview|exp)\b/i.test(raw) && warned !== raw) {
    warned = raw;
    console.warn(
      `[chat] GEMINI_MODEL is "${raw}" — a preview/experimental id. Expect tighter rate limits and short-notice shutdown.`
    );
  }
  return raw;
}
