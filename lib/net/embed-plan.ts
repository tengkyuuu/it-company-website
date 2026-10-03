/**
 * When does saving a project (re)check its live URL? Pure, shared by the
 * explicit Save (app/admin/actions.ts → saveProject) and autosave
 * (app/api/admin/autosave/route.ts), pinned by tests/safe-fetch.test.ts.
 *
 *  - `reset`: live_url is changing, so the stored verdict describes the OLD
 *    address. The "unchecked" columns ride in the SAME update as the new URL —
 *    never a second write — so a stale verdict can't apply to the new address
 *    even for a moment.
 *  - `probe`: check the (new) URL after the response. Always when it changed or
 *    was never checked; on an explicit Save also when the last check is older
 *    than an hour (sites change their headers; Save is a deliberate act, a
 *    keystroke isn't).
 *
 * Only when the row actually has the embed columns (`"embeddable" in before`):
 * a database whose schema predates them must keep saving normally, not fail
 * with "column embeddable does not exist".
 */

export const EMBED_RECHECK_MS = 60 * 60 * 1000;

export const EMBED_UNCHECKED = {
  embeddable: null,
  embed_reason: "",
  embed_checked_at: null,
} as const;

export type EmbedPlan = { reset: boolean; probe: boolean; url: string | null };

export function planEmbedCheck(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
  { explicit, now = Date.now() }: { explicit: boolean; now?: number }
): EmbedPlan {
  const none: EmbedPlan = { reset: false, probe: false, url: null };
  if (!("live_url" in patch)) return none;
  const next = typeof patch.live_url === "string" && patch.live_url ? patch.live_url : null;

  // a new project: nothing stored to reset; probe if a URL came with it
  if (!before) return { reset: false, probe: Boolean(next), url: next };
  if (!("embeddable" in before)) return none;

  const prev = typeof before.live_url === "string" && before.live_url ? before.live_url : null;
  const changed = next !== prev;
  const checkedAt = typeof before.embed_checked_at === "string" ? Date.parse(before.embed_checked_at) : NaN;
  const neverChecked = !Number.isFinite(checkedAt);
  const stale = !neverChecked && now - checkedAt > EMBED_RECHECK_MS;

  return {
    reset: changed,
    probe: Boolean(next) && (changed || neverChecked || (explicit && stale)),
    url: next,
  };
}
