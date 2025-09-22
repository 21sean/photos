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

type Ref = CustomGlobeMethods | undefined; // Reference to globe instance
type GlobeEl = React.MutableRefObject<Ref>; // React `ref` passed to globe element

interface CustomGlobeMethods extends GlobeMethods {
  controls(): ReturnType<GlobeMethods['controls']> & {
    autoRotateForced: boolean;
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
  setPointAltitude: React.Dispatch<React.SetStateAction<number>>
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
  function handleMouseLeave() {
    setPointAltitude(0.002);
    setActiveAlbumTitle(undefined);

    globeEl.current?.pointOfView(
      {
        lat: 30,
        altitude: 2
      },
      1000
    );

    // Restore auto-rotation after the view transition
    setTimeout(() => {
      if (globeEl.current?.controls) {
        const controls = globeEl.current.controls();
        controls.autoRotateForced = false; // Allow auto-rotation to resume first
        controls.autoRotate = true; // Then enable rotation
        controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED; // Reset to default speed
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
        color: ['red', 'red']
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
        opacity: 0.2, // Slightly more transparent
        transparent: true
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
      if (controls.autoRotateForced) {
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
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      
      // Force enable auto-rotation
      controls.autoRotate = true;
      controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED;
      controls.autoRotateForced = false; // Initialize the forced flag

      globeEl.current.pointOfView({ lat: 30, lng: -30, altitude: 2 });

      // Start the dynamic rotation speed
      autoRotateSpeed();
      
      // Multiple attempts to ensure auto-rotation starts
      const forceRotation = () => {
        if (globeEl.current) {
          const controls = globeEl.current.controls();
          controls.autoRotate = true;
          controls.autoRotateSpeed = DEFAULT_AUTOROTATE_SPEED;
          controls.autoRotateForced = false;
        }
      };
      
      setTimeout(forceRotation, 100);
      setTimeout(forceRotation, 500);
      setTimeout(forceRotation, 1000);
      setTimeout(forceRotation, 2000);
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

  // scene config
  useScene(globeElRef);

  // land shapes
  const { landPolygons, polygonMaterial } = useLandPolygons();

  // `albums` map points
  const { points, pointAltitude, setPointAltitude } = usePoints(albums);

  // rings animation
  const {
    rings,
    colorInterpolator,
    handleMouseEnter,
    handleMouseLeave,
    activeAlbumTitle
  } = useRings(globeEl, setPointAltitude);
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
  const pointColorCb = React.useCallback(() => 'rgba(255, 0, 0, 0.75)', []);
  const pointRadiusCb = React.useCallback((point: any) => (point as { radius: number }).radius, []);
  const onPointHoverCb = React.useCallback((point: any) => {
    if (point) {
      handleMouseEnter(point as Album);
    } else {
      handleMouseLeave();
    }
  }, [handleMouseEnter, handleMouseLeave]);
  const onPointClickCb = React.useCallback((point: any) => {
    if (point) {
      const album = point as Album;
      // Show album card instead of navigating directly (both mobile and desktop)
      // Delegate to album list interaction
      handleMouseEnter(album);
    }
  }, [handleMouseEnter]);
  const arcDashLengthCb = React.useCallback(() => randomInRange(0.06, 0.7) / 1, []);
  const arcDashGapCb = React.useCallback(() => randomInRange(0.025, 0.4) * 10, []);
  const arcDashAnimateTimeCb = React.useCallback(() => randomInRange(0.08, 0.8) * 20000 + 500, []);

  // Handle navigation when clicking "Click to enter" on album card
  const handleAlbumCardClick = (albumTitle: string) => {
    // Navigate to the album
    window.location.href = `/${titleToSlug(albumTitle)}`;
  };

  // Hide album card when double-clicking sean.photo text or globe background
  const hideAlbumCard = () => {
    console.log('Hiding album card');
    handleMouseLeave(); // This will clear the active album and hide the card
  };


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

  return (
    <section
      ref={containerRef as any}
      className={`globe-container relative
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
        height={(containerHeight && containerHeight > 0) ? containerHeight : (height && height > 0 ? height : undefined)}
        rendererConfig={{ 
          antialias: false, // Better performance
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
        ringsData={rings}
        ringColor={() => colorInterpolator}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        arcsData={arcs}
        arcColor={'color'}
        arcDashLength={arcDashLengthCb} // the bigger the ranges, the calmer it looks
        arcDashGap={arcDashGapCb}
        arcDashAnimateTime={arcDashAnimateTimeCb}
        customLayerData={customLayerData}
        customThreeObject={customThreeObject}
        customThreeObjectUpdate={customThreeObjectUpdate}
      />

      <section className="content-container grow text-3xl">
        <AlbumList 
          albums={albums}
          activeAlbumTitle={activeAlbumTitle}
          onEnter={handleMouseEnter}
          onLeave={handleMouseLeave}
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
