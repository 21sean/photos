'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import GlobeGL from 'react-globe.gl';
import type { GlobeProps, GlobeMethods } from 'react-globe.gl';
import { GeoJsonGeometry } from 'three-geojson-geometry';
import { geoGraticule10 } from 'd3-geo';
import * as topojson from 'topojson-client';
import { useWindowSize } from '@/hooks/use-window-size';
import { Album, AlbumTitle, types } from '@/types/albums';
import { titleToSlug } from '@/lib/slug';
import { AlbumCard } from './album-card';
import useHDRSetup from '@/hooks/use-hdr-setup';
import AlbumList from '@/lib/globes/album-list';

// ============================================
// GLOBE THEME CONFIGURATION
// ============================================
const DARK_MODE = true; // Toggle between dark and light mode

// Set USE_COUNTRY_POLYGONS = true and add the geojson file to use country borders

const USE_COUNTRY_POLYGONS = false; // Set to true to use individual country polygons with borders

// Theme colors (adjust these to customize appearance)
const THEME = {
  light: {
    // Background
    backgroundColor: 'rgba(255, 255, 255, 0)', // Transparent (uses CSS background)
    
    // Globe surface
    showGlobe: false,
    globeColor: 0xffffff,
    
    // Atmosphere
    showAtmosphere: false,
    atmosphereColor: 'lightskyblue',
    atmosphereAltitude: 0.15,
    
    // Polygons (land/countries)
    polygonCapColor: 0xffffff,
    polygonCapOpacity: 0.77,
    polygonSideColor: 'rgba(255, 255, 255, 0)',
    polygonStrokeColor: 'black',
    polygonStrokeColorAlt: 'darkslategray', // For non-Mac platforms
    polygonAltitude: 0,
    
    // Graticules (lat/lng grid)
    graticulesColor: 'lightgrey',
    graticulesOpacity: 0.47,
    
    // Inner sphere
    innerSphereColor: 0xffffff,
    innerSphereOpacity: 0.47,
    
    // Stars (custom layer)
    starsColor: '#777777',
    starsOpacity: 0.6,
    
    // Points (location markers)
    pointColor: 'rgba(10, 31, 68, 0.8)', // Navy blue
    pointColorActive: 'rgba(0, 200, 0, 0.9)', // Green for selected
    
    // Arcs
    arcColors: ['red', 'purple'],
  },
  dark: {
    // Background
    backgroundColor: '#1a1a1fff', // Match the page background so the canvas blends seamlessly

    // Globe surface (animated gradient ocean shader, see useOceanMaterial)
    showGlobe: true,
    globeColor: 0x1a1a2e,

    // Atmosphere
    showAtmosphere: true,
    atmosphereColor: '#9db8ff', // Cool blue halo to match the ocean
    atmosphereAltitude: 0.2,

    // Polygons (land/countries)
    polygonCapColor: 0x15161d, // Near-black silhouette over the ocean gradient
    polygonCapOpacity: 0.97,
    polygonSideColor: 'rgba(21, 21, 21, 0.95)',
    polygonStrokeColor: '#f0000000', // Gray-600
    polygonStrokeColorAlt: '#ffffffff', // Gray-700
    polygonAltitude: 0.004, // Land floats just above the ocean sphere surface
    
    // Graticules (lat/lng grid)
    graticulesColor: '#2d3748',
    graticulesOpacity: 0.4,
    
    // Inner sphere
    innerSphereColor: 0x000000,
    innerSphereOpacity: 0.9,
    
    // Stars (custom layer)
    starsColor: '#8888aa',
    starsOpacity: 0.7,
    
    // Points (location markers)
    pointColor: 'rgba(255, 255, 255, 1)', // Light blue
    pointColorActive: 'rgba(0, 200, 0, 0.95)', // Bright green
    
    // Arcs
    arcColors: ['#ff6b6b', '#a855f7'], // Coral red to purple
  }
};

const theme = DARK_MODE ? THEME.dark : THEME.light;
// ============================================

// Flying lines (arc dash) speed: 1 = current speed, smaller = slower, larger = faster
const FLYING_LINES_SPEED = 0.3;

// Idle altitude for location dots; must clear the raised land caps
// (theme.polygonAltitude) so dots stay visible above the ocean sphere.
const BASE_POINT_ALTITUDE = 0.006;

