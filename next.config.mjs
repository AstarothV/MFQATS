import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // off: browser source maps slowed every build and published the app's source code
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85], // AppImage uses 85
  },
  // Browser security headers on every page: no framing by other sites (clickjacking), no MIME guessing, HTTPS only,
  // a minimal referrer, and camera/microphone only for this site (Quality Scan uses the camera).
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
      ],
    }];
  },
  // The Quality Scan tools reach the Python detection server through src/app/(staff)/staff/yolo/[...path]/route.ts.
  // No webpack() hook: `npm run dev` uses Turbopack, and the old hook (a website-builder file-watch option that was
  // never set) only made Next warn "Webpack is configured while Turbopack is not".
};
export default nextConfig;