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
  /** `id` is Resend's message id (kept with inbox replies) */
  | { ok: true; id?: string }
  | { ok: false; message: string; sandbox: boolean };

/** Unquoted display name is correct — see the RFC 5322 note in lib/email.ts. */
const FROM =
  process.env.ADMIN_FROM_EMAIL ||
  process.env.CONTACT_FROM_EMAIL ||
  "MykTech <onboarding@resend.dev>";

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
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/**
 * The animated header (scripts/build-email-art.mjs): the site's opening
 * sequence as a GIF — gold light sweeps the wordmark in, the spark resolves,
 * sparks twinkle. A GIF because it is the one animation every client plays;
 * frame 0 is the finished lockup, which is all classic Outlook shows. Always
 * the canonical origin: a mail client can't fetch a localhost image anyway.
 */
const headerArt = () => `${siteOrigin()}/brand/email/header.gif`;

/**
 * Table-based and inline-styled — mail clients ignore most <style> and treat
 * dark-mode hints unevenly. The header is a deliberate ink band (like the
 * site's .band), so it reads the same in light and dark mail apps; the body is
 * paper and ink with flat gold accents.
 *
 * The <style> block is progressive: Apple Mail / iOS Mail run the entrance
 * animations and the button glint, clients that strip it (Gmail, Outlook) show
 * the same content still, and reduced motion switches them off. Nothing starts
 * hidden without it.
 */
