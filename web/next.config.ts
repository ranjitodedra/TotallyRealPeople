import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything here is per-request (profiles, tokens), so no component caching.
  cacheComponents: false,
  serverExternalPackages: ["unpdf"],
  turbopack: {
    // This repo has a separate package-lock at the root for the email service.
    // Keep Next's loader resolution rooted in the web app that owns this config.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
