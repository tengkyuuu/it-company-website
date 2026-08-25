/** @type {import('next').NextConfig} */
const nextConfig = {
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
