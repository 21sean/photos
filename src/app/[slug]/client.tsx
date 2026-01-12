'use client';

import dynamic from 'next/dynamic';
import Nav from '@/lib/nav';
import { GlobeIcon } from '@/lib/icons';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Album, AlbumList } from '@/types/albums';
import { Photo } from '@/types';
import { titleToSlug } from '@/lib/api/slug';
import Stack from '@mui/material/Stack';
import WaveBackground from '@/lib/fx/wave-background';

const SingleColumnGallery = dynamic(() => import('@/lib/images/single-column-gallery'), {
  ssr: false
});

// Calculate width that fits first image in viewport
function calculateContentWidth(firstPhoto?: Photo): number {
  if (typeof window === 'undefined') return 500;
  
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Account for left nav and padding
  const navWidth = vw > 640 ? 160 : 0;
  const horizontalPadding = 32;
  const availableWidth = vw - navWidth - horizontalPadding;
  
  // Header + margin at top, some margin at bottom
  const headerHeight = 110;
  const bottomMargin = 80;
  const availableHeight = vh - headerHeight - bottomMargin;
  
  if (vw <= 640) {
    return vw - 16;
  }
  
  if (firstPhoto) {
    const aspectRatio = firstPhoto.width / firstPhoto.height;
    const widthForHeight = availableHeight * aspectRatio;
    return Math.min(availableWidth, widthForHeight, 700);
  }
  
  // Fallback for portrait
  return Math.min(availableWidth, availableHeight * 0.67, 600);
}

interface AlbumPageClientProps {
  albums: AlbumList;
  album: Album;
  photos: Photo[];
  slug: string;
}

export default function AlbumPageClient({
  albums,
  album,
  photos,
  slug
}: AlbumPageClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const sortedAlbums = [...albums].sort((a, b) => a.title.localeCompare(b.title));

  // Collapse nav when scrolled past one viewport height, expand at bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const distanceFromBottom = documentHeight - (scrollY + viewportHeight);
      
      // Show nav at top (within first viewport) or near bottom (within 200px)
      const isNearTop = scrollY <= viewportHeight;
      const isNearBottom = distanceFromBottom < 200;
      
      setIsNavCollapsed(!isNearTop && !isNearBottom);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Throttled toggle to prevent rapid clicks causing performance issues
  const handleToggle = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsCollapsed(!isCollapsed);
    // Reset animation lock after animation completes
    setTimeout(() => setIsAnimating(false), 500);
  }, [isCollapsed, isAnimating]);

  // Calculate content width based on first photo to ensure alignment
  const contentWidth = useMemo(() => calculateContentWidth(photos[0]), [photos]);

  return (
    <section className="album-page flex flex-col sm:flex-row sm:mt-4 sm:mb-0 w-full" id="top">
      <WaveBackground backdropBlurAmount="md" />
      <div className={`pt-3 sm:pt-6 sm:pl-10 sm:pr-8 lg:pl-16 lg:pr-12 space-y-1 flex-shrink-0 transition-all duration-500 ease-in-out ${
        isNavCollapsed ? 'nav-scroll-collapsed' : ''
      }`}>
        <Nav albums={albums} title={album.title} isCollapsed={isCollapsed} isScrollCollapsed={isNavCollapsed} />
      </div>

      <Stack spacing={2} sx={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <div
          className="rounded-lg bg-gray-900/90 px-5 py-4"
          style={{ width: contentWidth, maxWidth: '100%' }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="font-normal text-2xl text-gray-100 min-w-32">
                {album.title}
              </h1>
              <div className="text-gray-400 text-sm mt-1">
                {album.date}
              </div>

              {!!album.topCities?.length && (
                <div className="mt-2 flex flex-wrap gap-2 -translate-x-[1%]">
                  {album.topCities.slice(0, 3).map((place) => (
                    <span
                      key={place}
                      className="inline-flex items-center rounded-lg border border-gray-600 bg-gray-800 px-3 py-1 text-sm text-gray-300"
                    >
                      {place}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <a 
              href="/"
              className="flex items-center gap-1.5 text-gray-300 hover:text-red-400 transition-colors duration-200 font-normal text-lg leading-none tracking-tight"
            >
              <GlobeIcon />
              <span>Home</span>
            </a>
          </div>
          
          {/* Mobile destinations toggle */}
          <button
            onClick={handleToggle}
            className="sm:hidden mt-4 text-gray-300 hover:text-gray-100 text-sm font-medium flex items-center gap-2 transition-colors duration-200"
            disabled={isAnimating}
          >
            <span className={`transform transition-transform duration-300 ${
              isCollapsed ? 'rotate-0' : 'rotate-90'
            }`}>
              →
            </span>
            {isCollapsed ? 'More destinations' : 'Less destinations'}
          </button>
          
          {/* Mobile destinations list inside the dark box */}
          <div className={`sm:hidden will-change-transform transition-all duration-500 ease-in-out ${
            isCollapsed 
              ? 'max-h-0 opacity-0 overflow-hidden transform translate3d(0, -10px, 0)' 
              : 'max-h-[84vh] opacity-100 overflow-y-auto overscroll-contain transform translate3d(0, 0, 0)'
          }`} style={{ WebkitOverflowScrolling: isCollapsed ? undefined : 'touch' }}>
            <ul className="mt-2 pt-4 pb-6 border-t border-gray-600 space-y-2">
              {sortedAlbums.map((albumItem, index) => {
                const isActive = album.title.toLowerCase() === albumItem.title.toLowerCase();
                return (
                  <li 
                    key={albumItem.title} 
                    className={`will-change-transform transition-all duration-300 ease-out ${
                      !isCollapsed 
                        ? 'animate-fadeInUp opacity-100' 
                        : ''
                    }`}
                    style={{
                      animationDelay: !isCollapsed ? `${index * 50}ms` : '0ms'
                    }}
                  >
                    <a
                      href={`/${titleToSlug(albumItem.title)}`}
                      className={`block text-sm ${
                        isActive 
                          ? 'font-bold text-gray-100' 
                          : 'text-gray-400 hover:text-gray-200'
                      } transition-colors duration-200`}
                    >
                      {albumItem.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <SingleColumnGallery 
          className="pb-8" 
          photos={photos}
        />
      </Stack>
    </section>
  );
}