/** A string that is known to be an album title (see `albums.ts`). */
export type AlbumTitle = string & { readonly __brand: 'AlbumTitle' };

type AlbumLocation = {
  description?: string;
  date?: string;
  lat: number;
  lng: number;
};

export type Album = {
  title: AlbumTitle;
  /** URL slug, and the album's folder name in the bucket. */
  slug: string;
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
  type: 'location' | 'custom';
};

export type AlbumList = Album[];
