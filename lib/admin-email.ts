import "server-only";

import { headers } from "next/headers";
import { Resend } from "resend";
import { site } from "@/lib/site";

/**
 * Panel emails (team invites, password resets) sent through Resend, plus the
 * helpers that build the links inside them.
 *
 * Why not Supabase's built-in mailer: on the free tier it sends ~2 emails an
 * hour and only to the project owner's own address. And why not its links at
 * all: generateLink's `hashed_token` is the value GoTrue stores, so reading the
 * auth schema was enough to redeem one. The tokens in these links are our own
 * (app/admin/auth/_lib/tokens.ts) — the database keeps only their SHA-256.
 *
 * Every send here is NON-THROWING and reports whether the failure looks like
 * Resend's sandbox: with the onboarding@resend.dev sender, Resend only delivers
 * to the Resend account owner's own address. The callers fall back to handing
 * the admin the link to share by chat, which is the whole point of reporting it.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; message: string; sandbox: boolean };

/** Unquoted display name is correct — see the RFC 5322 note in lib/email.ts. */
const FROM =
  process.env.ADMIN_FROM_EMAIL ||
  process.env.CONTACT_FROM_EMAIL ||
  "R Ally's Tech <onboarding@resend.dev>";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** True while sending from Resend's shared test domain. */
export const usingSandboxSender = () => /@resend\.dev\b/i.test(FROM);

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );

// ---------------------------------------------------------------------------
// link origins
// ---------------------------------------------------------------------------

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);

function siteOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || site.url).origin;
  } catch {
    return "https://mykt.studio";
  }
}

/** The origin the current request arrived on, or null if it looks off. */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;
  const fwd = (h.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = fwd === "http" || fwd === "https" ? fwd : isLocalHost(host) ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * For SIGNED-IN admin actions: the request's own origin, so an invite created
 * on localhost or a Vercel preview links back to that same deployment.
 * Host-header spoofing isn't a concern here — the only person who can steer it
 * is the authenticated admin making the request.
 */
export async function adminLinkOrigin() {
  return (await requestOrigin()) ?? siteOrigin();
}

/**
 * For UNAUTHENTICATED flows (password reset): never trust the Host header
 * blindly, or anyone could request a reset for a teammate with
 * `Host: evil.example` and receive a link that hands THEM the token
 * ("password-reset poisoning"). Allow-list it, else use the canonical URL.
 */
export async function trustedLinkOrigin() {
  const origin = await requestOrigin();
  if (!origin) return siteOrigin();
  const host = new URL(origin).host;
  const allowed = new Set(
    [
      new URL(siteOrigin()).host,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ].filter(Boolean) as string[]
  );
  return allowed.has(host) || isLocalHost(host) ? origin : siteOrigin();
}

/**
 * The link we email / hand over for chat. /admin/auth/confirm only CHECKS the
 * token on GET and renders the password form; the token is spent when the
 * person submits it. Chat apps (Messenger, Viber, Slack…) and mail scanners
 * fetch every URL to build a preview, and a GET that consumed the single-use
 * token would burn the link before the person ever clicked it.
 */
export function tokenLink(origin: string, rawToken: string) {
  return `${origin}/admin/auth/confirm?t=${encodeURIComponent(rawToken)}`;
}

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * Table-based, inline-styled, light palette only (#F8FAFC paper, #1E293B ink,
 * #94A3B8 secondary) — mail clients ignore <style> and dark-mode hints too
 * unevenly to rely on. The button carries the one gradient accent, over a solid
 * mauve fallback for clients (Outlook) that drop background-image.
 */
function layout({
  preheader,
  heading,
  bodyHtml,
  cta,
  link,
  footnote,
}: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  cta: string;
  link: string;
  footnote: string;
}) {
  const href = esc(link);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F8FAFC">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC">
  <tr>
    <td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr>
          <td style="padding:0 4px 18px;font:700 15px/1.2 ${FONT};color:#1E293B">
            ${esc(site.name)}<span style="font-weight:400;color:#94A3B8">&nbsp;&nbsp;·&nbsp;&nbsp;Admin panel</span>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:20px;padding:36px 32px">
            <h1 style="margin:0 0 14px;font:700 24px/1.3 ${FONT};letter-spacing:-0.01em;color:#1E293B">${esc(heading)}</h1>
            ${bodyHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
              <tr>
                <td bgcolor="#B85C7A" style="border-radius:999px;background:#B85C7A;background-image:linear-gradient(135deg,#9D5A8F,#B85C7A,#E0A23A)">
                  <a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;border-radius:999px;font:600 15px/1 ${FONT};color:#FFFFFF;text-decoration:none">${esc(cta)}</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font:13px/1.6 ${FONT};color:#94A3B8">
              Button not working? Paste this link into your browser:<br>
              <a href="${href}" target="_blank" rel="noopener" style="color:#1E293B;word-break:break-all">${href}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font:12px/1.6 ${FONT};color:#94A3B8">${footnote}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const p = (html: string) =>
  `<p style="margin:0 0 14px;font:15px/1.65 ${FONT};color:#1E293B">${html}</p>`;

async function send(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "RESEND_API_KEY is not set.", sandbox: false };
  }
  const resend = new Resend(apiKey);

  // one retry on Resend's per-second rate limit (bulk invites hit it)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await resend.emails.send({ from: FROM, ...message });
      if (!error) return { ok: true };
      if (error.name === "rate_limit_exceeded" && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1100));
        continue;
      }
      const sandbox =
        error.statusCode === 403 ||
        /testing emails|verify a domain|own email address/i.test(error.message ?? "");
      return { ok: false, message: error.message || "Resend rejected the email.", sandbox };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Couldn’t reach Resend.",
        sandbox: false,
      };
    }
  }
  return { ok: false, message: "Resend rate limit — try again in a moment.", sandbox: false };
}

