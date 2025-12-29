export * from './albums';
export * from './folders';

// Photo type definition for mock data
export type Photo = {
  size: number;
  url: string;
  width: number;
  height: number;
  title?: string;

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
