import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Post photos are compressed in the browser before upload, so they are
  // already small. 1MB matches the storage limit.
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async redirects() {
    return [
      { source: "/", destination: "/home", permanent: false },
      // Postponed features (see app/(main)/_postponed/README.md): old links go to the Learning Hub.
      { source: "/opportunities/:path*", destination: "/learning-hub", permanent: false },
      { source: "/mentorship", destination: "/learning-hub", permanent: false },
      { source: "/tawjihi/:path*", destination: "/learning-hub", permanent: false },
      { source: "/skill-exchange", destination: "/clubs", permanent: false },
      { source: "/magazine", destination: "/clubs", permanent: false },
      { source: "/yearbook", destination: "/clubs", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Loop is private: tell search engines not to index anything.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
