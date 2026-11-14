'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import { Photo } from '@/types';
import HDRImage from './hdr-image';
import { FlipIcon } from '../icons';
import ScrollReveal from '../fx/scroll-reveal';
import LoadingOrb from '../fx/loading-orb';
import { setupImageCleanup } from './ios-image-cleanup';
import { orientationOf } from './sizes';

/** The first photos are fetched eagerly at high priority; the rest are lazy. */
const PRIORITY_COUNT = 2;

function formatExifData(photo: Photo): string | null {
  const parts: string[] = [];
  if (photo.focalLength) parts.push(photo.focalLength.replace(' mm', 'mm'));
  if (photo.aperture) parts.push(`ƒ/${photo.aperture}`);
  if (photo.shutterSpeed) parts.push(`${photo.shutterSpeed}s`);
  if (photo.iso) parts.push(`ISO ${photo.iso}`);
  return parts.length ? parts.join('  •  ') : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function getDescriptionText(photo: Photo): string | null {
  if (photo.aiDescription) return photo.aiDescription;
  if (photo.aiDescriptionHtml) return stripHtml(photo.aiDescriptionHtml);
  return null;
}

/**
 * True once the element is on screen or about to be. Photos further down
 * have not started loading yet, so there is nothing to show an orb for.
 */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: '50% 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, near] as const;
}

function GalleryItem({ photo, priority }: { photo: Photo; priority: boolean }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [frameRef, near] = useNearViewport<HTMLDivElement>();
  const handleSettled = useCallback(() => setIsLoading(false), []);

  const exif = formatExifData(photo);
  const descriptionText = getDescriptionText(photo);

  return (
    // Sized in CSS from the photo's proportions (see .gallery-item), so the
    // layout is right in the server's HTML and stays right when the window
    // is resized or the device is turned
    <div
      className="gallery-item group select-none"
      data-orientation={orientationOf(photo)}
      style={{ '--ratio': photo.width / photo.height } as CSSProperties}
    >
      <div
        ref={frameRef}
        className="gallery-item__frame relative"
        style={{
          backgroundImage: photo.lqip ? `url("${photo.lqip}")` : undefined
        }}
      >
        <div
          style={{
            transform: isFlipped ? 'scaleX(-1)' : 'scaleX(1)',
            transition: 'transform 0.3s ease'
          }}
        >
          <HDRImage
            photo={photo}
            className="block h-auto w-full"
            priority={priority}
            onSettled={handleSettled}
          />
        </div>

        {/* Sits outside the flip wrapper so a flipped photo doesn't mirror it */}
        <LoadingOrb active={isLoading && near} className="absolute inset-0" />

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="absolute top-2 right-2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 focus-visible:opacity-100"
          aria-label="Flip image horizontally"
        >
          <FlipIcon />
        </button>

        {exif && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white tabular-nums shadow-lg backdrop-blur-xs">
              {exif}
            </div>
          </div>
        )}
      </div>

      {descriptionText && (
        <div className="mt-4 px-1">
          <ScrollReveal
            size="md"
            variant="muted"
            enableBlur={true}
            baseOpacity={0.15}
            blurStrength={3}
            staggerDelay={0.03}
            threshold={0.3}
            duration={0.6}
            textClassName="font-light"
          >
            {descriptionText}
          </ScrollReveal>
        </div>
      )}
    </div>
  );
}

interface SingleColumnGalleryProps {
  photos: Photo[];
  className?: string;
}

function SingleColumnGallery({
  photos,
  className = ''
}: SingleColumnGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // iOS: release photos that are far off screen (see ios-image-cleanup.ts)
  useEffect(() => {
    return setupImageCleanup(containerRef.current, {
      rootMargin: '150% 0px' // keep photos within 1.5 viewport heights
    });
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`flex w-full flex-col items-center gap-8 ${className}`}
    >
      {photos.map((photo, index) => (
        <GalleryItem
          key={photo.url || index}
          photo={photo}
          priority={index < PRIORITY_COUNT}
        />
      ))}
    </div>
  );
}

export default SingleColumnGallery;
