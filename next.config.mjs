const analyzerMode = process.env.BUNDLE_ANALYZER_MODE ?? 'json';

let withBundleAnalyzer = (config) => config;

try {
  const { default: bundleAnalyzer } = await import('@next/bundle-analyzer');
  withBundleAnalyzer = bundleAnalyzer({
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
  eslint: {
    ignoreDuringBuilds: false,
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
