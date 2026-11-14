'use client';

import { Album } from '@/types';
import cn from 'classnames';
import createGlobe, { COBEOptions, Marker } from 'cobe';
import { useEffect, useMemo, useRef } from 'react';
import { useSpring } from '@react-spring/web';

// ============================================
// GLOBE CONFIGURATION - Adjust these values
// ============================================
const MAP_BRIGHTNESS = 8.2;
const MAP_BASE_BRIGHTNESS = 1;
const GLOW_COLOR: [number, number, number] = [44 / 255, 40 / 255, 59 / 255];
const DIFFUSE = 1.25;
const DARK = 0.1;
const BASE_COLOR: [number, number, number] = [93 / 255, 22 / 255, 22 / 255];
// cobe 2 draws markers as filled, raised discs; keep them dot-matrix sized
const MARKER_SIZE = 0.016;
// Radians per frame while idle
const SPIN_SPEED = 0.004;
// ============================================

const GLOBE_CONFIG: COBEOptions = {
  width: 1024,
  height: 1024,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.42,
  dark: DARK,
  diffuse: DIFFUSE,
  mapSamples: 30_000,
  mapBrightness: MAP_BRIGHTNESS,
  mapBaseBrightness: MAP_BASE_BRIGHTNESS,
  baseColor: BASE_COLOR,
  markerColor: [251 / 255, 21 / 255, 21 / 255],
  glowColor: GLOW_COLOR,
  opacity: 0.55,
  markerElevation: 0,
  markers: []
};

function toMarkers(albums: Array<Album>): Array<Marker> {
  return albums.flatMap(album => [
    { location: [album.lat, album.lng], size: MARKER_SIZE },
    ...album.locations.map((location): Marker => ({
      location: [location.lat, location.lng],
      size: MARKER_SIZE
    }))
  ]);
}

export default function Globe({
  albums,
  className,
  config = GLOBE_CONFIG
}: {
  albums: Array<Album>;
  className?: string;
  config?: COBEOptions;
}) {
  const markers = useMemo(() => toMarkers(albums), [albums]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // clientX where the current drag started, or null when not dragging
  const dragOrigin = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const [{ r }, api] = useSpring(() => ({
    r: 0,
    config: {
      mass: 1,
      tension: 280,
      friction: 40,
      precision: 0.001
    }
  }));

  const setDragOrigin = (value: number | null) => {
    dragOrigin.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value === null ? 'grab' : 'grabbing';
    }
  };

  const updateMovement = (clientX: number) => {
    if (dragOrigin.current === null) return;
    const delta = clientX - dragOrigin.current;
    dragDelta.current = delta;
    api.start({ r: delta / 200 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let phi = -0.75;

    // cobe 2 multiplies width/height by devicePixelRatio itself, so it is
    // given CSS pixels here
    const globe = createGlobe(canvas, {
      ...config,
      markers,
      width: canvas.offsetWidth,
      height: canvas.offsetWidth
    });

    // Resizing reallocates the drawing buffer, so only do it when needed
    const onResize = () => {
      globe.update({ width: canvas.offsetWidth, height: canvas.offsetWidth });
    };
    window.addEventListener('resize', onResize);

    // cobe 2 no longer runs its own loop: the caller drives each frame
    let raf = 0;
    const frame = () => {
      if (dragOrigin.current === null && !prefersReducedMotion) {
        phi += SPIN_SPEED;
      }
      globe.update({ phi: phi + r.get() });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const fadeIn = setTimeout(() => {
      canvas.style.opacity = window.innerWidth <= 640 ? '0.5' : '0.85';
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeIn);
      window.removeEventListener('resize', onResize);
      globe.destroy();
    };
  }, [config, markers, r]);

  return (
    <div className={cn('absolute aspect-[1/1] w-full', className)}>
      <canvas
        className="h-full w-full cursor-grab opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        ref={canvasRef}
        onPointerDown={e => setDragOrigin(e.clientX - dragDelta.current)}
        onPointerUp={() => setDragOrigin(null)}
        onPointerOut={() => setDragOrigin(null)}
        onMouseMove={e => updateMovement(e.clientX)}
        onTouchMove={e => e.touches[0] && updateMovement(e.touches[0].clientX)}
      />
    </div>
  );
}
