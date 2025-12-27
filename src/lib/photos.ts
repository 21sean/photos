/**
 * Album Photos Data
 * 
 * This file imports the auto-generated photos.json manifest.
 * 
 * To update photos:
 * 1. Upload images to R2
 * 2. Run: ./scripts/build-photos-manifest.sh
 * 
 * The manifest is generated from R2 using rclone.
 */

import photosData from './photos.json';
import { R2Photo } from './r2';

// Type the imported JSON
export const albumPhotos: Record<string, R2Photo[]> = photosData as Record<string, R2Photo[]>;
