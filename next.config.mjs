import bundleAnalyzer from '@next/bundle-analyzer';

const analyzerMode = process.env.BUNDLE_ANALYZER_MODE ?? 'json';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
  analyzerMode,
  reportFilename:
    process.env.BUNDLE_ANALYZER_REPORT ??
    (analyzerMode === 'json' ? 'analyze/client.json' : 'analyze/client.html'),
  generateStatsFile: analyzerMode !== 'json',
  statsFilename: process.env.BUNDLE_ANALYZER_STATS ?? 'analyze/client-stats.json',
  defaultSizes: 'gzip',
});

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

export default withBundleAnalyzer(nextConfig);
