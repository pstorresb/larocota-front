import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "4000", pathname: "/api/v1/media/products/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "4000", pathname: "/api/v1/media/products/**" },
      { protocol: "https", hostname: "larocota.com", pathname: "/api/v1/media/products/**" },
    ],
  },
};

export default nextConfig;
