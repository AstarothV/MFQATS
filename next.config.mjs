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
  },
  // The Quality Scan tools reach the Python detection server through src/app/(staff)/staff/yolo/[...path]/route.ts.
  webpack(
    config,
    {
      dev: dev
    }
  ) {
    // (The website builder's @dhiwise/component-tagger loader ran here on every .jsx/.tsx file, adding 7 data-component-*
    // attributes to every element of every page. Removed: nothing reads them, and they slowed compiles.)
    if (dev) {
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    return config;
  },
};
export default nextConfig;