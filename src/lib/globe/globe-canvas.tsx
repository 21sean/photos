'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject
} from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { Topology } from 'topojson-specification';
import type { Destination } from '@/lib/destinations';
import countriesTopology from '@/data/countries-110m.json';
import { buildArcs } from './arcs';
import { altitudeForDiameter, setScreenOffset } from './camera';
import { createGlassPass, measureGlassPanes } from './glass';
import { createLandMaterial, createOceanMaterial } from './materials';
import {
  createActiveMarker,
  createCountryBorders,
  createGraticule,
  createMarkers,
  createStars,
  landFeatures,
  type SceneObject
} from './scene';
import { EARTH_RADIUS_KM, GLOBE_THEME } from './theme';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/** Degrees per second-ish (OrbitControls units) while nothing is selected. */
const AUTO_ROTATE_SPEED = 0.32;
/** Spin up to this much faster while no destination is anywhere in view. */
const AUTO_ROTATE_BOOST = 1.4;
/** Pause after the visitor lets go before the globe starts turning again. */
const AUTO_ROTATE_RESUME_MS = 1400;

/** Latitude the camera rests at when nothing is selected. */
const HOME_LAT = 30;
/** Arrival: glide in from deep space over the Pacific, settle over the Atlantic. */
const INTRO_FLIGHT_MS = 2400;
const INTRO_FROM = { lat: 2, lng: -110 };
const INTRO_TO = { lat: HOME_LAT, lng: -30 };

const FOCUS_FLIGHT_MS = 1000;
const HOME_FLIGHT_MS = 1000;
/** Page transition: plunge towards the destination being opened. */
const DIVE_FLIGHT_MS = 900;
const DIVE_ALTITUDE = 0.16;

/** While a destination is in focus, drift east-west around it. */
const SWAY_DEGREES = 0.6;
const SWAY_PERIOD_MS = 7000;

/** Closest the visitor may zoom, in globe radii above the surface. */
const MIN_ALTITUDE = 0.35;

/** How close (px) a pointer must be to a marker to count as on it. */
const PICK_RADIUS_MOUSE = 18;
const PICK_RADIUS_TOUCH = 30;
/** A press that moves further than this is a drag, not a click. */
const CLICK_SLOP_PX = 6;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Glow diameter of a marker, in CSS pixels: an album, and a side spot. */
const MARKER_SIZE = 30;
const SPOT_SIZE = 19;

const RENDERER_CONFIG = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
} as const;

// ---------------------------------------------------------------------------
// Layer accessors. Module-level so their identity never changes, which keeps
// react-globe.gl from rebuilding a layer on every render.
// ---------------------------------------------------------------------------

const random = (min: number, max: number) => min + Math.random() * (max - min);

const landAltitude = () => GLOBE_THEME.landAltitude;
const landSideColor = () => TRANSPARENT;
const coastlineColor = () => GLOBE_THEME.coastline;
const arcDashLength = () => random(0.25, 0.6);
const arcDashGap = () => random(0.7, 1.6);
const arcDashInitialGap = () => random(0, 2);
const arcDashAnimateTime = () => random(6000, 12000);
const ringColor = () => (t: number) =>
  `rgba(255, 236, 160, ${(Math.sqrt(1 - t) * 0.9).toFixed(3)})`;

// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Figure spaces pad the numbers so the readout holds still as they change
const pad = (value: string, length: number) => value.padStart(length, '\u2007');

