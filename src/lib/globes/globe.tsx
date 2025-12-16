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
import { titleToSlug } from '@/lib/api/slug';
import { AlbumCard } from './card';
import useHDRSetup from '@/hooks/use-hdr-setup';
import AlbumList from '@/lib/globes/album-list';

// Flying lines (arc dash) speed: 1 = current speed, smaller = slower, larger = faster
const FLYING_LINES_SPEED = 0.2;

type Ref = CustomGlobeMethods | undefined; // Reference to globe instance
type GlobeEl = React.MutableRefObject<Ref>; // React `ref` passed to globe element

interface CustomGlobeMethods extends GlobeMethods {
  controls(): ReturnType<GlobeMethods['controls']> & {
    autoRotateForced: boolean;
    autoRotateUserPaused: boolean;
  };
}

type Ring = {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
};

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

function useRings(
  globeEl: GlobeEl,
  setPointAltitude: React.Dispatch<React.SetStateAction<number>>,
  isPinnedRef?: React.MutableRefObject<boolean>
) {
  const [activeAlbumTitle, setActiveAlbumTitle] = useState<AlbumTitle>();

  const [rings, setRings] = useState<Array<Ring>>([]);
  const colorInterpolator = React.useCallback((t: number) =>
    `rgba(255,100,50,${Math.sqrt(1 - t)})`, []);

  const [enterTimeoutId, setEnterTimeoutId] = useState<NodeJS.Timeout>();
  function handleMouseEnter({ lat, lng, title, type }: Album) {
    console.log('Mouse enter:', { title, type, lat, lng });
    console.log('globeEl current:', globeEl.current);

    setActiveAlbumTitle(title);

    clearTimeout(enterTimeoutId);

    // Stop auto-rotation when hovering over any location
    if (globeEl.current && globeEl.current.controls) {
      console.log('Stopping rotation...');
      const controls = globeEl.current.controls();
      controls.autoRotateForced = true; // Set forced flag first
      controls.autoRotate = false; // Then disable rotation
      console.log('AutoRotate set to:', controls.autoRotate);
    } else {
      console.log('globeEl.current or controls not available');
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

        setRings([
          { lat, lng, maxR: 9, propagationSpeed: 0.88, repeatPeriod: 1777 }
        ]);
      } else if (type === types.CUSTOM) {
        setPointAltitude(2);

        setRings([
          {
            lat: 90,
            lng: 0,
            maxR: 180,
            propagationSpeed: 27,
            repeatPeriod: 195
          }
        ]);
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

    setRings([]);
  }

  return {
    activeAlbumTitle,
    rings,
    colorInterpolator,
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

  useEffect(() => {
    if (globeReady && globeEl.current) {
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
      if (domEl) {
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

        // Ensure we clean up listeners
        const cleanupDrag = () => {
          domEl.removeEventListener('pointerdown', onPointerDownCapture, { capture: true } as any);
          window.removeEventListener('pointerup', endDrag as any);
          window.removeEventListener('pointercancel', endDrag as any);
          window.removeEventListener('blur', endDrag as any);
        };

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

        return cleanupDrag;
      }
      
    }
  }, [globeEl, globeReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    handleGlobeReady: () => setGlobeReady(true)
  };
}

function useScene(globeElRef: Ref) {
  useEffect(() => {
    if (!globeElRef) return;

    const scene = globeElRef.scene();

    const radius = 300;
    const graticules = new THREE.LineSegments(
      new GeoJsonGeometry(geoGraticule10(), radius, 2),
      new THREE.LineBasicMaterial({
        color: 'lightgrey',
        transparent: true,
        opacity: 0.47
      })
    );
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
    const innerSphere = new THREE.Mesh(
      innerSphereGeometry,
      innerSphereMaterial
    );
    innerSphere.renderOrder = Number.MAX_SAFE_INTEGER;
    scene.add(innerSphere);
  }, [globeElRef]);
}

const DEFAULT_AUTOROTATE_SPEED = .32; // Reduced by 30% from 1.75

function Globe({ albums }: { albums: Array<Album> }) {
  // Initialize HDR capabilities
  useHDRSetup();
  
  
  // object config
  const globeEl = useRef<Ref>();
  const globeElRef: Ref = globeEl.current;

  const { handleGlobeReady } = useGlobeReady(globeEl);

  const isDesktopChrome = React.useMemo(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const isDesktop = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return isChrome && isDesktop;
  }, []);

  const isPinnedRef = useRef(false);

  // scene config
  useScene(globeElRef);

  // land shapes
  const { landPolygons, polygonMaterial } = useLandPolygons();

  // `albums` map points
  const { points, pointAltitude, setPointAltitude } = usePoints(albums);

  // rings animation
  const {
    // rings,
    // colorInterpolator,
    handleMouseEnter,
    handleMouseLeave,
    activeAlbumTitle
  } = useRings(globeEl, setPointAltitude, isPinnedRef);
  const activeAlbum = albums.find(album => album.title === activeAlbumTitle);

  // arcs animation
  const { arcs } = useArcs(albums);

  // resize canvas on resize viewport
  const { width, height } = useWindowSize();

  // stars in the background
  const { customLayerData, customThreeObject, customThreeObjectUpdate } =
    useCustomLayer(globeEl);

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
    return 'rgba(255, 0, 0, 0.75)'; // default red
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
    console.log('Hiding album card');
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
      className={`globe-container relative ${isDesktopChrome ? 'chrome-desktop' : ''}
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
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(255, 255, 255, 1)"
        showGlobe={false}
        showAtmosphere={false}
        showGraticules={false}
        polygonsData={landPolygons}
        polygonCapMaterial={polygonMaterial}
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
        <div className="text-3xl text-center md:text-right">
          <p className="m-0 p-0">&copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </section>
  );
}

export default Globe;