// ============================================
// ANIMATED OCEAN (globe surface shader)
// ============================================
const OCEAN_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vUnit;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vUnit = normalize(position);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const OCEAN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vUnit;

  // Layered sines stand in for noise: cheap enough for mobile GPUs and
  // seam-free because every longitude multiplier is an integer.
  float flowPattern(vec2 p, float t) {
    float w = 0.0;
    w += sin(p.x * 3.0 + t * 0.30 + sin(p.y * 4.0 - t * 0.20) * 1.2);
    w += 0.6 * sin(p.y * 7.0 - t * 0.24 + sin(p.x * 5.0 + t * 0.17));
    w += 0.4 * sin(p.x * 6.0 + p.y * 9.0 + t * 0.40);
    return w * 0.5;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    float lat = asin(clamp(vUnit.y, -1.0, 1.0));
    float lng = atan(vUnit.z, vUnit.x);
    float flow = flowPattern(vec2(lng, lat), uTime);

    vec3 deep   = vec3(0.016, 0.043, 0.106); // abyssal navy
    vec3 indigo = vec3(0.075, 0.153, 0.373); // mid-ocean indigo
    vec3 teal   = vec3(0.031, 0.302, 0.365); // tropical teal accent

    // North-south gradient, slowly warped by the flow field
    float g = smoothstep(-1.35, 1.35, vUnit.y + 0.45 * flow);
    vec3 col = mix(deep, indigo, g);
    col = mix(col, teal, 0.4 * smoothstep(0.25, 1.0, flow));

    // Slow sheen band drifting across the longitudes
    float band = 0.5 + 0.5 * sin(lng * 2.0 - uTime * 0.12 + sin(lat * 3.0) * 0.8);
    col += vec3(0.018, 0.045, 0.085) * band;

    // Fresnel rim lifts the silhouette against the dark backdrop
    float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 2.6);
    col += fresnel * vec3(0.16, 0.27, 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function useOceanMaterial() {
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 8.0 } },
        vertexShader: OCEAN_VERTEX_SHADER,
        fragmentShader: OCEAN_FRAGMENT_SHADER
      }),
    []
  );

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (prefersReducedMotion) return; // keep the static gradient frame

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      material.uniforms.uTime.value = 8.0 + (now - start) / 1000;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [material]);

  useEffect(() => () => material.dispose(), [material]);

  return material;
}

// Zoom tuning: allow 30% more zoom-in and 50% less zoom-out
const ZOOM_IN_EXTRA = 0.6;
const ZOOM_OUT_REDUCTION = 0.6;

// Intro flight: how long the camera takes to glide in from deep space on load
const INTRO_FLIGHT_MS = 2400;

type Ref = CustomGlobeMethods | undefined; // Reference to globe instance
type GlobeEl = React.MutableRefObject<Ref>; // React `ref` passed to globe element

interface CustomGlobeMethods extends GlobeMethods {
  controls(): ReturnType<GlobeMethods['controls']> & {
    autoRotateForced: boolean;
    autoRotateUserPaused: boolean;
  };
}

type Arc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: Array<string>;
};

type LatLng = { lat: number; lng: number };

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
    window.innerWidth <= 768
  );
}

