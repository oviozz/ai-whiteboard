import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Ignore ESLint errors during production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Fix tldraw duplicate imports warning
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure tldraw packages are only imported once
      config.resolve.alias = {
        ...config.resolve.alias,
        // Deduplicate tldraw packages
        'tldraw': require.resolve('tldraw'),
        '@tldraw/editor': require.resolve('@tldraw/editor'),
        '@tldraw/store': require.resolve('@tldraw/store'),
        '@tldraw/state': require.resolve('@tldraw/state'),
        '@tldraw/state-react': require.resolve('@tldraw/state-react'),
        '@tldraw/tlschema': require.resolve('@tldraw/tlschema'),
        '@tldraw/utils': require.resolve('@tldraw/utils'),
        '@tldraw/validate': require.resolve('@tldraw/validate'),
      };
    }
    return config;
  },
};

export default nextConfig;
