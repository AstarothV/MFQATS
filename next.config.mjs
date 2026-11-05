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
  // The Quality Scan tools reach the Python detection server through src/app/(staff)/staff/yolo/[...path]/route.ts.
  // No webpack() hook: `npm run dev` uses Turbopack, and the old hook (a website-builder file-watch option that was
  // never set) only made Next warn "Webpack is configured while Turbopack is not".
};
export default nextConfig;