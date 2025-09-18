// Mock data to replace Contentful
import { AlbumTitle } from '../types/albums';

export const mockAlbums = [
  {
    title: "Mexico" as AlbumTitle,
    color: "#FF6B6B",
    type: "location" as const,
    description: "Vibrant culture, ancient ruins, and stunning beaches",
    date: "2024",
    lat: 23.6345,
    lng: -102.5528,
    locations: [
      { lat: 19.4326, lng: -99.1332, description: "Mexico City" },
      { lat: 20.6597, lng: -105.2254, description: "Puerto Vallarta" },
      { lat: 21.1619, lng: -86.8515, description: "Cancún" }
    ],
    order: 1,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=1",
        title: "Mexican Architecture" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=2", 
        title: "Ancient Ruins" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Lisbon" as AlbumTitle,
    color: "#4ECDC4",
    type: "location" as const, 
    description: "Charming streets, historic trams, and beautiful tiles",
    date: "2024",
    lat: 38.7223,
    lng: -9.1393,
    locations: [
      { lat: 38.7223, lng: -9.1393, description: "Alfama" },
      { lat: 38.7071, lng: -9.1364, description: "Bairro Alto" }
    ],
    order: 2,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=3",
        title: "Tram 28" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=4",
        title: "Azulejo Tiles" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Porto" as AlbumTitle,
    color: "#45B7D1",
    type: "location" as const,
    description: "Port wine, azulejo tiles, and medieval charm",
    date: "2024", 
    lat: 41.1579,
    lng: -8.6291,
    locations: [
      { lat: 41.1579, lng: -8.6291, description: "Ribeira" },
      { lat: 41.1496, lng: -8.6109, description: "Vila Nova de Gaia" }
    ],
    order: 3,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=5",
        title: "Dom Luís I Bridge" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=6",
        title: "Port Wine Cellars" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Prague" as AlbumTitle,
    color: "#96CEB4",
    type: "location" as const,
    description: "Gothic architecture and medieval atmosphere",
    date: "2024", 
    lat: 50.0755,
    lng: 14.4378,
    locations: [
      { lat: 50.0755, lng: 14.4378, description: "Old Town Square" },
      { lat: 50.0870, lng: 14.4207, description: "Prague Castle" }
    ],
    order: 4,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=7",
        title: "Charles Bridge" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=8",
        title: "Astronomical Clock" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Barcelona" as AlbumTitle,
    color: "#FFEAA7",
    type: "location" as const,
    description: "Gaudí's masterpieces and Mediterranean vibes",
    date: "2024", 
    lat: 41.3851,
    lng: 2.1734,
    locations: [
      { lat: 41.4036, lng: 2.1744, description: "Sagrada Familia" },
      { lat: 41.4145, lng: 2.1527, description: "Park Güell" },
      { lat: 41.3841, lng: 2.1770, description: "Gothic Quarter" }
    ],
    order: 5,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=9",
        title: "Sagrada Familia" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=10",
        title: "Park Güell" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Venice" as AlbumTitle,
    color: "#DDA0DD",
    type: "location" as const,
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
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=11",
        title: "Grand Canal" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=12",
        title: "St. Mark's Basilica" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Switzerland" as AlbumTitle,
    color: "#74B9FF",
    type: "location" as const,
    description: "Alpine peaks, pristine lakes, and charming villages",
    date: "2024", 
    lat: 46.8182,
    lng: 8.2275,
    locations: [
      { lat: 46.5197, lng: 6.6323, description: "Lausanne" },
      { lat: 46.9481, lng: 7.4474, description: "Interlaken" },
      { lat: 46.0207, lng: 7.7491, description: "Zermatt" }
    ],
    order: 7,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=13",
        title: "Matterhorn" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=14",
        title: "Lake Geneva" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Milan" as AlbumTitle,
    color: "#00B894",
    type: "location" as const,
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
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=15",
        title: "Milan Cathedral" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=16",
        title: "Galleria Vittorio Emanuele II" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Tuscany" as AlbumTitle,
    color: "#FDCB6E",
    type: "location" as const,
    description: "Rolling hills, vineyards, and Renaissance art",
    date: "2024", 
    lat: 43.7711,
    lng: 11.2486,
    locations: [
      { lat: 43.7696, lng: 11.2558, description: "Florence" },
      { lat: 43.3188, lng: 11.3307, description: "Siena" },
      { lat: 43.4643, lng: 11.8814, description: "Val d'Orcia" }
    ],
    order: 9,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=17",
        title: "Florence Skyline" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=18",
        title: "Tuscan Countryside" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Rome" as AlbumTitle,
    color: "#E17055",
    type: "location" as const,
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
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=19",
        title: "Colosseum" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=20",
        title: "Roman Forum" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "London" as AlbumTitle,
    color: "#A29BFE",
    type: "location" as const,
    description: "Royal palaces, historic landmarks, and modern culture",
    date: "2024", 
    lat: 51.5074,
    lng: -0.1278,
    locations: [
      { lat: 51.5007, lng: -0.1246, description: "Westminster" },
      { lat: 51.5081, lng: -0.0759, description: "Tower of London" },
      { lat: 51.5194, lng: -0.1270, description: "Camden" }
    ],
    order: 11,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=21",
        title: "Big Ben" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=22",
        title: "Tower Bridge" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "San Diego" as AlbumTitle,
    color: "#00CEC9",
    type: "location" as const,
    description: "Perfect weather, beautiful beaches, and laid-back vibes",
    date: "2024", 
    lat: 32.7157,
    lng: -117.1611,
    locations: [
      { lat: 32.7157, lng: -117.1611, description: "Downtown" },
      { lat: 32.7648, lng: -117.2297, description: "La Jolla" },
      { lat: 32.6953, lng: -117.1564, description: "Balboa Park" }
    ],
    order: 12,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=23",
        title: "La Jolla Cove" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=24",
        title: "Balboa Park" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Los Angeles" as AlbumTitle,
    color: "#FD79A8",
    type: "location" as const,
    description: "Hollywood glamour, beaches, and endless sunshine",
    date: "2024", 
    lat: 34.0522,
    lng: -118.2437,
    locations: [
      { lat: 34.0928, lng: -118.3287, description: "Hollywood" },
      { lat: 34.0195, lng: -118.4912, description: "Santa Monica" },
      { lat: 34.0259, lng: -118.7798, description: "Malibu" }
    ],
    order: 13,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=25",
        title: "Hollywood Sign" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=26",
        title: "Santa Monica Pier" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Tennessee" as AlbumTitle,
    color: "#6C5CE7",
    type: "location" as const,
    description: "Music heritage, southern charm, and natural beauty",
    date: "2024", 
    lat: 35.7478,
    lng: -86.7945,
    locations: [
      { lat: 36.1627, lng: -86.7816, description: "Nashville" },
      { lat: 35.9606, lng: -83.9207, description: "Great Smoky Mountains" },
      { lat: 35.0456, lng: -85.3097, description: "Chattanooga" }
    ],
    order: 14,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=27",
        title: "Nashville Skyline" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=28",
        title: "Great Smoky Mountains" as AlbumTitle,
        width: 800,
        height: 600
      }
    ]
  }
];

export const mockFolders = [
  {
    title: "Wedding Photography" as AlbumTitle,
    parent_title: "Events" as AlbumTitle,
    description: "Beautiful moments from wedding ceremonies",
    date: "2024",
    order: 1,
    photos: [
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=9",
        title: "Wedding Photo 1" as AlbumTitle,
        width: 800,
        height: 600
      },
      {
        size: 480000,
        url: "https://picsum.photos/800/600?random=10",
        title: "Wedding Photo 2" as AlbumTitle, 
        width: 800,
        height: 600
      }
    ]
  }
];