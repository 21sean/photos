/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  output: isExport ? 'export' : undefined,
  trailingSlash: true,
  // Remove basePath if deploying to root domain
  // basePath: '/photos',
  // assetPrefix: '/photos',
  images: {
    unoptimized: true,
    domains: ['picsum.photos', 'cdn.myportfolio.com']
  }
};

export default nextConfig;