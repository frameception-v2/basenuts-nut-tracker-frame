/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.seadn.io', // Common host for Farcaster PFPs
      },
    ],
  },
}

module.exports = nextConfig
