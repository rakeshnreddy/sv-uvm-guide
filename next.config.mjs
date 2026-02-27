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

  async redirects() {
    return [
      {
        source: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-config-db',
        destination: '/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-resource-db',
        destination: '/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/connecting',
        destination: '/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/environment-test-classes',
        destination: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-monitor',
        destination: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-scoreboard',
        destination: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-subscriber',
        destination: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/:slug*',
        destination: '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/:slug*',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing',
        destination: '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro(/:slug*)',
        destination: '/curriculum/T2_Intermediate/I-UVM-1A_Components',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-4_Factory_and_Overrides(/:slug*)',
        destination: '/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization(/:slug*)',
        destination: '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/:slug*',
        destination: '/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory/:slug*',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth',
        destination: '/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB(/:slug*)',
        destination: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles',
        permanent: true,
      },
      {
        source: '/curriculum/T2_Intermediate/I-UVM-3_Sequences(/:slug*)',
        destination: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-3_Advanced_UVM_Techniques(/:slug*)',
        destination: '/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL(/:slug*)',
        destination: '/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/built-in-ral-sequences',
        destination: '/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/built-in-ral-sequences',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/explicit-vs-implicit',
        destination: '/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/explicit-vs-implicit',
        permanent: true,
      },
      {
        source: '/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/frontdoor-vs-backdoor',
        destination: '/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/frontdoor-vs-backdoor',
        permanent: true,
      }
    ];
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
