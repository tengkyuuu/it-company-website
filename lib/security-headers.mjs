/**
 * Security response headers — the single source for next.config.mjs `headers()`
 * and for tests/security-headers.test.ts. A plain ESM module with no imports so
 * next.config.mjs can load it before anything is compiled.
 *
 * ── Why the CSP has no nonce ────────────────────────────────────────────────
 * A nonce has to be fresh per response, so every page would have to render per
 * request — that turns the prerendered `○`/`●` public pages (the whole point of
 * lib/supabase/public.ts and the cookie-free middleware) into `ƒ` dynamic
 * renders. So `script-src` carries 'unsafe-inline', which Next.js needs for the
 * inline RSC payload (`self.__next_f.push(...)`) and which the blocking
 * ThemeScript in <head> needs to stamp data-theme before first paint.
 * Everything else is locked down: scripts only from this origin, no
 * 'unsafe-eval' in production, no plugins, no foreign <base>, forms post only
 * here, and nobody may frame the site.
 *
 * ── The origins the browser actually talks to (keep in sync with the test) ──
 *  'self'          pages, /_next/static, /_next/image, /api/{chat,contact,apply},
 *                  /_vercel/insights + /_vercel/speed-insights (both packages
 *                  load their script from, and report to, the SAME origin when
 *                  deployed on Vercel), /sw.js, /manifest.webmanifest
 *  Supabase        NEXT_PUBLIC_SUPABASE_URL over https (REST: live-update poll,
 *                  admin auth + Storage uploads) and wss (Realtime: live updates,
 *                  the admin inbox). Taken from env, so it's exact.
 *  any https: img  CMS images (the admin's imagePath allows any https host) and
 *                  Supabase Storage objects
 *  any https: frame  live project previews (LivePreview iframes a project's
 *                  liveUrl, which can be any https site) and the Google Maps
 *                  embed on /location (maps.google.com, which may redirect)
 *  data: img       the grain texture in globals.css (an inline SVG data URI),
 *                  next/image blur placeholders
 *  dev only        'unsafe-eval' (React Refresh / webpack eval source maps),
 *                  ws: (HMR socket), https://va.vercel-scripts.com (the Vercel
 *                  packages' debug scripts in development)
 *  preview only    vercel.live + its pusher socket (VERCEL_PREVIEW_SOURCES):
 *                  the toolbar Vercel injects into preview deployments
 * Nothing loads fonts from a CDN: next/font self-hosts Syne and Geist under
 * /_next/static/media. three/drei use no remote assets (no Environment presets,
 * no remote textures or fonts).
 */

/** The Vercel analytics/speed-insights packages load debug builds from here in dev. */
export const VERCEL_DEV_SCRIPTS = "https://va.vercel-scripts.com";

/**
 * Deny powerful features nothing on the site uses. Only names Chrome
 * recognises — an unknown feature name is logged as a console error.
 */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/**
 * The Supabase project's https origin and its Realtime (ws) twin, from
 * NEXT_PUBLIC_SUPABASE_URL. Empty when unset or unparseable.
 * @param {string | undefined | null} supabaseUrl
 * @returns {string[]}
 */
