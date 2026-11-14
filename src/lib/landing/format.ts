import type { Destination } from '@/lib/destinations';

/** "07" */
export function ordinal(index: number): string {
  return String(index).padStart(2, '0');
}

/** "5 of 19" */
export function position(index: number, total: number): string {
  return `${index} of ${total}`;
}

/** "38.72° N" / "9.14° W" */
export function formatCoordinates({ lat, lng }: { lat: number; lng: number }): {
  lat: string;
  lng: string;
} {
  return {
    lat: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`,
    lng: `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`
  };
}

/** "7 photos", "1 photo", or "Soon" for an album with nothing in it yet. */
export function photoTally({ photoCount }: Pick<Destination, 'photoCount'>): string {
  if (photoCount === 0) return 'Soon';
  return `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
}

export function albumHref({ slug }: Pick<Destination, 'slug'>): string {
  return `/${slug}/`;
}