function coordKey(lat: number, lng: number, precision = 4): string {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function useLandPolygons() {
  const [landPolygons, setLandPolygons] = useState([]);
  useEffect(() => {
    async function fetchLandPolygons() {
      if (USE_COUNTRY_POLYGONS) {
        // Load GeoJSON with individual country polygons and borders
        const response = await fetch('/data/ne_110m_admin_0_countries.geojson');
        const countriesGeoJson = await response.json();
        setLandPolygons(countriesGeoJson.features);
      } else {
        // Load TopoJSON with just land masses (no borders)
        const landTopo = await import('../../data/land-110m.json');
        const landPolygons = topojson.feature(
          landTopo,
          landTopo.objects.land
        ).features;
        setLandPolygons(landPolygons);
      }
    }
    fetchLandPolygons();
  }, []);
  const polygonMaterial = React.useMemo(() => new THREE.MeshBasicMaterial({
    color: theme.polygonCapColor,
    opacity: theme.polygonCapOpacity,
    transparent: true
  }), []);

  return { landPolygons, polygonMaterial };
}

function usePoints(albums: Array<Album>) {
  const [altitude, setAltitude] = useState(BASE_POINT_ALTITUDE);
  const points = React.useMemo(() => {
    const pts: Array<any> = [];

    const seen = new Set<string>();

    const pushUnique = (point: any) => {
      const k = coordKey(point.lat, point.lng);
      if (seen.has(k)) return;
      seen.add(k);
      pts.push(point);
    };

    const locations = albums.filter(album => album.type === types.LOCATION);
    for (const album of locations) {
      // Prefer the bigger "album" dot when there is overlap.
      pushUnique({ ...album, radius: 0.19, label: album.title });
      for (const location of album.locations) {
        pushUnique({
          ...album,
          lat: location.lat,
          lng: location.lng,
          radius: 0.135,
          label: location.description || album.title
        });
      }
    }
    return pts;
  }, [albums]);
  return {
    pointAltitude: altitude,
    setPointAltitude: setAltitude,
    points
  };
}

type ActiveMarker = { lat: number; lng: number; label: string };

function useAlbumInteraction(
  globeEl: GlobeEl,
  setPointAltitude: React.Dispatch<React.SetStateAction<number>>,
  isPinnedRef?: React.MutableRefObject<boolean>
) {
  const [activeAlbumTitle, setActiveAlbumTitle] = useState<AlbumTitle>();
  const [activeMarker, setActiveMarker] = useState<ActiveMarker | null>(null);

  const [enterTimeoutId, setEnterTimeoutId] = useState<NodeJS.Timeout>();
  function handleMouseEnter({ lat, lng, title, type, label }: Album & { label?: string }) {
    setActiveAlbumTitle(title);
    if (type === types.LOCATION) {
      // Anchor for the pop-up city tooltip: the exact point that was picked
      setActiveMarker({ lat, lng, label: label ?? title });
    }

    clearTimeout(enterTimeoutId);

    // Stop auto-rotation when hovering over any location
    if (globeEl.current && globeEl.current.controls) {
      const controls = globeEl.current.controls();
      controls.autoRotateForced = true; // Set forced flag first
      controls.autoRotate = false; // Then disable rotation
    }

    const id = setTimeout(() => {
      if (type === types.LOCATION) {
        // Slightly more zoomed out on mobile devices, 30% more zoom when selected.
        // On mobile, the zoom-in is disabled: keep the default mobile altitude so the
        // camera still pans to the location without zooming in.
        const altitudeOnFocus = isMobileDevice() ? /* zoom-in disabled: 0.84 */ 2.8 : 0.7;
        globeEl.current?.pointOfView(
          {
            lat,
            lng,
            altitude: altitudeOnFocus
          },
          1000
        );
      } else if (type === types.CUSTOM) {
        setPointAltitude(2);
      }
    }, 0);
    setEnterTimeoutId(id);
  }
  function handleMouseLeave(force = false) {
    if (!force && isPinnedRef?.current) {
      return;
    }
    setPointAltitude(BASE_POINT_ALTITUDE);
    setActiveAlbumTitle(undefined);
    setActiveMarker(null);

    const defaultAltitude = isMobileDevice() ? 2.8 : 2;
    globeEl.current?.pointOfView(
      {
        lat: 30,
        altitude: defaultAltitude
      },
      1000
    );

    // Restore auto-rotation after the view transition
    setTimeout(() => {
      if (globeEl.current?.controls) {
        const controls = globeEl.current.controls();
        controls.autoRotateForced = false; // Allow auto-rotation to resume first
        if (!controls.autoRotateUserPaused) {
          controls.autoRotate = true; // Then enable rotation
          controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED; // Reset to default speed
        }
      }
    }, 1100); // Wait for the view transition to complete
  }

  return {
    activeAlbumTitle,
    activeMarker,
    handleMouseEnter,
    handleMouseLeave
  };
}

function generateArcs(albums: Array<Album>) {
  // Note: previously we connected *every* pair of albums which can create a very dense
  // "spokes" effect where some visually-identical city dots spawn lots of overlapping lines.
  // Here we:
  //   1) Build a unique list of points (album + its sub-locations)
  //   2) Build undirected arcs between points
  //   3) Cap number of outgoing arcs per origin point

  // Tuning: keep the globe readable when many points share an origin.
  const MAX_OUTGOING_PER_ORIGIN = 6;

  // Dedupe precision (degrees). 4 decimals is ~11m lat, good enough to merge identical dots.
  const key = (p: LatLng) => coordKey(p.lat, p.lng);

  const points: LatLng[] = [];
  const seen = new Set<string>();

  for (const album of albums) {
    const candidates: LatLng[] = [
      { lat: album.lat, lng: album.lng },
      ...album.locations.map(l => ({ lat: l.lat, lng: l.lng }))
    ];

    for (const p of candidates) {
      const k = key(p);
      if (seen.has(k)) continue;
      seen.add(k);
      points.push(p);
    }
  }

  // Build arcs in a stable order so the capped set doesn't change between renders.
  const baseArcs: Arc[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      baseArcs.push({
        startLat: points[i].lat,
        startLng: points[i].lng,
        endLat: points[j].lat,
        endLng: points[j].lng,
        color: ['red', 'purple']
      });
    }
  }

  if (!baseArcs.length) return baseArcs;

  // Bucket by origin and cap outgoing arcs. Also dedupe destinations per origin.
  const outgoing = new Map<string, Arc[]>();
  const outgoingDestSeen = new Map<string, Set<string>>();

  const addOutgoing = (arc: Arc) => {
    const origin: LatLng = { lat: arc.startLat, lng: arc.startLng };
    const dest: LatLng = { lat: arc.endLat, lng: arc.endLng };
    const originKey = key(origin);
    const destKey = key(dest);

    const list = outgoing.get(originKey) ?? [];
    const destSet = outgoingDestSeen.get(originKey) ?? new Set<string>();

    // Avoid multiple arcs from same origin to same destination (common with duplicate dots).
    if (destSet.has(destKey)) return;
    destSet.add(destKey);

    // Cap outgoing count.
    if (list.length >= MAX_OUTGOING_PER_ORIGIN) return;

    list.push(arc);
    outgoing.set(originKey, list);
    outgoingDestSeen.set(originKey, destSet);
  };

  // Stable deterministic selection: sort by straight-line distance in degree space.
  // Prefer nearer destinations to avoid huge starbursts.
  const distance2 = (a: Arc) => {
    const dLat = a.startLat - a.endLat;
    const dLng = a.startLng - a.endLng;
    return dLat * dLat + dLng * dLng;
  };

  const arcsSorted = [...baseArcs].sort((a, b) => distance2(a) - distance2(b));
  for (const arc of arcsSorted) {
    // Add both directions so caps apply symmetrically per point.
    addOutgoing(arc);
    addOutgoing({
      startLat: arc.endLat,
      startLng: arc.endLng,
      endLat: arc.startLat,
      endLng: arc.startLng,
      color: arc.color
    });
  }

  // Flatten; arcs are directed now (fine for react-globe.gl).
  return Array.from(outgoing.values()).flat();
}

