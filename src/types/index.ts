export * from './albums';

export type Photo = {
  size: number;
  /** Default image URL (`src`). */
  url: string;
  /** Responsive candidates, when downscaled variants exist. */
  srcSet?: string;
  /** Smallest variant, for previews. Absent until variants are published. */
  thumbnailUrl?: string;
  /** Tiny blurred preview (data URI) shown while the photo loads. */
  lqip?: string;
  width: number;
  height: number;
  title?: string;

  aiDescription?: string;
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
};
