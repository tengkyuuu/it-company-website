import "server-only";

import { site } from "@/lib/site";
import { frameVerdict } from "./frame-policy";
import { fetchHead, type FetchHeadOptions } from "./safe-fetch";

/**
 * Can this site show a project's live URL in an <iframe>?
 *
 * The browser can't tell us: a page that refuses framing (X-Frame-Options /
 * CSP frame-ancestors) just renders the browser's own error inside the frame,
 * and that is invisible cross-origin. So the server asks instead — once, when
 * an editor saves the URL (app/admin/_lib/content.ts → scheduleEmbedProbe) —
 * and the answer is stored on the project (embeddable / embed_reason /
 * embed_checked_at). LivePreview then skips the iframe for a site known to
 * refuse, and shows the screenshot with "Open ↗" instead.
 *
 * "Unreachable" (DNS failure, timeout, non-2xx…) and "blocked" (the SSRF guard
 * refused the address) also come back as embeddable = false: a visitor's
 * browser wouldn't get a useful page in the frame either. The next save
 * re-checks.
 */

export type EmbedProbeResult = {
  embeddable: boolean;
  /** '' when embeddable; otherwise a sentence for staff (shown in the panel) */
  reason: string;
  checkedAt: string;
};

export async function probeEmbed(
  liveUrl: string,
  options: FetchHeadOptions & { embedderOrigin?: string; now?: () => Date } = {}
): Promise<EmbedProbeResult> {
  const { embedderOrigin = new URL(site.url).origin, now = () => new Date(), ...fetchOptions } = options;
  const out = await fetchHead(liveUrl, fetchOptions);
  const checkedAt = now().toISOString();

  if (!out.ok) return { embeddable: false, reason: out.reason, checkedAt };
  if (out.status < 200 || out.status > 299) {
    return { embeddable: false, reason: `Unreachable — the site answered HTTP ${out.status}`, checkedAt };
  }
  const verdict = frameVerdict(out.headers, embedderOrigin, new URL(out.url).origin);
  return { ...verdict, checkedAt };
}