function useArcs(albums: Array<Album>) {
  const [arcs, setArcs] = useState<Array<Arc>>([]);
  useEffect(() => {
    setArcs(generateArcs(albums));
  }, [albums]);

  return { arcs };
}

function useCustomLayer(globeEl: GlobeEl) {
  const customLayerData = React.useMemo(() => {
    const numbers = Array.from(Array(200), (_, index) => index); // Reduced from 500 to 200 for better performance
    return numbers.map(() => ({
      lat: (Math.random() - 0.5) * 180,
      lng: (Math.random() - 0.5) * 360,
      alt: Math.random() * 1.4 + 0.1
    }));
  }, []);
  const customThreeObject = React.useCallback(() =>
    new THREE.Mesh(
      new THREE.SphereGeometry(0.18), // Slightly smaller spheres
      new THREE.MeshBasicMaterial({
        color: '#777777',
        opacity: 0.6, // Slightly more transparent
        transparent: false
      })
    ), []);
  const customThreeObjectUpdate: GlobeProps['customThreeObjectUpdate'] = React.useCallback((
    object: any,
    objectData: any
  ) => {
    const typedObjectData = objectData as {
      lat: number;
      lng: number;
      alt: number;
    };
    Object.assign(
      object.position,
      globeEl.current?.getCoords(
        typedObjectData.lat,
        typedObjectData.lng,
        typedObjectData.alt
      )
    );
  }, [globeEl]);

  return {
    customLayerData,
    customThreeObject,
    customThreeObjectUpdate
  };
}

