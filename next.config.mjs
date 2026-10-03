import { securityHeaders } from "./lib/security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSP, HSTS, nosniff, Referrer/Permissions/COOP, and the stricter /admin set.
  // Built in lib/security-headers.mjs (unit-tested); read its header comment
  // for why the CSP has no nonce. Evaluated at build time, so the Supabase
  // origin comes from the build's env — the same value the client bundle has.
  async headers() {
    return securityHeaders({
      // Next sets NODE_ENV before loading this file: development under
      // `next dev`, production under `next build` / `next start`
      dev: process.env.NODE_ENV !== "production",
      // HSTS + upgrade-insecure-requests only where TLS is guaranteed. A local
      // `next start` is production but plain http://localhost.
      https: process.env.VERCEL === "1",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      // Vercel injects its toolbar (vercel.live) into PREVIEW deployments only
      vercelPreview: process.env.VERCEL_ENV === "preview",
    });
  },

  // Work tiles render at quality 90; declare it (required config in Next.js 16).
  images: {
    qualities: [90],
    // Screenshots uploaded through the admin panel are served from Supabase
    // Storage. Only the configured project's host is allowed.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },

  // Lets a production build write somewhere other than .next, so verifying the
  // build never corrupts the manifests an active `next dev` is using (the
  // "Cannot read properties of undefined (reading 'call')" trap in CLAUDE.md).
  //   NEXT_DIST_DIR=.next-verify npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
