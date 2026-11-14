/**
 * Cloudflare R2 image URLs.
 *
 * Every photo has a "web master" AVIF at `web/{album}/{name}.avif`. The
 * optimizer (`npm run optimize:web`) can also publish downscaled copies at
 * `web/{album}/{name}-{width}w.avif`; the manifest lists the widths that
 * exist as `variants`, and the site then serves them through `srcset`.
 */

import type { Photo } from '@/types';

/**
 * Origin of the R2 bucket, served through its custom domain on the site's
 * zone. Set NEXT_PUBLIC_IMAGE_ORIGIN at build time to point elsewhere.
 */
export const IMAGE_ORIGIN =
  process.env.NEXT_PUBLIC_IMAGE_ORIGIN?.replace(/\/+$/, '') ||
  'https://images.paganitech.com';

/** One entry of the generated `photos.json` manifest. */
export interface R2Photo {
  filename: string;
  title?: string;
  width: number;
  height: number;
  size?: number;

  /** Widths (px) of the downscaled AVIFs available for this photo. */
  variants?: number[];
  /** Tiny blurred preview as a data URI, shown while the photo loads. */
  lqip?: string;

  // Optional AI-enrichment fields
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

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * URL of a photo. Without `width` this is the full-size web master; with it,
 * the downscaled variant of that width.
 */
function getImageUrl(album: string, filename: string, width?: number): string {
  const suffix = width ? `-${width}w` : '';
  return `${IMAGE_ORIGIN}/web/${album}/${baseName(filename)}${suffix}.avif`;
}

/** The default `src` when variants exist: big enough for most screens. */
const DEFAULT_VARIANT_WIDTH = 1920;

function pickDefaultVariant(variants: number[]): number {
  const fitting = variants.filter(width => width <= DEFAULT_VARIANT_WIDTH);
  return fitting.length ? Math.max(...fitting) : Math.min(...variants);
}

/** Turn a manifest entry into the `Photo` the app renders. */
function toPhoto(album: string, photo: R2Photo): Photo {
  const variants = [...(photo.variants ?? [])].sort((a, b) => a - b);
  const hasVariants = variants.length > 0;

  return {
    url: hasVariants
      ? getImageUrl(album, photo.filename, pickDefaultVariant(variants))
      : getImageUrl(album, photo.filename),
    srcSet: hasVariants
      ? variants
          .map(
            width => `${getImageUrl(album, photo.filename, width)} ${width}w`
          )
          .join(', ')
      : undefined,
    thumbnailUrl: hasVariants
      ? getImageUrl(album, photo.filename, variants[0])
      : undefined,
    lqip: photo.lqip,
    title: photo.title || baseName(photo.filename).replace(/-/g, ' '),
    width: photo.width,
    height: photo.height,
    size: photo.size || 0,

    aiDescriptionHtml: photo.aiDescriptionHtml,
    fun_fact: photo.fun_fact,

    isHDR: photo.isHDR,
    colorSpace: photo.colorSpace,
    hdrMetadata: photo.hdrMetadata,

    iso: photo.iso,
    aperture: photo.aperture,
    shutterSpeed: photo.shutterSpeed,
    focalLength: photo.focalLength,
    dateTaken: photo.dateTaken
  };
}

export function toPhotos(album: string, photos: R2Photo[]): Photo[] {
  return photos.map(photo => toPhoto(album, photo));
}
