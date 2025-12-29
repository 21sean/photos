'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import GlobeGL from 'react-globe.gl';
import type { GlobeProps, GlobeMethods } from 'react-globe.gl';
import { GeoJsonGeometry } from 'three-geojson-geometry';
import { geoGraticule10 } from 'd3-geo';
import * as topojson from 'topojson-client';
import { useWindowSize } from '@/hooks/use-window-size';
import { useShake } from '@/hooks/use-shake';
import { Album, AlbumTitle, types } from '@/types/albums';
import { titleToSlug } from '@/lib/api/slug';
import { AlbumCard } from './card';
import useHDRSetup from '@/hooks/use-hdr-setup';
import AlbumList from '@/lib/globes/album-list';

// Flying lines (arc dash) speed: 1 = current speed, smaller = slower, larger = faster
const FLYING_LINES_SPEED = 0.2;

// Zoom tuning: allow 30% more zoom-in and 50% less zoom-out
const ZOOM_IN_EXTRA = 0.3;
const ZOOM_OUT_REDUCTION = 0.5;

type MapMode = 'default' | 'satellite';

// Satellite tuning
const SATELLITE_TILE_MAX_LEVEL = 16;

type Ref = CustomGlobeMethods | undefined; // Reference to globe instance
type GlobeEl = React.MutableRefObject<Ref>; // React `ref` passed to globe element

interface CustomGlobeMethods extends GlobeMethods {
  controls(): ReturnType<GlobeMethods['controls']> & {
    autoRotateForced: boolean;
    autoRotateUserPaused: boolean;
  };

  globeTileEngineClearCache?: () => void;
}

type Arc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: Array<string>;
};

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function useLandPolygons() {
  const [landPolygons, setLandPolygons] = useState([]);
  useEffect(() => {
    async function fetchLandPolygons() {
      const landTopo = await import('../../data/land-110m.json');
      const landPolygons = topojson.feature(
        landTopo,
        landTopo.objects.land
      ).features;
      setLandPolygons(landPolygons);
    }
    fetchLandPolygons();
  }, []);
  const polygonMaterial = React.useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.77,
    transparent: true
  }), []);

  return { landPolygons, polygonMaterial };
}

function usePoints(albums: Array<Album>) {
  const [altitude, setAltitude] = useState(0.002);
  const points = React.useMemo(() => {
    const pts: Array<any> = [];
    const locations = albums.filter(album => album.type === types.LOCATION);
    for (const album of locations) {
      pts.push(
        { ...album, radius: 0.19 },
        ...album.locations.map(location => ({
          ...album,
          lat: location.lat,
          lng: location.lng,
          radius: 0.135
        }))
      );
    }
    return pts;
  }, [albums]);
  return {
    pointAltitude: altitude,
    setPointAltitude: setAltitude,
    points
  };
}

