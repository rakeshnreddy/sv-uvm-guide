/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add your Next.js config options here
  output: 'standalone',

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default nextConfig;
