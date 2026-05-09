/**
 * Cloudflare R2 Configuration
 * 
 * This file centralizes all R2-related configuration for the photo portfolio.
 * Update R2_BASE_URL when your custom domain is configured.
 */

// Base URL for the R2 bucket, served through the custom domain.
const R2_BASE_URL = 'https://images.sean.ventures';

/**
 * Generate a full R2 URL for an image.
 * Resolves to the web-optimized AVIF version stored under the web/ prefix.
 * @param album - Album slug (folder name in R2)
 * @param filename - Image filename
 * @returns Full URL to the web-optimized image
 */
export function getImageUrl(album: string, filename: string): string {
  const baseName = filename.replace(/\.[^.]+$/, ''); // Remove extension
  return `${R2_BASE_URL}/web/${album}/${baseName}.avif`;
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

  // Optional AI-enrichment fields (written into `src/lib/photos.json`)
  aiDescriptionHtml?: string;
  fun_fact?: string;

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

    // AI enrichment (optional)
    aiDescriptionHtml: photo.aiDescriptionHtml,
    fun_fact: photo.fun_fact,

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