function useGlobeReady(globeEl: GlobeEl) {
  const [globeReady, setGlobeReady] = useState(false);

  // faster autoRotate speed over the ocean
  const autoRotateSpeed = () => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      
      // Don't modify anything if rotation is forced to stop
      if (controls.autoRotateForced || controls.autoRotateUserPaused) {
        requestAnimationFrame(autoRotateSpeed);
        return;
      }

      const { lng } = globeEl.current.pointOfView();
      let newSpeed = DEFAULT_AUTOROTATE_SPEED;

      // [ [ longitude, speed multiplier ], ... ]
      const gradientSteps = [
        // sppeed down
        [175, 2],
        [165, 1.88],
        [160, 1.77],
        [155, 1.65],
        [150, 1.5],
        [145, 1.25],

        // speed up
        [-160, 2.25],
        [-140, 2.0],
        [-120, 1.75],
        [-110, 1.65],
        [-115, 1.45],
        [-100, 1.35],
        [-95, 1.25],
        [-90, 1.15]
      ];
      for (const [longitude, multiplier] of gradientSteps) {
        if (longitude < 0 && lng < longitude) {
          // west of california
          newSpeed = multiplier * DEFAULT_AUTOROTATE_SPEED;
          break;
        }
        if (longitude > 0 && lng > longitude) {
          // east of japan
          newSpeed = multiplier * DEFAULT_AUTOROTATE_SPEED;
          break;
        }
      }
      
      if (
        newSpeed !== DEFAULT_AUTOROTATE_SPEED &&
        controls.autoRotate
      ) {
        controls.autoRotateSpeed = newSpeed;
      }
    }
    requestAnimationFrame(autoRotateSpeed);
  };

  // One-time controls setup + drag listeners
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;

    const controls = globeEl.current.controls();

    // Only disable user interaction, but keep controls enabled for auto-rotation
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableRotate = false;

    // Force enable auto-rotation
    controls.autoRotate = true;
    controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED;
    controls.autoRotateForced = false; // Initialize the forced flag
    controls.autoRotateUserPaused = false; // Initialize the user pause flag

    const initialAltitude = isMobileDevice() ? 2.8 : 2;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (prefersReducedMotion) {
      globeEl.current.pointOfView({ lat: 30, lng: -30, altitude: initialAltitude });
    } else {
      // Cinematic arrival: start far out over the Pacific, then glide east and
      // settle while the canvas sharpens (globeEnter animation in globals.css)
      globeEl.current.pointOfView({ lat: 2, lng: -110, altitude: initialAltitude * 2.75 });
      globeEl.current.pointOfView(
        { lat: 30, lng: -30, altitude: initialAltitude },
        INTRO_FLIGHT_MS
      );
    }

    // Start the dynamic rotation speed
    autoRotateSpeed();

    // Enable mouse drag to rotate (capture-phase so OrbitControls sees enableRotate=true)
    const domEl = (controls as any).domElement as HTMLElement | undefined;
    if (!domEl) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      // Mouse-only drag rotation
      if (e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;

      controls.autoRotateUserPaused = true;
      controls.autoRotate = false;
      controls.enableRotate = true;
    };

    const endDrag = () => {
      controls.autoRotateUserPaused = false;
      controls.enableRotate = false;

      if (!controls.autoRotateForced) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED;
      }
    };

    domEl.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });
    window.addEventListener('blur', endDrag, { passive: true } as AddEventListenerOptions);

    // Multiple attempts to ensure auto-rotation starts
    const forceRotation = () => {
      if (globeEl.current) {
        const controls = globeEl.current.controls();
        if (controls.autoRotateForced || controls.autoRotateUserPaused) return;
        controls.autoRotate = true;
        controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED;
        controls.autoRotateForced = false;
      }
    };
    setTimeout(forceRotation, 100);
    setTimeout(forceRotation, 500);
    setTimeout(forceRotation, 1000);
    setTimeout(forceRotation, 2000);

    return () => {
      domEl.removeEventListener('pointerdown', onPointerDownCapture, { capture: true } as any);
      window.removeEventListener('pointerup', endDrag as any);
      window.removeEventListener('pointercancel', endDrag as any);
      window.removeEventListener('blur', endDrag as any);
    };
  }, [globeEl, globeReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom constraints update (deferred until the intro flight lands so the
  // far-out starting camera isn't clamped by maxDistance mid-animation)
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;

    const applyZoomConstraints = () => {
      if (!globeEl.current) return;

      const controls = globeEl.current.controls();
      const isMobile = isMobileDevice();

      // Clamp zoom range (OrbitControls distances are in world units)
      const globeRadius = globeEl.current.getGlobeRadius?.() ?? 100;
      const distanceForAltitude = (altitude: number) => globeRadius * (1 + altitude);

      const baselineMinAltitude = isMobile ? 1.2 : 1;
      const baselineMaxAltitude = isMobile ? 6 : 4;

      const minAltitude = baselineMinAltitude * (1 - ZOOM_IN_EXTRA);
      const maxAltitude = baselineMaxAltitude * (1 - ZOOM_OUT_REDUCTION);

      controls.minDistance = distanceForAltitude(minAltitude);
      controls.maxDistance = distanceForAltitude(Math.max(maxAltitude, (isMobile ? 2.8 : 2)));
      controls.update?.();
    };

    const id = setTimeout(applyZoomConstraints, INTRO_FLIGHT_MS + 200);
    return () => clearTimeout(id);
  }, [globeEl, globeReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supersampling for better antialiasing - biggest visual improvement for polygon edges
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;

    const renderer = globeEl.current.renderer();
    if (!renderer) return;

    // Set pixel ratio (capped at 2 for performance)
    // This renders at higher resolution and downsamples, cleaning up polygon borders
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }, [globeEl, globeReady]);

  return {
    handleGlobeReady: () => setGlobeReady(true)
  };
}