function useAlbumInteraction(
  globeEl: GlobeEl,
  setPointAltitude: React.Dispatch<React.SetStateAction<number>>,
  isPinnedRef?: React.MutableRefObject<boolean>
) {
  const [activeAlbumTitle, setActiveAlbumTitle] = useState<AlbumTitle>();

  const [enterTimeoutId, setEnterTimeoutId] = useState<NodeJS.Timeout>();
  function handleMouseEnter({ lat, lng, title, type }: Album) {
    setActiveAlbumTitle(title);

    clearTimeout(enterTimeoutId);

    // Stop auto-rotation when hovering over any location
    if (globeEl.current && globeEl.current.controls) {
      const controls = globeEl.current.controls();
      controls.autoRotateForced = true; // Set forced flag first
      controls.autoRotate = false; // Then disable rotation
    }

    const id = setTimeout(() => {
      if (type === types.LOCATION) {
        // Slightly more zoomed out on mobile devices
        const isMobile = typeof window !== 'undefined' && (
          (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
          window.innerWidth <= 768
        );
        const altitudeOnFocus = isMobile ? 1.2 : 1;
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
    setPointAltitude(0.002);
    setActiveAlbumTitle(undefined);

    const isMobile = typeof window !== 'undefined' && (
      (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
      window.innerWidth <= 768
    );
    const defaultAltitude = isMobile ? 2.8 : 2;
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
    handleMouseEnter,
    handleMouseLeave
  };
}

function generateArcs(albums: Array<Album>) {
  const data = [];
  for (let i = 0; i < albums.length; i++) {
    for (let j = i + 1; j < albums.length; j++) {
      data.push({
        startLat: albums[i].lat,
        startLng: albums[i].lng,
        endLat: albums[j].lat,
        endLng: albums[j].lng,
        color: ['red', 'purple']
      });
    }
  }
  return data;
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

function useGlobeReady(globeEl: GlobeEl, mapMode: MapMode) {
  const [globeReady, setGlobeReady] = useState(false);
  const originalLightsRef = useRef<any[] | null>(null);

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

    const isMobile = typeof window !== 'undefined' && (
      (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
      window.innerWidth <= 768
    );
    const initialAltitude = isMobile ? 2.8 : 2;
    globeEl.current.pointOfView({ lat: 30, lng: -30, altitude: initialAltitude });

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

  // Zoom constraints update (varies by map mode)
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;

    const controls = globeEl.current.controls();
    const isMobile = typeof window !== 'undefined' && (
      (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
      window.innerWidth <= 768
    );

    // Clamp zoom range (OrbitControls distances are in world units)
    const globeRadius = globeEl.current.getGlobeRadius?.() ?? 100;
    const distanceForAltitude = (altitude: number) => globeRadius * (1 + altitude);

    const baselineMinAltitude = isMobile ? 1.2 : 1;
    const baselineMaxAltitude = isMobile ? 6 : 4;

    const minAltitude = mapMode === 'satellite'
      ? (isMobile ? 0.28 : 0.12) // allow much closer zoom on satellite
      : baselineMinAltitude * (1 - ZOOM_IN_EXTRA);

    const maxAltitude = mapMode === 'satellite'
      ? baselineMaxAltitude * 3.0 // allow further zoom-out on satellite
      : baselineMaxAltitude * (1 - ZOOM_OUT_REDUCTION);

    controls.minDistance = distanceForAltitude(minAltitude);
    controls.maxDistance = distanceForAltitude(Math.max(maxAltitude, (isMobile ? 2.8 : 2)));
    controls.update?.();
  }, [globeEl, globeReady, mapMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Satellite-only lighting (replace default lights while satellite is active)
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;

    const globe = globeEl.current;

    // Capture original lights once.
    if (!originalLightsRef.current) {
      try {
        originalLightsRef.current = globe.lights();
      } catch {
        originalLightsRef.current = null;
      }
    }

    if (mapMode !== 'satellite') {
      if (originalLightsRef.current) {
        globe.lights(originalLightsRef.current);
      }
      return;
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(1.2, 0.8, 1.4);

    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-1.0, -0.2, -1.2);

    const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
    rim.position.set(-0.4, 1.1, 0.2);

    globe.lights([ambient, key, fill, rim]);

    return () => {
      if (originalLightsRef.current) {
        globe.lights(originalLightsRef.current);
      }
    };
  }, [globeEl, globeReady, mapMode]);

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
      color: 'lightgrey',
      transparent: true,
      opacity: 0.47
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
      color: 0xffffff /* it's neat to try different colors here */,
      opacity: 0.47,
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

// Satellite tiles (raster). Note: provider usage/terms apply.
// z/y/x format is used by ArcGIS World Imagery.
const SATELLITE_TILE_ENGINE_URL = (x: number, y: number, l: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;

/**
 * Detects if the current browser is iOS Safari
 */
function isIOSSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return isIOS && isSafari;
}

/**
 * Hook for persisting dark mode state in localStorage
 */
function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('globe-dark-mode');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const toggleDarkMode = React.useCallback(() => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem('globe-dark-mode', String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  return { isDarkMode, toggleDarkMode };
}

function Globe({ albums }: { albums: Array<Album> }) {
  // Initialize HDR capabilities
  useHDRSetup();
  
  // Dark mode state management
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  // Shake detection for iOS Safari only
  const isIOSSafariBrowser = React.useMemo(() => isIOSSafari(), []);
  
  useShake({
    threshold: 15,
    cooldown: 1000,
    onShake: isIOSSafariBrowser ? toggleDarkMode : undefined
  });
  
  // object config
  const globeEl = useRef<Ref>();
  const globeElRef: Ref = globeEl.current;

  // Map isDarkMode to mapMode: dark mode = satellite, light mode = default
  const mapMode: MapMode = isDarkMode ? 'satellite' : 'default';

  const { handleGlobeReady } = useGlobeReady(globeEl, mapMode);

  const isDesktopChrome = React.useMemo(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const isDesktop = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return isChrome && isDesktop;
  }, []);

  const isPinnedRef = useRef(false);

  // scene config (the current "default" look relies on scene decorations)
  useScene(globeElRef, mapMode === 'default');

  // land shapes
  const { landPolygons, polygonMaterial } = useLandPolygons();

  // `albums` map points
  const { points, pointAltitude, setPointAltitude } = usePoints(albums);

  // album interaction (hover, click, view transitions)
  const {
    handleMouseEnter,
    handleMouseLeave,
    activeAlbumTitle
  } = useAlbumInteraction(globeEl, setPointAltitude, isPinnedRef);
  const activeAlbum = albums.find(album => album.title === activeAlbumTitle);

  // arcs animation
  const { arcs } = useArcs(albums);

  // resize canvas on resize viewport
  const { width, height } = useWindowSize();

  // stars in the background
  const { customLayerData, customThreeObject, customThreeObjectUpdate } =
    useCustomLayer(globeEl);

  // Ensure tile cache doesn't mix between modes/providers.
  useEffect(() => {
    globeEl.current?.globeTileEngineClearCache?.();
  }, [mapMode]);

  const isMac = React.useMemo(() =>
    navigator.platform.toLowerCase().includes('mac') ||
    navigator.userAgent.toLowerCase().includes('mac')
  , []);

  const polygonAltitudeCb = React.useCallback(() => 0, []);
  const polygonSideColorCb = React.useCallback(() => 'rgba(255, 255, 255, 0)', []);
  const polygonStrokeColorCb = React.useCallback(() => (isMac ? 'black' : 'darkslategray'), [isMac]);
  const pointColorCb = React.useCallback((point: any) => {
    const p = point as Partial<Album> & { radius?: number };
    if (activeAlbumTitle && p.title === activeAlbumTitle) {
      return 'rgba(0, 200, 0, 0.9)'; // green for selected
    }
    return 'rgba(10, 31, 68, 0.8)'; // navy blue
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
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
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
  const stableOuterHeight = (typeof window !== 'undefined') ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--screen-h')) || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--outer-h')) || undefined) : undefined;

  return (
    <section
      ref={containerRef as any}
      className={`globe-container relative ${isDesktopChrome ? 'chrome-desktop' : ''} ${isDarkMode ? 'dark-globe' : ''}
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
          antialias: true, // Better performance
          powerPreference: "high-performance"
        }}
        onGlobeReady={handleGlobeReady}
        animateIn={false}
        backgroundColor={mapMode === 'satellite' ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'}
        backgroundImageUrl={null}
        atmosphereColor="rgba(255, 255, 255, 1)"
        showGlobe={mapMode === 'satellite'}
        showAtmosphere={false}
        showGraticules={false}
        globeTileEngineUrl={mapMode === 'satellite' ? SATELLITE_TILE_ENGINE_URL : undefined}
        globeTileEngineMaxLevel={mapMode === 'satellite' ? SATELLITE_TILE_MAX_LEVEL : undefined}
        polygonsData={mapMode === 'default' ? landPolygons : []}
        polygonCapMaterial={mapMode === 'default' ? polygonMaterial : undefined}
        polygonsTransitionDuration={0}
        polygonAltitude={polygonAltitudeCb}
        polygonSideColor={polygonSideColorCb}
        polygonStrokeColor={polygonStrokeColorCb} // compensate for platform's polygon rendering differences
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
        arcDashLength={arcDashLengthCb} // the bigger the ranges, the calmer it looks
        arcDashGap={arcDashGapCb}
        arcDashAnimateTime={arcDashAnimateTimeCb}
        customLayerData={customLayerData}
        customThreeObject={customThreeObject}
        customThreeObjectUpdate={customThreeObjectUpdate}
      />

      <section className={`content-container text-3xl ${isDesktopChrome ? 'fixed left-6 top-24 w-fit' : ''}`}>
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
