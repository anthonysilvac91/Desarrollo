import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/",
        permanent: true,
      },
      {
        source: "/app/:path*",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
