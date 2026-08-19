import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/oyun/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      fs: "./src/lib/empty-module.js",
      path: "./src/lib/empty-module.js",
      crypto: "./src/lib/empty-module.js",
      stream: "./src/lib/empty-module.js",
      buffer: "./src/lib/empty-module.js",
      util: "./src/lib/empty-module.js",
      os: "./src/lib/empty-module.js",
      net: "./src/lib/empty-module.js",
      tls: "./src/lib/empty-module.js",
      child_process: "./src/lib/empty-module.js",
    },
  },
};

export default nextConfig;
