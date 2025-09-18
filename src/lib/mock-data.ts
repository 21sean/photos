// Mock data to replace Contentful
export const mockAlbums = [
  {
    title: "Mexico",
    color: "#FF6B6B",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=1",
        title: "Mexican Architecture",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=2", 
        title: "Ancient Ruins",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Lisbon",
    color: "#4ECDC4",
    type: "location", 
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
        url: "https://picsum.photos/800/600?random=3",
        title: "Tram 28",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=4",
        title: "Azulejo Tiles",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Porto",
    color: "#45B7D1",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=5",
        title: "Dom Luís I Bridge",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=6",
        title: "Port Wine Cellars",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Prague",
    color: "#96CEB4",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=7",
        title: "Charles Bridge",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=8",
        title: "Astronomical Clock",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Barcelona",
    color: "#FFEAA7",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=9",
        title: "Sagrada Familia",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=10",
        title: "Park Güell",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Venice",
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
    photos: [
      {
        url: "https://picsum.photos/800/600?random=11",
        title: "Grand Canal",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=12",
        title: "St. Mark's Basilica",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Switzerland",
    color: "#74B9FF",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=13",
        title: "Matterhorn",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=14",
        title: "Lake Geneva",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Milan",
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
    photos: [
      {
        url: "https://picsum.photos/800/600?random=15",
        title: "Milan Cathedral",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=16",
        title: "Galleria Vittorio Emanuele II",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Tuscany",
    color: "#FDCB6E",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=17",
        title: "Florence Skyline",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=18",
        title: "Tuscan Countryside",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Rome",
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
    photos: [
      {
        url: "https://picsum.photos/800/600?random=19",
        title: "Colosseum",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=20",
        title: "Roman Forum",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "London",
    color: "#A29BFE",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=21",
        title: "Big Ben",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=22",
        title: "Tower Bridge",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "San Diego",
    color: "#00CEC9",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=23",
        title: "La Jolla Cove",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=24",
        title: "Balboa Park",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Los Angeles",
    color: "#FD79A8",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=25",
        title: "Hollywood Sign",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=26",
        title: "Santa Monica Pier",
        width: 800,
        height: 600
      }
    ]
  },
  {
    title: "Tennessee",
    color: "#6C5CE7",
    type: "location",
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
        url: "https://picsum.photos/800/600?random=27",
        title: "Nashville Skyline",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=28",
        title: "Great Smoky Mountains",
        width: 800,
        height: 600
      }
    ]
  }
];

export const mockFolders = [
  {
    title: "Wedding Photography",
    parent_title: "Events",
    description: "Beautiful moments from wedding ceremonies",
    date: "2024",
    order: 1,
    photos: [
      {
        url: "https://picsum.photos/800/600?random=9",
        title: "Wedding Photo 1",
        width: 800,
        height: 600
      },
      {
        url: "https://picsum.photos/800/600?random=10",
        title: "Wedding Photo 2", 
        width: 800,
        height: 600
      }
    ]
  }
];