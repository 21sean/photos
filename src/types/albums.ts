export const types = {
  LOCATION: 'location',
  CUSTOM: 'custom'
} as const;

/** A string that is known to be an album title (see `albums.ts`). */
export type AlbumTitle = string & { readonly __brand: 'AlbumTitle' };

export type AlbumLocation = {
  description?: string;
  date?: string;
  lat: number;
  lng: number;
};

export type Album = {
  title: AlbumTitle;
  description: string | null;
  date: string | null;
  lat: number;
  lng: number;
  /** Short list of cities/areas (2–3) shown as pills on the album page. */
  topCities?: string[];
  locations: AlbumLocation[];
  /** `#rrggbb` */
  color: string;
  order: number;
  type: (typeof types)[keyof typeof types];
};

export type AlbumList = Album[];
