/**
 * Cloudflare R2 Configuration
 * 
 * This file centralizes all R2-related configuration for the photo portfolio.
 * Update R2_BASE_URL when your custom domain is configured.
 */

// Base URL for R2 images
// Once your custom domain is set up, change this to: 'https://images.sean.ventures'
export const R2_BASE_URL = 'https://images.sean.ventures';

// Fallback to direct R2 endpoint if needed (before custom domain is configured)
// export const R2_BASE_URL = 'https://pub-XXXXX.r2.dev'; // Your public bucket URL

/**
 * Generate a full R2 URL for an image
 * @param album - Album slug (folder name in R2)
 * @param filename - Image filename
 * @returns Full URL to the image
 */
export function getImageUrl(album: string, filename: string): string {
  return `${R2_BASE_URL}/${album}/${filename}`;
}

/**
 * Generate R2 URL from just a path
 * @param path - Path relative to bucket root (e.g., "lisbon/photo-1.jpeg")
 * @returns Full URL to the image
 */
export function getR2Url(path: string): string {
  return `${R2_BASE_URL}/${path}`;
}

/**
 * Helper to create a photo object with R2 URL
 * This makes it easy to add new photos with minimal configuration
 */
export interface R2Photo {
  filename: string;
  title?: string;
  width: number;
  height: number;
  size?: number;
  isHDR?: boolean;
  colorSpace?: 'sRGB' | 'P3' | 'Rec2020';
  hdrMetadata?: {
    maxLuminance?: number;
    minLuminance?: number;
    colorGamut?: string;
  };
  // EXIF metadata
  iso?: number;
  aperture?: number;
  shutterSpeed?: string;
  focalLength?: string;
  dateTaken?: string;
}

/**
 * Convert R2Photo to full Photo object with URL
 * @param album - Album slug for URL generation
 * @param photo - R2Photo definition
 */
export function toPhoto(album: string, photo: R2Photo) {
  return {
    url: getImageUrl(album, photo.filename),
    title: photo.title || photo.filename.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
    width: photo.width,
    height: photo.height,
    size: photo.size || 0,
    isHDR: photo.isHDR,
    colorSpace: photo.colorSpace,
    hdrMetadata: photo.hdrMetadata,
    // EXIF metadata
    iso: photo.iso,
    aperture: photo.aperture,
    shutterSpeed: photo.shutterSpeed,
    focalLength: photo.focalLength,
    dateTaken: photo.dateTaken,
  };
}

/**
 * Batch convert R2Photos to Photo objects
 * @param album - Album slug
 * @param photos - Array of R2Photo definitions
 */
export function toPhotos(album: string, photos: R2Photo[]) {
  return photos.map(photo => toPhoto(album, photo));
}
