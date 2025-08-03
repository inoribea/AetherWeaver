const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const path = require('path');

module.exports = withBundleAnalyzer({
  webpack(config) {
    config.module.rules.push({
      test: /\.cs$/,
      use: 'ignore-loader',
    });
    config.module.rules.push({
      test: /\.html$/,
      use: 'ignore-loader',
    });
    return config;
  },
});