function formatReadout(lat: number, lng: number, altitude: number): string {
  // Longitude keeps running past ±180 while the globe turns: wrap it
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const latText = `${pad(Math.abs(lat).toFixed(2), 5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngText = `${pad(Math.abs(wrapped).toFixed(2), 6)}° ${wrapped >= 0 ? 'E' : 'W'}`;
  const km = Math.round((altitude * EARTH_RADIUS_KM) / 10) * 10;
  return `${latText}  ${lngText}   ${pad(km.toLocaleString('en-US'), 6)} km up`;
}

type View = {
  /** Camera altitude at which the globe exactly fills its frame. */
  idleAltitude: number;
  /** Camera altitude when a destination is in focus. */
  focusAltitude: number;
  /** Whether the camera drifts around a focused destination. */
  sway: boolean;
};

export type GlobeCanvasProps = {
  destinations: Destination[];
  /** The destination the camera should be looking at, if any. */
  active: Destination | null;
  /** Plunge towards the active destination (used as a page transition). */
  diving: boolean;
  /**
   * Element whose box says where the globe sits and how large it is at rest.
   * It also carries the `--globe-focus-altitude` and `--globe-sway` custom
   * properties, so the layout is decided entirely in CSS.
   */
  frameRef: RefObject<HTMLElement | null>;
  /** Moved onto the active destination's marker on every frame. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Receives the live "where is the camera" readout. */
  readoutRef: RefObject<HTMLElement | null>;
  /** The pointer moved onto, or off, a destination's marker. */
  onHover: (destination: Destination | null) => void;
  /** A marker was clicked or tapped (`null`: empty space). */
  onPick: (destination: Destination | null) => void;
  /**
   * The globe has rendered and can be revealed. `glass` says whether it is
   * also painting the page's `data-glass` panels (see glass.ts); if not,
   * they keep their CSS fallback.
   */
  onReady: (state: { glass: boolean }) => void;
};

export default function GlobeCanvas({
  destinations,
  active,
  diving,
  frameRef,
  anchorRef,
  readoutRef,
  onHover,
  onPick,
  onReady
}: GlobeCanvasProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [ready, setReady] = useState(false);

  // --- static layer data ---------------------------------------------------

  const land = useMemo(
    () => landFeatures(countriesTopology as unknown as Topology),
    []
  );
  const oceanMaterial = useMemo(createOceanMaterial, []);
  const landMaterial = useMemo(createLandMaterial, []);
  useEffect(
    () => () => {
      oceanMaterial.dispose();
      landMaterial.dispose();
    },
    [oceanMaterial, landMaterial]
  );

  const markers = useMemo(
    () =>
      destinations.flatMap(destination => [
        {
          destination,
          lat: destination.lat,
          lng: destination.lng,
          size: MARKER_SIZE
        },
        ...destination.spots.map(spot => ({
          destination,
          ...spot,
          size: SPOT_SIZE
        }))
      ]),
    [destinations]
  );
  const arcs = useMemo(() => buildArcs(destinations), [destinations]);
  const rings = useMemo(() => (active ? [active] : []), [active]);

  // --- mutable state shared with the frame loop ----------------------------

  const view = useRef<View>({
    idleAltitude: 2,
    focusAltitude: 0.8,
    sway: false
  });
  const activeRef = useRef(active);
  const divingRef = useRef(diving);
  const introDone = useRef(false);
  /** Timestamp after which the globe may turn by itself again. */
  const autoRotateFrom = useRef(0);
  /** The visitor is dragging or zooming right now. */
  const interacting = useRef(false);
  /** Timestamp after which the camera sways around the focused destination. */
  const swayFrom = useRef(Infinity);
  const activeSprite = useRef<THREE.Sprite | null>(null);

  // --- canvas size ---------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = container;
      if (!width || !height) return;
      setSize(previous =>
        previous?.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // --- layout: where the globe sits and how far away the camera rests -------

  const applyView = useCallback(() => {
    const globe = globeRef.current;
    const container = containerRef.current;
    const frame = frameRef.current;
    if (!globe || !container || !frame) return;

    const { clientWidth: width, clientHeight: height } = container;
    const box = frame.getBoundingClientRect();
    if (!width || !height || !box.width) return;

    // The canvas is pinned to the viewport's top-left corner, so the frame's
    // viewport coordinates are also its canvas coordinates
    const camera = globe.camera() as THREE.PerspectiveCamera;
    setScreenOffset(
      camera,
      width,
      height,
      box.left + box.width / 2 - width / 2,
      box.top + box.height / 2 - height / 2
    );

    const styles = getComputedStyle(frame);
    view.current = {
      idleAltitude: altitudeForDiameter(box.width, height, camera.fov),
      focusAltitude:
        parseFloat(styles.getPropertyValue('--globe-focus-altitude')) || 0.8,
      sway: styles.getPropertyValue('--globe-sway').trim() === '1'
    };

    // At rest, keep the globe matched to its frame as the window changes
    if (introDone.current && !activeRef.current && !interacting.current) {
      globe.pointOfView({ altitude: view.current.idleAltitude });
    }
  }, [frameRef]);

  useEffect(() => {
    if (!ready) return;
    applyView();
    const frame = frameRef.current;
    const observer = new ResizeObserver(applyView);
    if (frame) observer.observe(frame);
    window.addEventListener('resize', applyView);
    window.visualViewport?.addEventListener('resize', applyView);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyView);
      window.visualViewport?.removeEventListener('resize', applyView);
    };
    // `size` is listed so the offset is re-applied after react-globe.gl has
    // resized the renderer, which resets the camera's projection
  }, [ready, size, applyView, frameRef]);

  // --- one-time scene setup, arrival flight and the frame loop -------------

  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe) return;

    const reducedMotion = prefersReducedMotion();
    const scene = globe.scene();
    const renderer = globe.renderer();
    const controls = globe.controls();
    const radius = globe.getGlobeRadius();

    // Supersample up to 2x: the biggest win for clean coastlines and borders
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);

    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;

    const onInteractionStart = () => {
      interacting.current = true;
      // Once the visitor takes the controls, stop steering the camera
      swayFrom.current = Infinity;
      // Momentum is for hands: a drag should coast to a stop
      controls.enableDamping = true;
    };
    const onInteractionEnd = () => {
      interacting.current = false;
      autoRotateFrom.current = performance.now() + AUTO_ROTATE_RESUME_MS;
    };
    controls.addEventListener('start', onInteractionStart);
    controls.addEventListener('end', onInteractionEnd);

    // Decorations that react-globe.gl has no layer for
    const stars = createStars(radius, pixelRatio);
    const graticule = createGraticule(radius * 3);
    const borders = createCountryBorders(
      countriesTopology as unknown as Topology,
      radius
    );
    const lights = createMarkers(
      markers.map(({ lat, lng, size }) => ({
        position: globe.getCoords(lat, lng, GLOBE_THEME.marker.altitude),
        size
      })),
      pixelRatio
    );
    const marker = createActiveMarker();
    marker.sprite.visible = false;
    const extras: SceneObject[] = [stars, graticule, borders, lights, marker];
    for (const extra of extras) scene.add(extra.object);
    activeSprite.current = marker.sprite;

    // Liquid glass for the page's panels, painted inside this frame. The
    // extra pass means the scene is drawn into a buffer first, which needs
    // its own multisampling to keep coastlines and borders smooth.
    const composer = globe.postProcessingComposer();
    const glass = createGlassPass();
    const root =
      containerRef.current?.closest<HTMLElement>('[data-glass-root]');
    let glassOn = false;
    if (root && renderer.capabilities.isWebGL2) {
      const drawingSize = renderer.getDrawingBufferSize(new THREE.Vector2());
      composer.reset(
        new THREE.WebGLRenderTarget(drawingSize.x, drawingSize.y, {
          type: THREE.HalfFloatType,
          samples: 4
        })
      );
      composer.addPass(glass.pass);
      // With a pass after it, the scene pass clears its buffer using a clear
      // colour that was encoded for the screen, so the background comes out
      // encoded twice (washed out). A scene background is cleared inside the
      // render call instead, in the buffer's own colour space.
      scene.background = new THREE.Color(GLOBE_THEME.background);
      glassOn = true;
    }
    onReady({ glass: glassOn });

    // Arrival
    applyView();
    const { idleAltitude } = view.current;
    let introTimer: ReturnType<typeof setTimeout> | undefined;
    const finishIntro = () => {
      introDone.current = true;
      autoRotateFrom.current = performance.now();
    };
    if (activeRef.current) {
      // A destination was chosen before the globe was ready: start there
      const { lat, lng } = activeRef.current;
      globe.pointOfView({ lat, lng, altitude: view.current.focusAltitude });
      finishIntro();
    } else if (reducedMotion) {
      globe.pointOfView({ ...INTRO_TO, altitude: idleAltitude });
      finishIntro();
    } else {
      globe.pointOfView({
        ...INTRO_FROM,
        altitude: Math.min(idleAltitude * 2.6, idleAltitude + 5)
      });
      globe.pointOfView(
        { ...INTRO_TO, altitude: idleAltitude },
        INTRO_FLIGHT_MS
      );
      introTimer = setTimeout(finishIntro, INTRO_FLIGHT_MS + 100);
    }

    // Frame loop: everything that changes continuously lives here, so there
    // is exactly one requestAnimationFrame chain to start and stop
    const cameraPosition = globe.camera().position;
    const startedAt = performance.now();
    let lastReadout = '';
    let anchorVisible: boolean | undefined;
    let frame = 0;
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);
      frame++;

      if (!reducedMotion) {
        const seconds = (now - startedAt) / 1000;
        oceanMaterial.uniforms.uTime.value = 8 + seconds;
        stars.material.uniforms.uTime.value = seconds;
        lights.material.uniforms.uTime.value = seconds;
      }

      if (glassOn && root && containerRef.current) {
        glass.update(
          measureGlassPanes(root),
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }

      const focused = activeRef.current;
      const pov = globe.pointOfView();

      // Zoom limits follow the layout, but are only tightened once the
      // camera is back inside them: clamping mid-flight would make it jump
      if (introDone.current && !divingRef.current) {
        const farthest = Math.max(view.current.idleAltitude * 1.3, 2.2);
        controls.minDistance = radius * (1 + MIN_ALTITUDE);
        controls.maxDistance = radius * (1 + Math.max(farthest, pov.altitude));
      }

      // Turn slowly at rest, and hurry across stretches with nothing to see
      const idle =
        introDone.current &&
        !focused &&
        !divingRef.current &&
        !interacting.current &&
        now >= autoRotateFrom.current;
      controls.autoRotate = idle;
      if (idle) {
        let nearest = 180;
        for (const destination of destinations) {
          const delta = Math.abs(
            ((((destination.lng - pov.lng) % 360) + 540) % 360) - 180
          );
          if (delta < nearest) nearest = delta;
        }
        const emptiness = THREE.MathUtils.clamp((nearest - 40) / 60, 0, 1);
        controls.autoRotateSpeed =
          AUTO_ROTATE_SPEED * (1 + AUTO_ROTATE_BOOST * emptiness);
      }

      // Hover around the focused destination so the shot stays alive. Only
      // lat/lng are set: altitude is left alone so pinch-zoom keeps working
      if (
        focused &&
        view.current.sway &&
        !reducedMotion &&
        !divingRef.current &&
        now >= swayFrom.current
      ) {
        const phase = ((now - swayFrom.current) / SWAY_PERIOD_MS) * Math.PI * 2;
        globe.pointOfView({
          lat: focused.lat,
          lng: focused.lng + Math.sin(phase) * SWAY_DEGREES
        });
      }

      // Camera readout, at a third of the frame rate so it stays legible
      const readout = readoutRef.current;
      if (readout && frame % 3 === 0) {
        const text = formatReadout(pov.lat, pov.lng, pov.altitude);
        if (text !== lastReadout) {
          readout.textContent = text;
          lastReadout = text;
        }
      }

      // Pin the callout to the focused marker
      const anchor = anchorRef.current;
      if (anchor && focused) {
        const point = globe.getCoords(
          focused.lat,
          focused.lng,
          GLOBE_THEME.marker.altitude
        );
        const { x, y } = globe.getScreenCoords(
          focused.lat,
          focused.lng,
          GLOBE_THEME.marker.altitude
        );
        // In front of the horizon, as seen from the camera?
        const visible =
          cameraPosition.x * point.x +
            cameraPosition.y * point.y +
            cameraPosition.z * point.z >
          radius * radius * 1.01;
        anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        if (visible !== anchorVisible) {
          anchor.dataset.visible = String(visible);
          anchorVisible = visible;
        }
      } else {
        anchorVisible = undefined;
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(introTimer);
      controls.removeEventListener('start', onInteractionStart);
      controls.removeEventListener('end', onInteractionEnd);
      for (const extra of extras) {
        scene.remove(extra.object);
        extra.dispose();
      }
      if (glassOn) {
        composer.removePass(glass.pass);
        glass.pass.dispose();
        scene.background = null;
      }
      activeSprite.current = null;
      introDone.current = false;
      // Hand the WebGL context back promptly instead of waiting for GC.
      // Deferred so react-globe.gl's own teardown runs first.
      setTimeout(() => {
        renderer.dispose();
        renderer.forceContextLoss();
      }, 0);
    };
  }, [
    ready,
    destinations,
    markers,
    oceanMaterial,
    applyView,
    anchorRef,
    readoutRef,
    onReady
  ]);

  // --- focus: fly to the active destination, or back out -------------------

  useEffect(() => {
    const previous = activeRef.current;
    activeRef.current = active;

    const globe = globeRef.current;
    if (!ready || !globe) return;

    const sprite = activeSprite.current;
    if (sprite) {
      sprite.visible = Boolean(active);
      if (active) {
        const { x, y, z } = globe.getCoords(
          active.lat,
          active.lng,
          GLOBE_THEME.marker.altitude
        );
        sprite.position.set(x, y, z);
      }
    }

    // Damping carries leftover auto-rotation into the flight and past its
    // target; it comes back on when the visitor next grabs the globe
    globe.controls().enableDamping = false;

    if (active) {
      const duration = prefersReducedMotion() ? 0 : FOCUS_FLIGHT_MS;
      globe.pointOfView(
        {
          lat: active.lat,
          lng: active.lng,
          altitude: view.current.focusAltitude
        },
        duration
      );
      swayFrom.current = performance.now() + duration + 100;
    } else if (previous) {
      swayFrom.current = Infinity;
      const duration = prefersReducedMotion() ? 0 : HOME_FLIGHT_MS;
      globe.pointOfView(
        { lat: HOME_LAT, altitude: view.current.idleAltitude },
        duration
      );
      autoRotateFrom.current = performance.now() + duration + 100;
    }
  }, [active, ready]);

  useEffect(() => {
    divingRef.current = diving;
    const globe = globeRef.current;
    const target = activeRef.current;
    if (!diving || !globe || !target || prefersReducedMotion()) return;
    globe.controls().minDistance =
      globe.getGlobeRadius() * (1 + DIVE_ALTITUDE / 2);
    globe.pointOfView(
      { lat: target.lat, lng: target.lng, altitude: DIVE_ALTITUDE },
      DIVE_FLIGHT_MS
    );
  }, [diving]);

  // --- pointer: hover and click markers ------------------------------------
  // Markers are tiny, so instead of raycasting them the pointer is matched
  // against their screen positions with a generous radius.

  const pick = useCallback(
    (clientX: number, clientY: number, pickRadius: number) => {
      const globe = globeRef.current;
      if (!globe) return null;
      const cameraPosition = globe.camera().position;
      const horizon = globe.getGlobeRadius() ** 2;

      let best: Destination | null = null;
      let bestDistance = pickRadius;
      for (const marker of markers) {
        const point = globe.getCoords(
          marker.lat,
          marker.lng,
          GLOBE_THEME.marker.altitude
        );
        const facing =
          cameraPosition.x * point.x +
          cameraPosition.y * point.y +
          cameraPosition.z * point.z;
        if (facing < horizon) continue; // on the far side of the globe

        const screen = globe.getScreenCoords(
          marker.lat,
          marker.lng,
          GLOBE_THEME.marker.altitude
        );
        const distance = Math.hypot(screen.x - clientX, screen.y - clientY);
        if (distance < bestDistance) {
          best = marker.destination;
          bestDistance = distance;
        }
      }
      return best;
    },
    [markers]
  );

  const hovered = useRef<Destination | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);

  const setHovered = (destination: Destination | null) => {
    if (destination === hovered.current) return;
    hovered.current = destination;
    if (containerRef.current) {
      containerRef.current.style.cursor = destination ? 'pointer' : '';
    }
    onHover(destination);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return;
    setHovered(pick(event.clientX, event.clientY, PICK_RADIUS_MOUSE));
  };

  const handlePointerDown = (event: PointerEvent) => {
    press.current = event.isPrimary
      ? { x: event.clientX, y: event.clientY }
      : null; // a second finger means pinch, never a tap
  };

  const handlePointerUp = (event: PointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > CLICK_SLOP_PX) return;
    onPick(
      pick(
        event.clientX,
        event.clientY,
        event.pointerType === 'mouse' ? PICK_RADIUS_MOUSE : PICK_RADIUS_TOUCH
      )
    );
  };

  // --- render --------------------------------------------------------------

  const handleGlobeReady = useCallback(() => setReady(true), []);

  return (
    <div
      ref={containerRef}
      className="globe-canvas"
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (press.current = null)}
      onPointerLeave={() => setHovered(null)}
    >
      {size && (
        <GlobeGL
          ref={globeRef}
          width={size.width}
          height={size.height}
          rendererConfig={RENDERER_CONFIG}
          onGlobeReady={handleGlobeReady}
          animateIn={false}
          // Markers are picked in screen space (see `pick`), so the built-in
          // per-move raycast against every polygon would be wasted work
          enablePointerInteraction={false}
          backgroundColor={GLOBE_THEME.background}
          backgroundImageUrl={null}
          globeMaterial={oceanMaterial}
          showAtmosphere
          atmosphereColor={GLOBE_THEME.atmosphere}
          atmosphereAltitude={GLOBE_THEME.atmosphereAltitude}
          showGraticules={false}
          polygonsData={land}
          polygonCapMaterial={landMaterial}
          polygonSideColor={landSideColor}
          polygonStrokeColor={coastlineColor}
          polygonAltitude={landAltitude}
          polygonsTransitionDuration={0}
          arcsData={arcs}
          arcColor="color"
          arcStroke={0.1}
          arcAltitudeAutoScale={0.42}
          arcDashLength={arcDashLength}
          arcDashGap={arcDashGap}
          arcDashInitialGap={arcDashInitialGap}
          arcDashAnimateTime={arcDashAnimateTime}
          arcsTransitionDuration={0}
          ringsData={rings}
          ringColor={ringColor}
          ringAltitude={GLOBE_THEME.marker.altitude}
          ringMaxRadius={3.2}
          ringPropagationSpeed={2.2}
          ringRepeatPeriod={1300}
        />
      )}
    </div>
  );
}
