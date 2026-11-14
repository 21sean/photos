import { albums } from './albums';

/**
 * What the landing page needs to know about an album: enough to list it,
 * place it on the globe and describe it, without shipping every photo's
 * metadata to the browser.
 */
export type Destination = {
  slug: string;
  title: string;
  /** 1-based position in the alphabetical index. */
  index: number;
  lat: number;
  lng: number;
  year: string | null;
  description: string | null;
  /** Up to three cities or areas covered by the album. */
  places: string[];
  photoCount: number;
  /** Other marked spots that belong to this album (side trips, districts). */
  spots: Array<{ lat: number; lng: number }>;
  /** First photo of the album, for warming up the gallery. */
  lead?: { url: string; srcSet?: string };
  /** Small preview of the first photo. Needs published image variants. */
  preview?: { url: string; lqip?: string; width: number; height: number };
};

export function getDestinations(): Destination[] {
  return [...albums]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((album, i) => {
      const first = album.photos[0];
      return {
        slug: album.slug,
        title: album.title,
        index: i + 1,
        lat: album.lat,
        lng: album.lng,
        year: album.date,
        description: album.description,
        places: album.topCities,
        photoCount: album.photos.length,
        spots: album.locations
          .filter(spot => spot.lat !== album.lat || spot.lng !== album.lng)
          .map(({ lat, lng }) => ({ lat, lng })),
        lead: first && { url: first.url, srcSet: first.srcSet },
        preview: first?.thumbnailUrl
          ? {
              url: first.thumbnailUrl,
              lqip: first.lqip,
              width: first.width,
              height: first.height
            }
          : undefined
      };
    });
}
