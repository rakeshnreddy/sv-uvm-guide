import { curriculumRedirects } from './src/generated/curriculum-redirects.mjs';

let withBundleAnalyzer = (config) => config;

try {
  const { default: bundleAnalyzer } = await import('@next/bundle-analyzer');
  withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
    openAnalyzer: false,
    analyzerMode: process.env.BUNDLE_ANALYZER_MODE ?? 'json',
  });
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') {
    throw error;
  }
  console.warn('Bundle analyzer disabled: optional dependency not installed.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add your Next.js config options here
  output: 'standalone',
  // /curriculum/expert-index parses every lesson at build time. On a slow Cloudflare
  // build machine it exceeded the default 60 s per page three times and failed the
  // deploy (build ea57fd7b, 2026-10-27), so allow 5 minutes per page.
  staticPageGenerationTimeout: 300,
  eslint: {
    ignoreDuringBuilds: false,
  },

  async redirects() {
    return curriculumRedirects;
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
