/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/photos',
  assetPrefix: '/photos',
  images: {
    unoptimized: true,
    domains: ['picsum.photos', 'cdn.myportfolio.com']
  }
};

export default nextConfig;