/** Every invite grants admin since Phase 1 (editor is retired; owner isn't invitable). */
const ADMIN_BLURB = "you’ll be able to edit projects, services and the site’s content";

export async function sendInviteEmail(args: {
  to: string;
  inviteeName: string | null;
  inviterName: string;
  link: string;
  /** e.g. "7 days" — from ttlLabel(), so the copy matches the real expiry */
  expiresIn: string;
}): Promise<SendResult> {
  const { to, inviteeName, inviterName, link, expiresIn } = args;
  const hello = inviteeName ? `Hi ${inviteeName.split(" ")[0]},` : "Hi,";

  const html = layout({
    preheader: `${inviterName} invited you to the ${site.name} panel.`,
    heading: `You’re invited to the ${site.name} panel`,
    bodyHtml:
      p(esc(hello)) +
      p(
        `${esc(inviterName)} has invited you to help run the ${esc(site.name)} website as <strong>an Admin</strong> — ${ADMIN_BLURB}.`
      ) +
      p(
        `Open the link to choose your own password — nobody else ever sees it. The link works once and expires in <strong>${esc(expiresIn)}</strong>; if it has, ask ${esc(inviterName)} to send a fresh one.`
      ),
    cta: "Accept invite & set password",
    link,
    footnote: `You’re getting this because ${esc(inviterName)} added ${esc(to)} to the ${esc(site.name)} admin panel. Not expecting it? Ignore this email — nothing happens unless you open the link.`,
  });

  const text = [
    hello,
    "",
    `${inviterName} has invited you to help run the ${site.name} website as an Admin — ${ADMIN_BLURB}.`,
    "",
    "Accept the invite and choose your own password:",
    link,
    "",
    `The link works once and expires in ${expiresIn}. If it has, ask ${inviterName} to send a fresh one.`,
    "",
    `Not expecting this? Ignore it — nothing happens unless you open the link.`,
    `— ${site.name}`,
  ].join("\n");

  return send({
    to,
    subject: `${inviterName} invited you to the ${site.name} panel`,
    html,
    text,
  });
}

export async function sendPasswordResetEmail(args: {
  to: string;
  name: string | null;
  link: string;
  /** e.g. "1 hour" — from ttlLabel() */
  expiresIn: string;
  /** set when the owner sent it from the Team page, rather than "Forgot password?" */
  requestedBy?: string | null;
}): Promise<SendResult> {
  const { to, name, link, expiresIn, requestedBy } = args;
  const hello = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const who = requestedBy
    ? `${requestedBy} sent you a link to reset the password for ${to} on the ${site.name} admin panel.`
    : `Someone (hopefully you) asked to reset the password for ${to} on the ${site.name} admin panel.`;

  const html = layout({
    preheader: `Reset your ${site.name} panel password.`,
    heading: "Reset your password",
    bodyHtml:
      p(esc(hello)) +
      p(esc(who)) +
      p(
        `You choose the new password yourself. Saving it signs your account out everywhere else. The link works once and expires in <strong>${esc(expiresIn)}</strong>.`
      ),
    cta: "Choose a new password",
    link,
    footnote: `Didn’t ask for this? Ignore this email — your password stays the same unless you open the link.`,
  });

  const text = [
    hello,
    "",
    who,
    "",
    "Choose a new password:",
    link,
    "",
    `Saving it signs your account out everywhere else. The link works once and expires in ${expiresIn}.`,
    "Didn't ask for this? Ignore this email — your password stays the same unless you open the link.",
    `— ${site.name}`,
  ].join("\n");

  return send({
    to,
    subject: `Reset your ${site.name} panel password`,
    html,
    text,
  });
}
