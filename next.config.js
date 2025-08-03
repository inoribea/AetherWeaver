const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = withBundleAnalyzer({
  webpack(config) {
    config.module.rules.push({
      test: /\.html$/,
      use: ['html-loader'],
    })
    return config
  },
})

module.exports = nextConfig