import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Add this line for optimized Docker builds
};

export default nextConfig;
