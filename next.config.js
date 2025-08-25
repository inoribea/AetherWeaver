/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, options) {
    // 忽略 .cs 和 .html 文件
    config.module.rules.push({
      test: /\.cs$/,
      use: 'ignore-loader',
    });
    config.module.rules.push({
      test: /\.html$/,
      use: 'ignore-loader',
    });

    // Extend other webpack config as needed without jieba-js specific rules

    return config;
  }
};

let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (e) {
  // If @next/bundle-analyzer isn't installed, fall back to identity.
  withBundleAnalyzer = (config) => config;
}

module.exports = withBundleAnalyzer(nextConfig);