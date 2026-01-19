import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure transpilation for packages that need it
  transpilePackages: ["ol", "shpjs"],

  // Disable ESLint during builds (can be enabled later)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript errors during builds (for migration phase)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Configure webpack for OpenLayers and other packages
  webpack: (config) => {
    // Handle canvas for OpenLayers (if needed)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    };

    return config;
  },
};

export default nextConfig;
