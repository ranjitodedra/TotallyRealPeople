import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything here is per-request (profiles, tokens), so no component caching.
  cacheComponents: false,
  serverExternalPackages: ["unpdf"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
