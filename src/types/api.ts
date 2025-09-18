import { z } from 'zod';
import { AlbumSchema, FolderSchema } from '.';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type SuccessResponse = {
  success: boolean;
};

export type ErrorResponse = {
  success: false;
  message: string;
  error?: z.ZodError | string;
};

export type Config = {
  method?: Method;
  timeout?: number;
  preview?: boolean;
  headers?: Record<string, string>;
} & globalThis.RequestInit;

export const PhotoSchema = z.object({
  size: z.number(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  title: z.string().optional(),
  isHDR: z.boolean().optional(),
  colorSpace: z.enum(['sRGB', 'P3', 'Rec2020']).optional(),
  hdrMetadata: z.object({
    maxLuminance: z.number().optional(),
    minLuminance: z.number().optional(),
    colorGamut: z.string().optional()
  }).optional()
});

export type Photo = z.infer<typeof PhotoSchema>;

export const AlbumResponseSchema = z.object({
  data: z.object({
    photoGalleryCollection: z.object({
      items: z.array(AlbumSchema)
    })
  })
});

export const AlbumPhotosResponseSchema = z.object({
  data: z.object({
    photoGalleryCollection: z.object({
      items: z.array(
        AlbumSchema.extend({
          photosCollection: z.object({
            items: z.array(PhotoSchema)
          })
        })
      )
    })
  })
});

export const AssetsResponseSchema = z.object({
  data: z.object({
    assetCollection: z.object({
      items: z.array(PhotoSchema)
    })
  })
});

export const FolderResponseSchema = z.object({
  data: z.object({
    photoFoldersCollection: z.object({
      items: z.array(FolderSchema)
    })
  })
});

export const FolderPhotosResponseSchema = z.object({
  data: z.object({
    photoFoldersCollection: z.object({
      items: z.array(
        FolderSchema.extend({
          photosCollection: z.object({
            items: z.array(PhotoSchema)
          })
        })
      )
    })
  })
});
