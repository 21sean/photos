'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import { Photo } from '@/types';
import HDRImage from './hdr-image';
import { FlipIcon } from '../icons';
import ScrollReveal from '../fx/scroll-reveal';
import { useLightbox } from '../../hooks/use-lightbox';
import { setupImageCleanup } from './ios-image-cleanup';

// Format EXIF data for overlay
function formatExifData(photo: Photo): string | null {
  const parts: string[] = [];
  if (photo.focalLength) parts.push(photo.focalLength.replace(' mm', 'mm'));
  if (photo.aperture) parts.push(`ƒ/${photo.aperture}`);
  if (photo.shutterSpeed) parts.push(`${photo.shutterSpeed}s`);
  if (photo.iso) parts.push(`ISO ${photo.iso}`);
  return parts.length ? parts.join('  •  ') : null;
}

// Extract plain text from HTML
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

// Calculate optimal width for each image based on its aspect ratio
function calculateImageWidth(photo: Photo): number {
  if (typeof window === 'undefined') return 600;
  
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspectRatio = photo.width / photo.height;
  const isLandscape = aspectRatio > 1;
  
  const navWidth = vw > 640 ? 160 : 0;
  const horizontalPadding = 48;
  const availableWidth = vw - navWidth - horizontalPadding;
  
  if (vw <= 640) {
    return vw - 16;
  }
  
  if (isLandscape) {
    // Landscape: wider, but height limited to 65% of viewport
    const maxHeight = vh * 0.65;
    const widthForHeight = maxHeight * aspectRatio;
    return Math.min(availableWidth, widthForHeight, 1100);
  } else {
    // Portrait: fit in viewport height
    const headerHeight = 110;
    const bottomMargin = 80;
    const availableHeight = vh - headerHeight - bottomMargin;
    const widthForHeight = availableHeight * aspectRatio;
    return Math.min(availableWidth, widthForHeight, 700);
  }
}

interface GalleryItemProps {
  photo: Photo;
}

function GalleryItem({ photo }: GalleryItemProps) {
  const [isFlipped, setIsFlipped] = React.useState(false);
  
  const width = React.useMemo(() => calculateImageWidth(photo), [photo]);
  const aspectRatio = photo.width / photo.height;
  const height = width / aspectRatio;
  const exif = formatExifData(photo);
  const descriptionText = getDescriptionText(photo);
  
  return (
    <div className="group select-none" style={{ width }}>
      <div className="relative">
        <div 
          style={{ 
            transform: isFlipped ? 'scaleX(-1)' : 'scaleX(1)',
            transition: 'transform 0.3s ease'
          }}
        >
          <HDRImage
            photo={photo}
            width={width}
            height={height}
            className="w-full h-auto block"
          />
        </div>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
          aria-label="Flip image horizontally"
        >
          <FlipIcon />
        </button>

        {exif && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-black/60 text-white text-[11px] px-3 py-1.5 rounded-full font-mono tracking-wide shadow-lg border border-white/10 backdrop-blur-sm">
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

export function SingleColumnGallery({ photos, className = '' }: SingleColumnGalleryProps) {
  useLightbox(photos);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Setup iOS image memory cleanup
  React.useEffect(() => {
    // Small delay to ensure images are rendered
    const timeoutId = setTimeout(() => {
      const cleanup = setupImageCleanup(containerRef.current, {
        rootMargin: '150% 0px', // Keep images loaded within 1.5 viewport heights
      });
      return cleanup;
    }, 200);
    
    return () => clearTimeout(timeoutId);
  }, [photos]);
  
  if (photos.length === 0) return null;
  
  return (
    <Stack 
      ref={containerRef}
      spacing={4} 
      className={`fade-in-delayed ${className}`}
      sx={{ alignItems: 'center' }}
    >
      {photos.map((photo, index) => (
        <GalleryItem key={photo.url || index} photo={photo} />
      ))}
    </Stack>
  );
}

export default SingleColumnGallery;
