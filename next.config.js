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

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);