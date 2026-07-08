/** @type {import('next').NextConfig} */
const nextConfig = {
  // All imagery is served locally from /public — no remote patterns needed.
  // Work tiles render at quality 90; declare it (required config in Next.js 16).
  images: { qualities: [90] },
};

export default nextConfig;
