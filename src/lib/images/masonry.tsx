'use client';

import * as React from 'react';
import { Masonry as MasonicMasonry } from 'masonic';
import { type RenderComponentProps } from 'masonic';
import { useLightbox } from '../../hooks/use-lightbox';
import { Photo } from '@/types';
import HDRImage from './hdr-image';
import { isIOSSafari } from '../browser-utils';
import { FlipIcon } from '../icons';
import ScrollReveal from '../fx/scroll-reveal';
import { setupImageCleanup } from './ios-image-cleanup';

// Format EXIF data for overlay
function formatExifData(photo: Photo): string | null {
  const parts: string[] = [];

  if (photo.focalLength) {
    parts.push(photo.focalLength.replace(' mm', 'mm'));
  }
  if (photo.aperture) {
    parts.push(`ƒ/${photo.aperture}`);
  }
  if (photo.shutterSpeed) {
    parts.push(`${photo.shutterSpeed}s`);
  }
  if (photo.iso) {
    parts.push(`ISO ${photo.iso}`);
  }

  return parts.length ? parts.join('  •  ') : null;
}

// Extract plain text from HTML string
function stripHtml(html: string): string {
  // Simple HTML tag removal for SSR compatibility
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// Get description text from photo
function getDescriptionText(photo: Photo): string | null {
  if (photo.aiDescription) return photo.aiDescription;
  if (photo.aiDescriptionHtml) return stripHtml(photo.aiDescriptionHtml);
  return null;
}

const MasonryItem = ({
  width: itemWidth,
  data: photo
}: RenderComponentProps<Photo>) => {
  const [isFlipped, setIsFlipped] = React.useState(false);
  
  // Calculate proper scaled dimensions for the masonry item
  const aspectRatio = photo.width / photo.height;
  const scaledHeight = itemWidth / aspectRatio;
  const exif = formatExifData(photo);
  
  return (
    <div className="group masonry-item select-none">
      <div className="relative">
        <div 
          style={{ 
            transform: isFlipped ? 'scaleX(-1)' : 'scaleX(1)',
            transition: 'transform 0.3s ease'
          }}
        >
          <HDRImage
            photo={photo}
            width={itemWidth}
            height={scaledHeight}
            className="masonry-item w-full h-auto block"
          />
        </div>

        {/* Flip button */}
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

      {(() => {
        const descriptionText = getDescriptionText(photo);
        return descriptionText ? (
          <div className="mt-4 px-1">
            <div className="relative">
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
          </div>
        ) : null;
      })()}
    </div>
  );
};

function calculateColumnWidthForViewport(maxColumnCount: number, firstPhoto?: Photo) {
  // For single-column layouts, calculate optimal width based on first photo
  if (maxColumnCount === 1) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    if (vw <= 640) {
      return vw - 16; // Nearly full width on mobile
    }
    
    // Account for left nav and padding
    const navWidth = vw > 640 ? 160 : 0;
    const horizontalPadding = 48;
    const availableWidth = vw - navWidth - horizontalPadding;
    
    if (firstPhoto) {
      const aspectRatio = firstPhoto.width / firstPhoto.height;
      const isLandscape = aspectRatio > 1;
      
      if (isLandscape) {
        // Landscape: use more horizontal space
        const maxHeightFromVh = vh * 0.65;
        const widthForMaxHeight = maxHeightFromVh * aspectRatio;
        return Math.min(availableWidth, widthForMaxHeight, 1000);
      } else {
        // Portrait: fit in viewport height
        const headerHeight = 110;
        const bottomMargin = 80;
        const availableHeight = vh - headerHeight - bottomMargin;
        const widthForHeight = availableHeight * aspectRatio;
        return Math.min(availableWidth, widthForHeight, 700);
      }
    }
    
    // Fallback
    return Math.min(availableWidth, 600);
  }

  if (window.innerWidth > 2000) {
    return 425;
  } else if (window.innerWidth > 1536) {
    return 400;
  } else if (window.innerWidth > 1280) {
    return 350;
  } else {
    return 250;
  }
}

function useAverageHeight(items: Array<Photo>, columnWidth: number) {
  const heights = items.map(item => {
    const aspectRatio = item.width / item.height;
    const scaledHeight = columnWidth / aspectRatio;
    return scaledHeight;
  });
  const averageHeight =
    heights.reduce((sum, height) => sum + height, 0) / items.length;
  return Math.floor(averageHeight);
}

export const Masonry = ({
  items = [],
  maxColumnCount = 4,
  style,
  ...props
}: {
  items: Array<Photo>;
  className?: string;
  maxColumnCount?: number;
  style?: React.CSSProperties;
}) => {
  useLightbox(items);
  const containerRef = React.useRef<HTMLElement>(null);

  // Use style width if provided (from parent), otherwise calculate based on viewport
  const firstPhoto = items[0];
  const columnWidth = React.useMemo(() => {
    // If style.width is provided, use it (minus a small padding)
    if (style?.width && typeof style.width === 'number') {
      return style.width;
    }
    return calculateColumnWidthForViewport(maxColumnCount, firstPhoto);
  }, [maxColumnCount, firstPhoto, style?.width]);
  const averageHeight = useAverageHeight(items, columnWidth);

  // Detect iOS Safari for specific optimizations
  const isIOS = isIOSSafari();
  
  // REDUCED overscan on iOS to minimize memory pressure
  // iOS Safari has ~500MB per tab limit; fewer buffered images = less memory
  const overscanValue = isIOS ? 2 : 5;

  // Setup iOS image memory cleanup
  React.useEffect(() => {
    // Delay to ensure masonic has rendered images
    const timeoutId = setTimeout(() => {
      const cleanup = setupImageCleanup(containerRef.current, {
        rootMargin: '150% 0px',
      });
      return cleanup;
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  const containerClass = maxColumnCount === 1
    ? 'w-full px-2 sm:px-0 fade-in-delayed'
    : `h-auto w-full
      md:w-[500px] lg:w-[720px] xl:w-[1000px] 2xl:w-[1200px] 3xl:w-[1250px]
      px-2 sm:p-0
      fade-in-delayed`;

  return (
    <section
      ref={containerRef}
      id="gallery"
      className={containerClass}
      style={{
        // iOS-specific optimizations to prevent content reclamation
        // Use transform for GPU layer instead of contain (which triggers reclamation)
        WebkitTransform: isIOS ? 'translate3d(0, 0, 0)' : undefined,
        transform: isIOS ? 'translate3d(0, 0, 0)' : undefined,
        ...style,
      }}
    >
      <MasonicMasonry
        items={items}
        render={MasonryItem}
        columnGutter={window.innerWidth <= 512 ? 9 : 18}
        columnWidth={columnWidth}
        itemHeightEstimate={averageHeight}
        maxColumnCount={maxColumnCount}
        overscanBy={overscanValue}
        {...props}
      />
    </section>
  );
};

export default Masonry;
