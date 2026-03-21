import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ggpht.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "i.ytimg.com" }
    ]
  }
};

export default nextConfig;