function useScene(globeElRef: Ref, enabled: boolean) {
  useEffect(() => {
    if (!globeElRef) return;
    if (!enabled) return;

    const scene = globeElRef.scene();

    const radius = 300;
    const graticulesMaterial = new THREE.LineBasicMaterial({
      color: theme.graticulesColor,
      transparent: true,
      opacity: theme.graticulesOpacity
    });
    const graticulesGeometry = new GeoJsonGeometry(geoGraticule10(), radius, 2);
    const graticules = new THREE.LineSegments(graticulesGeometry, graticulesMaterial);
    scene.add(graticules);

    const innerSphereGeometry = new THREE.SphereGeometry(
      globeElRef.getGlobeRadius() - 6,
      64,
      32
    );
    const innerSphereMaterial = new THREE.MeshBasicMaterial({
      color: theme.innerSphereColor,
      opacity: theme.innerSphereOpacity,
      transparent: true
    });
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerSphereMaterial);
    innerSphere.renderOrder = Number.MAX_SAFE_INTEGER;
    scene.add(innerSphere);

    return () => {
      scene.remove(graticules);
      scene.remove(innerSphere);
      graticulesGeometry.dispose?.();
      graticulesMaterial.dispose?.();
      innerSphereGeometry.dispose?.();
      innerSphereMaterial.dispose?.();
    };
  }, [globeElRef, enabled]);
}

const DEFAULT_AUTOROTATE_SPEED = .32; // Reduced by 30% from 1.75

