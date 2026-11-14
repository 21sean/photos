import * as THREE from 'three';
import { GLOBE_THEME } from './theme';

// Shader colours arrive as THREE.Color uniforms, so they are already in the
// renderer's linear working space, and every shader ends with three's
// <colorspace_fragment>. That keeps them correct both when drawn straight to
// the screen and when drawn into the post-processing buffer.

// Both surfaces are lit by the same imaginary key light, fixed relative to
// the camera, so the globe keeps a consistent lit side while it turns.
const LIGHTING = /* glsl */ `
  const vec3 KEY_LIGHT = vec3(-0.46, 0.56, 0.69);

  float keyLight(vec3 n) {
    return clamp(dot(n, KEY_LIGHT), 0.0, 1.0);
  }

  float fresnel(vec3 n, vec3 viewDir, float power) {
    return pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), power);
  }
`;

// The surface normal of a sphere is just its normalized position, which is
// more reliable than trusting every layer's geometry to carry normals.
const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vUnit;

  void main() {
    vUnit = normalize(position);
    vNormal = normalize(normalMatrix * vUnit);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const OCEAN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uSheen;
  uniform vec3 uGrid;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vUnit;

  ${LIGHTING}

  // Layered sines stand in for noise: cheap enough for mobile GPUs and
  // seam-free because every longitude multiplier is an integer.
  float flowPattern(vec2 p, float t) {
    float w = 0.0;
    w += sin(p.x * 3.0 + t * 0.30 + sin(p.y * 4.0 - t * 0.20) * 1.2);
    w += 0.6 * sin(p.y * 7.0 - t * 0.24 + sin(p.x * 5.0 + t * 0.17));
    w += 0.4 * sin(p.x * 6.0 + p.y * 9.0 + t * 0.40);
    return w * 0.5;
  }

  // Anti-aliased line every "spacing" units of "coord"
  float gridLine(float coord, float spacing) {
    float c = coord / spacing;
    float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-5);
    return 1.0 - clamp(d, 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    float lat = asin(clamp(vUnit.y, -1.0, 1.0));
    float lng = atan(vUnit.z, vUnit.x);
    float flow = flowPattern(vec2(lng, lat), uTime);

    // Slow currents: the mid tone wanders, the sheen surfaces in streaks
    float g = smoothstep(-1.2, 1.2, 0.35 * vUnit.y + 0.75 * flow);
    vec3 col = mix(uDeep, uMid, g);
    col = mix(col, uSheen, 0.28 * smoothstep(0.35, 1.0, flow));

    // Chart graticule every 15 degrees. Meridians fade out towards the
    // poles, where they would otherwise bunch into a solid cap.
    float latDeg = degrees(lat);
    float parallels = gridLine(latDeg, 15.0);
    float meridians = gridLine(degrees(lng), 15.0) *
      (1.0 - smoothstep(72.0, 84.0, abs(latDeg)));
    col = mix(col, uGrid, max(parallels, meridians) * 0.2);

    // Key light gives the sphere volume; the rim lifts its silhouette
    col *= 0.5 + 0.8 * keyLight(n);
    col += fresnel(n, viewDir, 3.0) * uRim * 0.5;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const LAND_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uShade;
  uniform vec3 uLit;
  uniform vec3 uGlint;
  uniform vec3 uRim;
  uniform vec3 uLush;
  uniform vec3 uArid;
  uniform vec3 uIce;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vUnit;

  ${LIGHTING}

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Infrared film records how much is growing, so the pink is not flat:
    // deepest in the tropics, dusty across the desert belts, pale at the
    // poles. Bands by latitude, broken up by a slow wobble so they never
    // read as stripes. A stylisation, not data.
    float lat = degrees(asin(clamp(vUnit.y, -1.0, 1.0)));
    float lng = atan(vUnit.z, vUnit.x);
    float wobble = 7.0 * sin(lng * 3.0 + vUnit.y * 5.0) + 4.0 * sin(lng * 7.0 - vUnit.y * 9.0);
    float band = abs(lat + wobble);
    float lush = 1.0 - smoothstep(4.0, 17.0, band);
    float arid = smoothstep(13.0, 21.0, band) * (1.0 - smoothstep(28.0, 37.0, band));
    float ice = smoothstep(60.0, 72.0, abs(lat) + wobble * 0.4);

    vec3 base = mix(uLit, uLush, lush * 0.75);
    base = mix(base, uArid, arid * 0.7);
    base = mix(base, uIce, ice);

    float lit = keyLight(n);
    vec3 col = mix(uShade, base, smoothstep(-0.05, 0.8, lit));
    col = mix(col, uGlint, pow(lit, 6.0) * 0.35);
    col += fresnel(n, viewDir, 3.0) * uRim * 0.35;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const color = (hex: string) => ({ value: new THREE.Color(hex) });

/** Animated sea. Advance `uniforms.uTime` to make it flow. */
export function createOceanMaterial(): THREE.ShaderMaterial {
  const { ocean } = GLOBE_THEME;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 8.0 },
      uDeep: color(ocean.deep),
      uMid: color(ocean.mid),
      uSheen: color(ocean.sheen),
      uGrid: color(ocean.grid),
      uRim: color(ocean.rim)
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: OCEAN_FRAGMENT_SHADER
  });
}

/** Infrared-pink land that brightens towards the key light. */
export function createLandMaterial(): THREE.ShaderMaterial {
  const { land } = GLOBE_THEME;
  return new THREE.ShaderMaterial({
    uniforms: {
      uShade: color(land.shade),
      uLit: color(land.lit),
      uGlint: color(land.glint),
      uRim: color(land.rim),
      uLush: color(land.lush),
      uArid: color(land.arid),
      uIce: color(land.ice)
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: LAND_FRAGMENT_SHADER
  });
}
