/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  output: isExport ? 'export' : undefined,
  trailingSlash: true,
  images: {
    // Photos are pre-encoded AVIFs served straight from R2, so the Next.js
    // image optimizer is never involved.
    unoptimized: true
  }
};

export default nextConfig;