export function supabaseOrigins(supabaseUrl) {
  if (!supabaseUrl) return [];
  try {
    const u = new URL(supabaseUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return [];
    const ws = `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`;
    return [u.origin, ws];
  } catch {
    return [];
  }
}

/**
 * @typedef {object} CspOptions
 * @property {boolean} [dev]       development server (NODE_ENV !== "production")
 * @property {boolean} [https]     deployed behind TLS (Vercel) — adds upgrade-insecure-requests
 * @property {string | null} [supabaseUrl]  NEXT_PUBLIC_SUPABASE_URL
 * @property {"public" | "admin"} [area]
 * @property {boolean} [vercelPreview]  a Vercel PREVIEW deployment (VERCEL_ENV=preview)
 */

/**
 * What Vercel's toolbar (injected into preview deployments only, from
 * vercel.live) needs, per Vercel's CSP docs. Never part of a production CSP.
 */
export const VERCEL_PREVIEW_SOURCES = {
  "script-src": ["https://vercel.live"],
  "style-src": ["https://vercel.live"],
  "font-src": ["https://vercel.live", "https://assets.vercel.com"],
  "connect-src": ["https://vercel.live", "wss://ws-us3.pusher.com"],
  "frame-src": ["https://vercel.live"],
};

/**
 * The CSP as an ordered directive → sources map (tests read this; the header is
 * its serialisation).
 * @param {CspOptions} [options]
 * @returns {Record<string, string[]>}
 */
export function cspDirectives({
  dev = false,
  https = false,
  supabaseUrl = null,
  area = "public",
  vercelPreview = false,
} = {}) {
  const d = baseDirectives({ dev, https, supabaseUrl, area });
  if (vercelPreview) {
    for (const [name, extra] of Object.entries(VERCEL_PREVIEW_SOURCES)) {
      // the panel's frame-src is 'none', which can't be combined with a source
      const current = d[name].filter((s) => s !== "'none'");
      d[name] = [...current, ...extra.filter((s) => !current.includes(s))];
    }
  }
  return d;
}

/**
 * @param {Omit<CspOptions, "vercelPreview">} options
 * @returns {Record<string, string[]>}
 */
function baseDirectives({ dev = false, https = false, supabaseUrl = null, area = "public" }) {
  const supabase = supabaseOrigins(supabaseUrl);
  /** @type {Record<string, string[]>} */
  const d = {
    "default-src": ["'self'"],
    // 'unsafe-inline': Next's inline RSC payload + ThemeScript (see the header
    // comment — a nonce would make every page dynamic). Never 'unsafe-eval' in
    // production.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'", VERCEL_DEV_SCRIPTS] : [])],
    // React style={{}} attributes, framer-motion, next/font's injected <style>
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabase, ...(dev ? ["ws:", VERCEL_DEV_SCRIPTS] : [])],
    "media-src": ["'self'"],
    // the panel frames nothing; the public site frames live project previews
    // (any https site — the CMS's liveUrl) and the Google Maps embed
    "frame-src": area === "admin" ? ["'none'"] : ["https:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // nothing frames this site, including itself
    "frame-ancestors": ["'none'"],
  };
  // https deployments only: on `next start` over http://localhost this would
  // rewrite every same-origin subresource to https:// and break the page
  if (https) d["upgrade-insecure-requests"] = [];
  return d;
}

/**
 * @param {Record<string, string[]>} directives
 * @returns {string}
 */
export function serializeCsp(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => (sources.length ? `${name} ${sources.join(" ")}` : name))
    .join("; ");
}

/**
 * @param {CspOptions} [options]
 * @returns {string}
 */
export function contentSecurityPolicy(options = {}) {
  return serializeCsp(cspDirectives(options));
}

/**
 * @typedef {{ key: string; value: string }} Header
 * @typedef {{ source: string; headers: Header[] }} HeaderRule
 */

/**
 * The full `headers()` list for next.config.mjs. Order matters: when two rules
 * match a path and set the same key, Next applies the LATER one — so the admin
 * rule comes last and its CSP replaces the public one under /admin.
 *
 * Not set here, on purpose:
 *  - Cache-Control for /admin: every panel page reads cookies()/headers(), so
 *    Next already sends `private, no-cache, no-store, max-age=0,
 *    must-revalidate`; and Next overwrites a next.config Cache-Control on page
 *    routes in production anyway.
 *  - COEP: `require-corp` would block the Google Maps embed, CMS images on other
 *    hosts and the live previews.
 *
 * @param {Omit<CspOptions, "area">} [options]
 * @returns {HeaderRule[]}
 */
export function securityHeaders({ dev = false, https = false, supabaseUrl = null, vercelPreview = false } = {}) {
  /** @type {Header[]} */
  const common = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy({ dev, https, supabaseUrl, vercelPreview, area: "public" }),
    },
  ];
  // Browsers ignore HSTS received over plain http, but it is meaningless off
  // TLS, so it goes out only where the site is actually served over https.
  if (https) common.push({ key: "Strict-Transport-Security", value: "max-age=63072000" });

  return [
    { source: "/:path*", headers: common },
    {
      // `:path*` is zero-or-more segments, so this matches /admin itself too
      source: "/admin/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy({ dev, https, supabaseUrl, vercelPreview, area: "admin" }),
        },
        { key: "X-Frame-Options", value: "DENY" },
        // belt and braces with the layout's robots metadata: also covers
        // redirects and error responses that render no <head>
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
  ];
}
