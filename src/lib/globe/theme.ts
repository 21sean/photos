/**
 * Colours of the landing-page globe.
 *
 * Deep forest-green land over a dark petrol sea, lit like a night-side
 * photograph. To restyle the globe, this file is the only one to touch.
 */
export const GLOBE_THEME = {
  /** Renderer clear colour. Must match `--bg` in globals.css. */
  background: '#050a0c',

  /** Sea, from the unlit depths up to the sheen. */
  ocean: {
    deep: '#021013',
    mid: '#0a3a43',
    sheen: '#1c8a8a',
    /** Chart graticule drawn on the water. */
    grid: '#6fd3d6',
    rim: '#8fe6ee'
  },

  /**
   * Land. `shade` to `lit` is the unlit side to the side facing the key
   * light; `lush`, `arid` and `ice` vary the green by latitude, the way
   * vegetation does: densest in the tropics, olive across the desert belts,
   * frosted at the poles.
   */
  land: {
    shade: '#03140b',
    lit: '#1f5236',
    lush: '#123f26',
    arid: '#4a5a34',
    ice: '#8eaa98',
    glint: '#5f9c76',
    rim: '#7fc79a'
  },
  /** Land sits slightly above the sea so the two never z-fight. */
  landAltitude: 0.004,
  coastline: 'rgba(150, 222, 178, 0.45)',

  /** Country boundaries, drawn faint and light over the dark land. */
  borders: '#8fd6aa',
  bordersOpacity: 0.22,
  bordersAltitude: 0.005,

  atmosphere: '#7fdfe9',
  atmosphereAltitude: 0.17,
  /** How bright the atmosphere's glow is, as a fraction of `atmosphere`. */
  atmosphereStrength: 0.8,

  /** The faint celestial grid behind the globe. */
  graticule: '#1f3a40',
  graticuleOpacity: 0.5,

  stars: '#d6f3f5',

  /** Destination markers: small points of light. */
  marker: {
    core: '#fffbe6',
    glow: '#ffd76a',
    altitude: 0.008
  },

  /** Routes between neighbouring destinations. */
  arc: ['rgba(255, 251, 230, 0.9)', 'rgba(127, 223, 233, 0.75)']
} as const;

/** Mean radius of the Earth, for the altitude readout. */
export const EARTH_RADIUS_KM = 6371;