function layout({
  preheader,
  eyebrow,
  heading,
  bodyHtml,
  cta,
  link,
  footnote,
}: {
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  cta: string;
  link: string;
  footnote: string;
}) {
  const href = esc(link);
  const home = esc(siteOrigin());
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
<style>
@keyframes mk-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes mk-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes mk-glint{0%,60%{background-position:-160% 0}100%{background-position:260% 0}}
.mk-rise{animation:mk-rise .8s cubic-bezier(.22,1,.36,1) both}
.mk-d1{animation-delay:.25s}.mk-d2{animation-delay:.4s}.mk-d3{animation-delay:.55s}.mk-d4{animation-delay:.7s}
.mk-rule{transform-origin:left;animation:mk-draw 1s cubic-bezier(.22,1,.36,1) .5s both}
.mk-btn{background-image:linear-gradient(100deg,transparent 40%,rgba(212,175,55,.5) 50%,transparent 60%);background-size:200% 100%;background-repeat:no-repeat;animation:mk-glint 3.4s ease-in-out 1.4s infinite}
@media (prefers-reduced-motion:reduce){.mk-rise,.mk-rule,.mk-btn{animation:none!important}}
@media (max-width:480px){.mk-card{padding:30px 22px!important}.mk-h1{font-size:26px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FAFAF9">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF9">
  <tr>
    <td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr>
          <td bgcolor="#0C0A09" style="background:#0C0A09;border-radius:16px 16px 0 0;line-height:0;font-size:0">
            <a href="${home}" target="_blank" rel="noopener" style="display:block;text-decoration:none">
              <img src="${esc(headerArt())}" width="560" height="200" alt="${esc(site.name)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:16px 16px 0 0;background:#0C0A09;color:#F5F5F4;font:700 22px/200px ${FONT};text-align:center">
            </a>
          </td>
        </tr>
        <tr>
          <td class="mk-card" style="background:#FFFFFF;border:1px solid #E7E5E4;border-top:0;border-radius:0 0 16px 16px;padding:40px 36px 36px">
            <p class="mk-rise" style="margin:0 0 14px;font:500 11px/1.4 ${MONO};letter-spacing:.22em;text-transform:uppercase;color:#8C6D1F">${esc(eyebrow)}</p>
            <h1 class="mk-rise mk-d1 mk-h1" style="margin:0 0 18px;font:600 30px/1.12 ${FONT};letter-spacing:-0.035em;color:#0C0A09">${esc(heading)}</h1>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr><td class="mk-rule" width="56" height="2" bgcolor="#D4AF37" style="width:56px;height:2px;background:#D4AF37;font-size:0;line-height:0">&nbsp;</td></tr></table>
            <div class="mk-rise mk-d2">${bodyHtml}</div>
            <table role="presentation" class="mk-rise mk-d3" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px">
              <tr>
                <td bgcolor="#0C0A09" style="border-radius:999px;background:#0C0A09">
                  <a class="mk-btn" href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 30px;border-radius:999px;font:600 15px/1 ${FONT};color:#FFFFFF;text-decoration:none">${esc(cta)}&nbsp;&nbsp;<span style="color:#D4AF37">&rarr;</span></a>
                </td>
              </tr>
            </table>
            <p class="mk-rise mk-d4" style="margin:24px 0 0;padding-top:20px;border-top:1px solid #E7E5E4;font:13px/1.6 ${FONT};color:#78716C">
              Button not working? Paste this link into your browser:<br>
              <a href="${href}" target="_blank" rel="noopener" style="color:#0C0A09;word-break:break-all">${href}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 6px 0;font:12px/1.6 ${FONT};color:#78716C">${footnote}</td>
        </tr>
        <tr>
          <td style="padding:14px 6px 0;font:500 10px/1.4 ${MONO};letter-spacing:.2em;text-transform:uppercase;color:#A8A29E">${esc(site.name)}&nbsp;&nbsp;·&nbsp;&nbsp;Dipolog City, Philippines</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const p = (html: string) =>
  `<p style="margin:0 0 14px;font:15px/1.7 ${FONT};color:#44403C">${html}</p>`;
const strong = (html: string) => `<strong style="color:#0C0A09">${html}</strong>`;

async function send(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "RESEND_API_KEY is not set.", sandbox: false };
  }
  const resend = new Resend(apiKey);

  // one retry on Resend's per-second rate limit (bulk invites hit it)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await resend.emails.send({ from: FROM, ...message });
      if (!error) return { ok: true, id: data?.id };
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

/**
 * No email addresses anywhere in these two emails — not the sender's, not the
 * recipient's. They speak for the studio ("the MykTech() team"), and a
 * forwarded email shouldn't carry anyone's address.
 */
export async function sendInviteEmail(args: {
  to: string;
  inviteeName: string | null;
  link: string;
  /** e.g. "7 days" — from ttlLabel(), so the copy matches the real expiry */
  expiresIn: string;
}): Promise<SendResult> {
  const { to, inviteeName, link, expiresIn } = args;
  const hello = inviteeName ? `Hi ${inviteeName.split(" ")[0]},` : "Hi,";

  const html = layout({
    preheader: `You’ve been invited to help run the ${site.name} website.`,
    eyebrow: "Admin panel · Invitation",
    heading: "You’re invited to the panel",
    bodyHtml:
      p(esc(hello)) +
      p(
        `The ${esc(site.name)} team has invited you to help run the website as ${strong("an Admin")} — ${ADMIN_BLURB}.`
      ) +
      p(
        `Open the link to choose your own password — nobody else ever sees it. It works once and expires in ${strong(esc(expiresIn))}; if it has, ask the team for a fresh one.`
      ),
    cta: "Accept invite & set password",
    link,
    footnote: `You’re getting this because the ${esc(site.name)} team added you to the admin panel. Not expecting it? Ignore this email — nothing happens unless you open the link.`,
  });

  const text = [
    hello,
    "",
    `The ${site.name} team has invited you to help run the website as an Admin — ${ADMIN_BLURB}.`,
    "",
    "Accept the invite and choose your own password:",
    link,
    "",
    `The link works once and expires in ${expiresIn}. If it has, ask the team for a fresh one.`,
    "",
    `Not expecting this? Ignore it — nothing happens unless you open the link.`,
    `— ${site.name}`,
  ].join("\n");

  return send({
    to,
    subject: `You’re invited to the ${site.name} admin panel`,
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
  /** true when the owner sent it from the Team page, rather than "Forgot password?" */
  byOwner?: boolean;
}): Promise<SendResult> {
  const { to, name, link, expiresIn, byOwner } = args;
  const hello = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const who = byOwner
    ? `The ${site.name} team sent you a link to reset your admin panel password.`
    : `Someone (hopefully you) asked to reset your ${site.name} admin panel password.`;

  const html = layout({
    preheader: `Reset your ${site.name} panel password.`,
    eyebrow: "Admin panel · Password",
    heading: "Reset your password",
    bodyHtml:
      p(esc(hello)) +
      p(esc(who)) +
      p(
        `You choose the new password yourself. Saving it signs your account out everywhere else. The link works once and expires in ${strong(esc(expiresIn))}.`
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

/**
 * A staff member's reply to an inbox lead (app/admin/inbox-actions.ts). The
 * subject, text and escaped HTML are built by lib/lead-reply.ts. Sent from
 * the panel sender (ADMIN_FROM_EMAIL → CONTACT_FROM_EMAIL → sandbox) with
 * `replyTo` = the studio inbox, so when the person answers, the conversation
 * carries on in the real mailbox rather than at a no-reply address.
 * Non-throwing like every send here; the caller records sent / not sent.
 */
export async function sendLeadReplyEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  return send({
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: process.env.CONTACT_TO_EMAIL || site.email || undefined,
  });
}
