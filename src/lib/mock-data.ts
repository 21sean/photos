/**
 * Album Data for Photography Portfolio
 * 
 * This file defines album metadata (locations, descriptions, etc.)
 * Photos are defined separately in photos.ts and linked via R2.
 * 
 * To add a new album:
 * 1. Add album metadata below
 * 2. Create folder in R2: node scripts/create-r2-folders.js
 * 3. Add photos to photos.ts
 * 4. Upload images: node scripts/migrate-to-r2.js
 */

import { AlbumTitle } from '../types/albums';
import { toPhotos } from './r2';
import { albumPhotos } from './photos';

// =============================================================================
// ALBUM METADATA
// =============================================================================

interface AlbumMeta {
  title: string;
  slug: string; // URL slug and R2 folder name
  color: string;
  type: 'location' | 'custom';
  description: string;
  date: string;
  lat: number;
  lng: number;
  locations: Array<{
    lat: number;
    lng: number;
    description?: string;
  }>;
  order: number;
}

const albumsMeta: AlbumMeta[] = [
  {
    title: "Mexico",
    slug: "mexico",
    color: "#FF6B6B",
    type: "location",
    description: "Vibrant culture, ancient Mayan ruins, and stunning beaches",
    date: "2025",
    lat: 21.1619,
    lng: -86.8515,
    locations: [
      { lat: 21.1619, lng: -86.8515, description: "Cancún" },
      { lat: 21.1619, lng: -86.8515, description: "Tulum" },
      { lat: 21.1619, lng: -86.8515, description: "Playa del Carmen" }
    ],
    order: 1,
  },
  {
    title: "Lisbon",
    slug: "lisbon",
    color: "#4ECDC4",
    type: "location",
    description: "Charming streets, historic trams, and amazing seafood",
    date: "2025",
    lat: 38.7223,
    lng: -9.1393,
    locations: [
      { lat: 38.7223, lng: -9.1393, description: "Alfama" },
      { lat: 38.7071, lng: -9.1364, description: "Bairro Alto" },
      { lat: 38.7071, lng: -9.1364, description: "Sintra" }
    ],
    order: 2,
  },
  {
    title: "Porto",
    slug: "porto",
    color: "#45B7D1",
    type: "location",
    description: "Port wine, azulejo tiles, and rundown charm",
    date: "2025",
    lat: 41.1579,
    lng: -8.6291,
    locations: [
      { lat: 41.1579, lng: -8.6291, description: "Ribeira" },
      { lat: 41.1579, lng: -8.6291, description: "Douro Valley" },
      { lat: 41.1496, lng: -8.6109, description: "Vila Nova de Gaia" }
    ],
    order: 3,
  },
  {
    title: "Prague",
    slug: "prague",
    color: "#96CEB4",
    type: "location",
    description: "Gothic architecture, Prague Castle, and medieval atmosphere",
    date: "2025",
    lat: 50.0755,
    lng: 14.4378,
    locations: [
      { lat: 50.0755, lng: 14.4378, description: "Old Town Square" },
      { lat: 50.0870, lng: 14.4207, description: "Prague Castle" }
    ],
    order: 4,
  },
  {
    title: "Barcelona",
    slug: "barcelona",
    color: "#FFEAA7",
    type: "location",
    description: "Gaudí's masterpieces, vibrant nightlife, and Tapas",
    date: "2025",
    lat: 41.3851,
    lng: 2.1734,
    locations: [
      { lat: 41.4036, lng: 2.1744, description: "Sagrada Familia" },
      { lat: 41.4145, lng: 2.1527, description: "Park Güell" },
      { lat: 41.3841, lng: 2.1770, description: "Gothic Quarter" }
    ],
    order: 5,
  },
  {
    title: "Venice",
    slug: "venice",
    color: "#DDA0DD",
    type: "location",
    description: "Floating city of canals, gondolas, and art",
    date: "2024",
    lat: 45.4408,
    lng: 12.3155,
    locations: [
      { lat: 45.4340, lng: 12.3384, description: "St. Mark's Square" },
      { lat: 45.4381, lng: 12.3343, description: "Rialto Bridge" },
      { lat: 45.4515, lng: 12.3122, description: "Murano" }
    ],
    order: 6,
  },
  {
    title: "Switzerland",
    slug: "switzerland",
    color: "#74B9FF",
    type: "location",
    description: "Alpine peaks, pristine lakes, and charming villages",
    date: "2025",
    lat: 47.3769,
    lng: 8.5417,
    locations: [
      { lat: 47.3769, lng: 8.5417, description: "Zürich" },
      { lat: 47.3769, lng: 8.5417, description: "Lucerne" },
      { lat: 47.3769, lng: 8.5417, description: "Interlaken" }
    ],
    order: 7,
  },
  {
    title: "Milan",
    slug: "milan",
    color: "#00B894",
    type: "location",
    description: "Fashion capital with stunning Gothic architecture",
    date: "2024",
    lat: 45.4642,
    lng: 9.1900,
    locations: [
      { lat: 45.4642, lng: 9.1900, description: "Duomo" },
      { lat: 45.4668, lng: 9.1905, description: "La Scala" },
      { lat: 45.4773, lng: 9.1815, description: "Brera District" }
    ],
    order: 8,
  },
  {
    title: "Tuscany",
    slug: "tuscany",
    color: "#FDCB6E",
    type: "location",
    description: "Rolling hills, vineyards, and Renaissance art",
    date: "2024",
    lat: 43.7711,
    lng: 11.2486,
    locations: [
      { lat: 43.7711, lng: 11.2486, description: "Florence" },
      { lat: 43.7711, lng: 11.2486, description: "Siena" },
      { lat: 43.7711, lng: 11.2486, description: "Pisa" }
    ],
    order: 9,
  },
  {
    title: "Rome",
    slug: "rome",
    color: "#E17055",
    type: "location",
    description: "Eternal city of ancient ruins and timeless beauty",
    date: "2024",
    lat: 41.9028,
    lng: 12.4964,
    locations: [
      { lat: 41.8902, lng: 12.4922, description: "Colosseum" },
      { lat: 41.9029, lng: 12.4534, description: "Vatican City" },
      { lat: 41.8986, lng: 12.4769, description: "Trevi Fountain" }
    ],
    order: 10,
  },
  {
    title: "London",
    slug: "london",
    color: "#A29BFE",
    type: "location",
    description: "Royal palaces, historic landmarks",
    date: "2021",
    lat: 51.5074,
    lng: -0.1278,
    locations: [
      { lat: 51.5007, lng: -0.1246, description: "Westminster" },
      { lat: 51.5081, lng: -0.0759, description: "Tower of London" },
      { lat: 51.5194, lng: -0.1270, description: "Camden" }
    ],
    order: 11,
  },
  {
    title: "San Diego",
    slug: "san-diego",
    color: "#00CEC9",
    type: "location",
    description: "Perfect weather, beautiful beaches, and laid-back vibes",
    date: "2018",
    lat: 32.7157,
    lng: -117.1611,
    locations: [
      { lat: 32.7157, lng: -117.1611, description: "Downtown" },
      { lat: 32.7648, lng: -117.2297, description: "La Jolla" },
      { lat: 32.6953, lng: -117.1564, description: "Balboa Park" }
    ],
    order: 12,
  },
  {
    title: "Los Angeles",
    slug: "los-angeles",
    color: "#FD79A8",
    type: "location",
    description: "Hollywood, beaches, and traffic",
    date: "2021",
    lat: 34.0522,
    lng: -118.2437,
    locations: [
      { lat: 34.0928, lng: -118.3287, description: "Hollywood" },
      { lat: 34.0195, lng: -118.4912, description: "Santa Monica" },
      { lat: 34.0259, lng: -118.7798, description: "Malibu" }
    ],
    order: 13,
  },
  {
    title: "Tennessee",
    slug: "tennessee",
    color: "#6C5CE7",
    type: "location",
    description: "Musical heritage, live music on Broadway, Grand Ole Opry",
    date: "2019",
    lat: 35.7478,
    lng: -86.7945,
    locations: [
      { lat: 35.7478, lng: -86.7945, description: "Nashville" },
      { lat: 35.7478, lng: -86.7945, description: "Memphis" },
      { lat: 35.7478, lng: -86.7945, description: "Knoxville" }
    ],
    order: 14,
  },
  {
    title: "Malta",
    slug: "malta",
    color: "#4ECDC4",
    type: "location",
    description: "Mediterranean islands with crystal waters and ancient history",
    date: "2025",
    lat: 35.8989,
    lng: 14.5146,
    locations: [],
    order: 15,
  },
  {
    title: "Athens",
    slug: "athens",
    color: "#96CEB4",
    type: "location",
    description: "Ancient ruins, lively neighborhoods, and sunset views",
    date: "2025",
    lat: 37.9838,
    lng: 23.7275,
    locations: [
      { lat: 37.9715, lng: 23.7257, description: "Acropolis" },
      { lat: 37.9755, lng: 23.7349, description: "Plaka" },
      { lat: 37.9719, lng: 23.7267, description: "Areopagus" }
    ],
    order: 16,
  },
  {
    title: "Madrid",
    slug: "madrid",
    color: "#45B7D1",
    type: "location",
    description: "Late nights, grand boulevards, and world-class art",
    date: "2025",
    lat: 40.4168,
    lng: -3.7038,
    locations: [
      { lat: 40.4153, lng: -3.6844, description: "Retiro" },
      { lat: 40.4138, lng: -3.6921, description: "Prado" },
      { lat: 40.4203, lng: -3.7058, description: "Gran Vía" }
    ],
    order: 17,
  },
  {
    title: "Germany",
    slug: "germany",
    color: "#FFEAA7",
    type: "location",
    description: "Historic cities, modern design, and beer gardens",
    date: "2025",
    lat: 48.1351,
    lng: 11.5820,
    locations: [],
    order: 18,
  },
  {
    title: "Amalfi",
    slug: "amalfi",
    color: "#DDA0DD",
    type: "location",
    description: "Cliffside villages, lemon groves, and seaside views",
    date: "2025",
    lat: 40.6281,
    lng: 14.4850,
    locations: [
      { lat: 40.6281, lng: 14.4850, description: "Positano" },
      { lat: 40.6498, lng: 14.6116, description: "Amalfi" },
      { lat: 40.6990, lng: 14.7149, description: "Ravello" }
    ],
    order: 19,
  },
];

// =============================================================================
// EXPORTED DATA
// Combines album metadata with photos from R2
// =============================================================================

/**
 * Generate full album objects with photos from R2
 * This is what the app consumes
 */
export const mockAlbums = albumsMeta.map(album => ({
  title: album.title as AlbumTitle,
  color: album.color,
  type: album.type,
  description: album.description,
  date: album.date,
  lat: album.lat,
  lng: album.lng,
  locations: album.locations,
  order: album.order,
  // Photos come from the separate photos.ts file, converted to full URLs
  photos: toPhotos(album.slug, albumPhotos[album.slug] || []),
}));

// =============================================================================
// FOLDERS (unchanged)
// =============================================================================

export const mockFolders = [
  {
    title: "Photography" as AlbumTitle,
    parent_title: "Events" as AlbumTitle,
    description: "",
    date: "2024",
    order: 1,
    photos: []
  }
];
