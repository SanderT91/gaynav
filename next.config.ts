import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The public-flow test builds into its own folder (inside .next, so it is
  // ignored like any build output) and never overwrites the normal build.
  distDir: process.env.GAYNAV_DIST_DIR || ".next",
};

export default nextConfig;
