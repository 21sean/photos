/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'react-globe.gl',
    'globe.gl',
    'three-globe',
    'three-conic-polygon-geometry',
    '@turf/boolean-point-in-polygon'
  ],
  images: {
    domains: ['picsum.photos', 'cdn.myportfolio.com']
  }
};

export default nextConfig;
