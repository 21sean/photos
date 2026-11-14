import * as THREE from 'three';
import GeoJsonGeometry from 'three-geojson-geometry';
import { geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryObject, Topology } from 'topojson-specification';
import type { Feature, MultiLineString } from 'geojson';
import { GLOBE_THEME } from './theme';

type GeoJson = ConstructorParameters<typeof GeoJsonGeometry>[0];

/** Anything added to the scene by hand, with the means to remove it again. */
export type SceneObject = {
  object: THREE.Object3D;
  dispose: () => void;
};

const STAR_COUNT = 1400;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    // Slow, shallow twinkle: each star has its own phase
    vAlpha = 0.55 + 0.45 * sin(uTime * 0.6 + aPhase);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(uColor, disc * vAlpha);
    #include <colorspace_fragment>
  }
`;

/**
 * A distant starfield drawn as one point cloud (a single draw call), far
 * enough out that it drifts behind the globe as the camera orbits.
 */
export function createStars(
  globeRadius: number,
  pixelRatio: number
): SceneObject & { material: THREE.ShaderMaterial } {
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);

  const point = new THREE.Vector3();
  for (let i = 0; i < STAR_COUNT; i++) {
    point
      .randomDirection()
      .multiplyScalar(globeRadius * THREE.MathUtils.randFloat(9, 16));
    point.toArray(positions, i * 3);
    // Mostly faint specks, with the occasional brighter star
    sizes[i] = 0.9 + Math.pow(Math.random(), 4) * 2.4;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new THREE.Color(GLOBE_THEME.stars) }
    },
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false
  });

  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}

const MARKER_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vPulse;

  void main() {
    // A slow breath, out of step from one marker to the next
    vPulse = 0.84 + 0.16 * sin(uTime * 1.5 + aPhase);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MARKER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uGlow;
  varying float vPulse;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 at the centre, 1 at the rim
    float core = smoothstep(0.3, 0.16, d);
    float halo = pow(max(1.0 - d, 0.0), 2.4);
    gl_FragColor = vec4(uGlow * halo * 0.85 * vPulse + uCore * core, 1.0);
    #include <colorspace_fragment>
  }
`;

export type MarkerSpot = {
  position: { x: number; y: number; z: number };
  /** Diameter of the glow in CSS pixels. */
  size: number;
};

/**
 * Destination markers as points of light: a hot core in a soft halo, the
 * same size on screen at any zoom. One point cloud, so one draw call, and
 * additive, so they bloom over whatever they sit on.
 */
export function createMarkers(
  spots: MarkerSpot[],
  pixelRatio: number
): SceneObject & { material: THREE.ShaderMaterial } {
  const positions = new Float32Array(spots.length * 3);
  const sizes = new Float32Array(spots.length);
  const phases = new Float32Array(spots.length);
  spots.forEach((spot, i) => {
    positions.set([spot.position.x, spot.position.y, spot.position.z], i * 3);
    sizes[i] = spot.size;
    phases[i] = i * 2.399; // golden angle: evenly spread phases
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uCore: { value: new THREE.Color(GLOBE_THEME.marker.core) },
      uGlow: { value: new THREE.Color(GLOBE_THEME.marker.glow) }
    },
    vertexShader: MARKER_VERTEX_SHADER,
    fragmentShader: MARKER_FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createLines(
  geoJson: GeoJson,
  radius: number,
  color: string,
  opacity: number
): SceneObject {
  const geometry = new GeoJsonGeometry(geoJson, radius, 2);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity
  });
  return {
    object: new THREE.LineSegments(geometry, material),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}

/** The faint grid of a celestial sphere surrounding the globe. */
export function createGraticule(radius: number): SceneObject {
  return createLines(
    geoGraticule10() as GeoJson,
    radius,
    GLOBE_THEME.graticule,
    GLOBE_THEME.graticuleOpacity
  );
}

/**
 * Country boundaries as ONE merged line object. `mesh` dedupes the arcs
 * shared by two countries, so each border is drawn once and the whole layer
 * is a single draw call. Interior borders only: coastlines already come from
 * the land silhouettes.
 */
export function createCountryBorders(
  countries: Topology,
  globeRadius: number
): SceneObject {
  const borders: MultiLineString = mesh(
    countries,
    countries.objects.countries as GeometryObject,
    (a, b) => a !== b
  );
  return createLines(
    borders as GeoJson,
    globeRadius * (1 + GLOBE_THEME.bordersAltitude),
    GLOBE_THEME.borders,
    GLOBE_THEME.bordersOpacity
  );
}

/** Land masses as GeoJSON features for the globe's polygon layer. */
export function landFeatures(land: Topology): Feature[] {
  const collection = feature(land, land.objects.land);
  return 'features' in collection ? collection.features : [collection];
}

/**
 * A soft glowing dot that marks the destination currently in focus. It keeps
 * the same size on screen however far the camera is zoomed.
 */
export function createActiveMarker(): SceneObject & { sprite: THREE.Sprite } {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255, 255, 246, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 236, 160, 1)');
    gradient.addColorStop(0.42, 'rgba(255, 215, 106, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 215, 106, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.05);

  return {
    object: sprite,
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    }
  };
}
