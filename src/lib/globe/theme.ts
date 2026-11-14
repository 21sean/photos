/**
 * Colours of the landing-page globe.
 *
 * The look borrows from Aerochrome, the infrared film that turns foliage
 * pink and water nearly black: land glows in magentas over a deep petrol
 * sea. To restyle the globe, this file is the only one to touch.
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
   * light; `lush`, `arid` and `ice` vary the pink by latitude, the way the
   * film's colour follows how much is growing.
   */
  land: {
    shade: '#6a0f38',
    lit: '#ff5c93',
    lush: '#e8185f',
    arid: '#f3a8a0',
    ice: '#ffe9ef',
    glint: '#ffc9dc',
    rim: '#ffd9e6'
  },
  /** Land sits slightly above the sea so the two never z-fight. */
  landAltitude: 0.004,
  coastline: 'rgba(255, 214, 228, 0.5)',

  /** Country boundaries, drawn dark over the bright land. */
  borders: '#4a0a26',
  bordersOpacity: 0.55,
  bordersAltitude: 0.005,

  atmosphere: '#7fdfe9',
  atmosphereAltitude: 0.17,

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
