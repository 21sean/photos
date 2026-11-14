import type { Destination } from '@/lib/destinations';
import { GLOBE_THEME } from './theme';

export type Arc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: readonly string[];
};

type LatLng = { lat: number; lng: number };

/** How many routes may leave any one marker, so hubs don't become starbursts. */
const MAX_ROUTES_PER_MARKER = 4;

// ~11 m: enough to merge markers that are really the same spot
const coordKey = ({ lat, lng }: LatLng) =>
  `${lat.toFixed(4)},${lng.toFixed(4)}`;

/** Every distinct marked position: each destination plus its side spots. */
function uniqueSpots(destinations: Destination[]): LatLng[] {
  const seen = new Set<string>();
  const spots: LatLng[] = [];
  for (const destination of destinations) {
    for (const spot of [destination, ...destination.spots]) {
      const key = coordKey(spot);
      if (seen.has(key)) continue;
      seen.add(key);
      spots.push({ lat: spot.lat, lng: spot.lng });
    }
  }
  return spots;
}

/**
 * Routes between markers. Each marker is linked to its nearest neighbours
 * first, and capped, which keeps the globe readable where markers cluster.
 * The result is deterministic so it doesn't reshuffle between renders.
 */
export function buildArcs(destinations: Destination[]): Arc[] {
  const spots = uniqueSpots(destinations);

  const pairs: Array<{ a: number; b: number; distance: number }> = [];
  for (let a = 0; a < spots.length; a++) {
    for (let b = a + 1; b < spots.length; b++) {
      const dLat = spots[a].lat - spots[b].lat;
      const dLng = spots[a].lng - spots[b].lng;
      pairs.push({ a, b, distance: dLat * dLat + dLng * dLng });
    }
  }
  pairs.sort((x, y) => x.distance - y.distance);

  const routeCount = new Array<number>(spots.length).fill(0);
  const arcs: Arc[] = [];
  for (const { a, b } of pairs) {
    if (
      routeCount[a] >= MAX_ROUTES_PER_MARKER ||
      routeCount[b] >= MAX_ROUTES_PER_MARKER
    ) {
      continue;
    }
    routeCount[a]++;
    routeCount[b]++;
    arcs.push({
      startLat: spots[a].lat,
      startLng: spots[a].lng,
      endLat: spots[b].lat,
      endLng: spots[b].lng,
      color: GLOBE_THEME.arc
    });
  }
  return arcs;
}