function Globe({ albums }: { albums: Array<Album> }) {
  // Initialize HDR capabilities
  useHDRSetup();
  
  
  // object config
  const globeEl = useRef<Ref>();
  const globeElRef: Ref = globeEl.current;

  const { handleGlobeReady } = useGlobeReady(globeEl);

  // Detect desktop Chrome after mount to avoid hydration mismatch
  const [isDesktopChrome, setIsDesktopChrome] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const isDesktop = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setIsDesktopChrome(isChrome && isDesktop);
  }, []);

  const isPinnedRef = useRef(false);

  // scene config (the current look relies on scene decorations)
  useScene(globeElRef, true);

  // land shapes
  const { landPolygons, polygonMaterial } = useLandPolygons();

  // animated gradient ocean surface
  const oceanMaterial = useOceanMaterial();

  // `albums` map points
  const { points, pointAltitude, setPointAltitude } = usePoints(albums);

  // album interaction (hover, click, view transitions)
  const {
    handleMouseEnter,
    handleMouseLeave,
    activeAlbumTitle,
    activeMarker
  } = useAlbumInteraction(globeEl, setPointAltitude, isPinnedRef);
  const activeAlbum = albums.find(album => album.title === activeAlbumTitle);

  // Pop-up city tooltip pinned to the selected point (CSS2D layer).
  // A fresh data object per selection recreates the element, replaying the
  // pop animation each time a new city is picked.
  const tooltipData = React.useMemo(
    () => (activeMarker ? [activeMarker] : []),
    [activeMarker]
  );
  const tooltipElementCb = React.useCallback((d: object) => {
    const root = document.createElement('div');
    root.className = 'globe-tooltip';
    root.style.pointerEvents = 'none';
    const bubble = document.createElement('div');
    bubble.className = 'globe-tooltip-bubble';
    bubble.textContent = (d as ActiveMarker).label;
    root.appendChild(bubble);
    return root;
  }, []);
  const tooltipVisibilityCb = React.useCallback((el: HTMLElement, isVisible: boolean) => {
    // Hide the tooltip while its anchor is on the far side of the globe
    el.style.visibility = isVisible ? 'visible' : 'hidden';
  }, []);

  // arcs animation
  const { arcs } = useArcs(albums);

  // resize canvas on resize viewport
  const { width, height } = useWindowSize();

  // stars in the background
  const { customLayerData, customThreeObject, customThreeObjectUpdate } =
    useCustomLayer(globeEl);

  // Detect Mac after mount to avoid hydration mismatch
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(
      navigator.platform.toLowerCase().includes('mac') ||
      navigator.userAgent.toLowerCase().includes('mac')
    );
  }, []);

  const polygonAltitudeCb = React.useCallback(() => theme.polygonAltitude, []);
  const polygonSideColorCb = React.useCallback(() => theme.polygonSideColor, []);
  const polygonStrokeColorCb = React.useCallback(() => (isMac ? theme.polygonStrokeColor : theme.polygonStrokeColorAlt), [isMac]);
  const pointColorCb = React.useCallback((point: any) => {
    const p = point as Partial<Album> & { radius?: number };
    if (activeAlbumTitle && p.title === activeAlbumTitle) {
      return theme.pointColorActive;
    }
    return theme.pointColor;
  }, [activeAlbumTitle]);
  const pointRadiusCb = React.useCallback((point: any) => (point as { radius: number }).radius, []);
  const onPointHoverCb = React.useCallback((point: any) => {
    if (point) {
      handleMouseEnter(point as Album);
    } else {
      if (!isPinnedRef.current) {
        handleMouseLeave();
      }
    }
  }, [handleMouseEnter, handleMouseLeave]);
  const onPointClickCb = React.useCallback((point: any) => {
    if (point) {
      const album = point as Album;
      if (isDesktopChrome) {
        isPinnedRef.current = true;
      }
      // Show album card instead of navigating directly (both mobile and desktop)
      // Delegate to album list interaction
      handleMouseEnter(album);
    }
  }, [handleMouseEnter, isDesktopChrome]);
  const arcDashLengthCb = React.useCallback(() => randomInRange(0.06, 0.7) / 1, []);
  const arcDashGapCb = React.useCallback(() => randomInRange(0.025, 0.4) * 10, []);
  const arcDashAnimateTimeCb = React.useCallback(() => {
    const speed = Math.max(0.05, FLYING_LINES_SPEED);
    const baseDurationMs = randomInRange(0.08, 0.8) * 20000 + 500;
    return baseDurationMs / speed;
  }, []);

  // Handle navigation when clicking "Click to enter" on album card
  const handleAlbumCardClick = (albumTitle: string) => {
    // Navigate to the album
    window.location.href = `/${titleToSlug(albumTitle)}`;
  };

  // Hide album card when double-clicking sean.photo text or globe background
  const hideAlbumCard = () => {
    isPinnedRef.current = false;
    handleMouseLeave(true); // force clear and hide
  };

  const handleAlbumSelect = React.useCallback((album: Album) => {
    if (isDesktopChrome) {
      isPinnedRef.current = true;
    }
    handleMouseEnter(album);
  }, [handleMouseEnter, isDesktopChrome]);


  // Measure container size to ensure correct canvas fit on iOS Safari
  const containerRef = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      // Use getBoundingClientRect for more accurate dimensions
      const rect = el.getBoundingClientRect();
      setContainerWidth(rect.width);
      setContainerHeight(rect.height);
    };
    update();
    const RO = (window as any).ResizeObserver;
    const ro = RO ? new RO(update) : undefined;
    if (ro) {
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, []);

  // Prefer stable height on iOS using --outer-h when available
  // Computed after mount to avoid hydration mismatch
  const [stableOuterHeight, setStableOuterHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const screenH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--screen-h'));
    const outerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--outer-h'));
    setStableOuterHeight(screenH || outerH || undefined);
  }, []);

  return (
    <section
      ref={containerRef as any}
      className={`globe-container relative ${isDesktopChrome ? 'chrome-desktop' : ''} ${DARK_MODE ? 'dark-mode' : ''}
        md:px-24
        lg:px-36
        xl:px-48
        2xl:px-64`}
      onDoubleClick={(e) => {
        // Only hide if clicking on the background, not on interactive elements
        if (e.target === e.currentTarget) {
          hideAlbumCard();
        }
      }}
    >
      <GlobeGL
        ref={globeEl}
        width={containerWidth ?? width}
        height={(stableOuterHeight && stableOuterHeight > 0)
          ? stableOuterHeight // exact stable height to avoid overshoot
          : ((containerHeight && containerHeight > 0) ? containerHeight : (height && height > 0 ? height : undefined))}
        rendererConfig={{ 
          antialias: true,
          powerPreference: "high-performance"
        }}
        onGlobeReady={handleGlobeReady}
        animateIn={false}
        backgroundColor={theme.backgroundColor}
        backgroundImageUrl={null}
        globeMaterial={oceanMaterial}
        atmosphereColor={theme.atmosphereColor}
        atmosphereAltitude={theme.atmosphereAltitude}
        showGlobe={theme.showGlobe}
        showAtmosphere={theme.showAtmosphere}
        showGraticules={false}
        polygonsData={landPolygons}
        polygonCapMaterial={polygonMaterial}
        polygonsTransitionDuration={0}
        polygonAltitude={polygonAltitudeCb}
        polygonSideColor={polygonSideColorCb}
        polygonStrokeColor={polygonStrokeColorCb}
        pointsData={points}
        pointColor={pointColorCb}
        pointAltitude={pointAltitude}
        pointRadius={pointRadiusCb}
        pointsMerge={true}
        onPointHover={onPointHoverCb}
        onPointClick={onPointClickCb}
        // rings disabled
        ringsData={[]}
        arcsData={arcs}
        arcColor={'color'}
        arcStroke={.16}
        arcDashLength={arcDashLengthCb} // the bigger the ranges, the calmer it looks
        arcDashGap={arcDashGapCb}
        arcDashAnimateTime={arcDashAnimateTimeCb}
        customLayerData={customLayerData}
        customThreeObject={customThreeObject}
        customThreeObjectUpdate={customThreeObjectUpdate}
        htmlElementsData={tooltipData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.012}
        htmlElement={tooltipElementCb}
        htmlElementVisibilityModifier={tooltipVisibilityCb}
        htmlTransitionDuration={0}
      />

      <section className={`content-container text-2xl ${isDesktopChrome ? 'fixed left-6 top-24 w-fit' : ''}`}>
        <AlbumList 
          albums={albums}
          activeAlbumTitle={activeAlbumTitle}
          onEnter={handleMouseEnter}
          onLeave={() => handleMouseLeave()}
          onSelect={handleAlbumSelect}
          onHideCard={hideAlbumCard}
        />
      </section>

      {activeAlbum && (
        <AlbumCard 
          album={activeAlbum} 
          onMobileClick={() => handleAlbumCardClick(activeAlbum.title)}
        />
      )}

      <footer className={`tracking-tight content`}>
        <div className="text-[0.9375rem] leading-tight text-right">
          <p className="m-0 p-0">&copy; 2026</p>
        </div>
      </footer>
    </section>
  );
}

export default Globe;
