'use client';

import * as React from 'react';
import { Masonry as MasonicMasonry } from 'masonic';
import { type RenderComponentProps } from 'masonic';
import { useLightbox } from '../../hooks/use-lightbox';
import { Photo } from '@/types';
import HDRImage from './hdr-image';
import { isIOSSafari } from '../browser-utils';
import { FlipIcon } from '../icons';

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

      {!!photo.aiDescriptionHtml && (
        <div className="mt-2 px-1">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-x-1 -inset-y-1 rounded-md bg-gradient-to-b from-black/0 via-black/0 to-black/5" />
            <div
              className="relative text-[12px] leading-snug text-zinc-200"
              dangerouslySetInnerHTML={{ __html: photo.aiDescriptionHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function currentColumnWidth(maxColumnCount: number) {
  // For single-column layouts, fit nicely on screen without being too wide
  if (maxColumnCount === 1) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    return Math.min(vw - 32, 760);
  }

  if (window.innerWidth > 2000) {
    // 3xl
    return 425;
  } else if (window.innerWidth > 1536) {
    // 2xl
    return 400;
  } else if (window.innerWidth > 1280) {
    // xl
    return 350;
  } else {
    // mobile-ish
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
  ...props
}: {
  items: Array<Photo>;
  className?: string;
  maxColumnCount?: number;
}) => {
  useLightbox(items);

  // Memoize column width to prevent recalculation on every render during scrolling.
  // Window resize events will trigger component re-mount/re-render through parent,
  // so this will update when needed without causing performance issues during scrolling.
  const columnWidth = React.useMemo(() => currentColumnWidth(maxColumnCount), [maxColumnCount]);
  const averageHeight = useAverageHeight(items, columnWidth);

  // Detect iOS Safari for specific optimizations
  const isIOS = isIOSSafari();
  
  // Increase overscan on iOS to keep more images rendered off-screen
  const overscanValue = isIOS ? 12 : 5;

  if (items.length === 0) {
    return null;
  }

  const containerClass = maxColumnCount === 1
    ? 'w-full max-w-[820px] mx-auto px-3 sm:px-4 fade-in-delayed'
    : `h-auto w-full
      md:w-[500px] lg:w-[720px] xl:w-[1000px] 2xl:w-[1200px] 3xl:w-[1250px]
      px-2 sm:p-0
      fade-in-delayed`;

  return (
    <section
      id="gallery"
      className={containerClass}
      style={{
        // iOS-specific optimizations to prevent content reclamation
        contain: isIOS ? 'layout style' : undefined,
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
