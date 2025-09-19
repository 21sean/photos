/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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