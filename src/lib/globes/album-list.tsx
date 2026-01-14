'use client';

import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Album, AlbumTitle } from '@/types/albums';

type Props = {
  albums: Array<Album>;
  activeAlbumTitle?: AlbumTitle;
  onEnter: (album: Album) => void;
  onLeave: () => void;
  onSelect?: (album: Album) => void;
  onHideCard: () => void;
};

// Chrome desktop animated menu item - styled like album page Nav
const ChromeMenuItem: React.FC<{
  children: React.ReactNode;
  index: number;
  isActive: boolean;
  album: Album;
  onEnter: (album: Album) => void;
  onLeave: () => void;
  onSelect: (album: Album) => void;
}> = ({ children, index, isActive, album, onEnter, onLeave, onSelect }) => {
  const itemRef = React.useRef<HTMLLIElement>(null);
  const isInView = useInView(itemRef, { once: true, amount: 0.1 });

  return (
    <motion.li
      ref={itemRef}
      className="max-w-fit"
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: isInView ? 1 : 0,
        x: isInView ? 0 : -20,
      }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut",
        delay: index * 0.04
      }}
      whileHover={{ 
        x: 4,
        scale: 1.02,
        transition: { duration: 0.15 }
      }}
    >
      <span 
        className={`block py-0.5 cursor-pointer transition-colors duration-200 select-none ${
          isActive ? 'font-bold' : 'hover:text-gray-400'
        }`}
        onMouseEnter={() => onEnter(album)}
        onMouseLeave={() => onLeave()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(album);
        }}
      >
        {children}
      </span>
    </motion.li>
  );
};

// iOS/non-Chrome implementation (original style)
const BASE_FONT_SIZE_PX = 24;
const BASE_LINE_HEIGHT_PX = 35;
const MIN_SCALE = 0.55;

function AlbumListComponent({ albums, activeAlbumTitle, onEnter, onLeave, onSelect, onHideCard }: Props) {
  const [isDesktopChrome, setIsDesktopChrome] = React.useState(false);
  const [shouldAnimate, setShouldAnimate] = React.useState(false);
  const [isSliding, setIsSliding] = React.useState(false);
  const [animatingTitle, setAnimatingTitle] = React.useState<string | null>(null);
  const [typedMap, setTypedMap] = React.useState<Record<string, string>>({});
  const typingTimers = React.useRef<Record<string, number>>({});

  // Detect Chrome desktop after mount
  React.useEffect(() => {
    const ua = navigator.userAgent;
    const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const isDesktop = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setIsDesktopChrome(isChrome && isDesktop);
    // Trigger fade animation after a small delay to ensure mount is complete
    if (isChrome && isDesktop) {
      requestAnimationFrame(() => setShouldAnimate(true));
    }
  }, []);

  const sortedAlbums = React.useMemo(() => {
    return [...albums].sort((a, b) => a.title.localeCompare(b.title));
  }, [albums]);

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const [fitScale, setFitScale] = React.useState(1);
  const fitScaleRef = React.useRef(1);

  React.useEffect(() => {
    fitScaleRef.current = fitScale;
  }, [fitScale]);

  // Chrome desktop: simple click handler that triggers globe interaction
  const handleChromeSelect = React.useCallback((album: Album) => {
    (onSelect ?? onEnter)(album);
  }, [onSelect, onEnter]);

  // iOS/non-Chrome: original click handler with typewriter animation
  const handleAlbumTitleClick = (album: Album, event?: React.MouseEvent | React.TouchEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // clear any existing timer for this album
    if (typingTimers.current[album.title]) {
      window.clearTimeout(typingTimers.current[album.title]);
      delete typingTimers.current[album.title];
    }

    // start typewriter: progressively reveal the album.title into typedMap
    const full = album.title;
    setTypedMap(prev => ({ ...prev, [full]: '' }));
    setAnimatingTitle(full);

    const stepMs = 130;
    const run = (idx: number) => {
      if (idx > full.length) {
        typingTimers.current[full] = window.setTimeout(() => {
          setAnimatingTitle(null);
        }, 850) as unknown as number;
        return;
      }
      setTypedMap(prev => ({ ...prev, [full]: full.slice(0, idx) }));
      typingTimers.current[full] = window.setTimeout(() => run(idx + 1), stepMs) as unknown as number;
    };
    run(0);

    setIsSliding(true);
    (onSelect ?? onEnter)(album);
  };

  const recomputeFit = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    const list = listRef.current;
    if (!wrapper || !list) return;

    const available = wrapper.clientHeight;
    if (!available || available <= 0) return;

    const currentScale = fitScaleRef.current || 1;
    const content = list.scrollHeight;
    if (!content || content <= 0) return;

    const unscaled = content / currentScale;
    const next = Math.max(MIN_SCALE, Math.min(1, available / unscaled));

    if (Math.abs(next - currentScale) >= 0.01) {
      setFitScale(next);
    }
  }, []);

  React.useLayoutEffect(() => {
    recomputeFit();
  }, [recomputeFit, albums.length]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const list = listRef.current;
    if (!wrapper || !list) return;

    let raf = 0;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => recomputeFit());
    };

    const ro = new ResizeObserver(() => schedule());
    ro.observe(wrapper);
    ro.observe(list);

    window.addEventListener('resize', schedule, { passive: true } as AddEventListenerOptions);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', schedule as any);
    };
  }, [recomputeFit]);

  const fontPx = Math.round(BASE_FONT_SIZE_PX * fitScale);
  const linePx = Math.round(BASE_LINE_HEIGHT_PX * fitScale);

  // Chrome desktop: framer-motion animated list (album page style)
  if (isDesktopChrome) {
    return (
      <motion.div 
        className="album-list-wrapper h-full" 
        ref={wrapperRef}
        animate={{ opacity: shouldAnimate ? 1 : 0 }}
        transition={{ duration: 3.5, ease: "easeOut" }}
        style={{ opacity: 0 }}
      >
        <motion.ul
          ref={listRef as React.RefObject<HTMLUListElement>}
          className="flex flex-col items-start tracking-tight album-list"
          style={{
            ['--album-list-font-size' as any]: `${fontPx}px`,
            ['--album-list-line-height' as any]: `${linePx}px`,
            ['--album-list-min-height' as any]: `${linePx}px`
          }}
        >
          {sortedAlbums.map((album, index) => (
            <ChromeMenuItem
              key={album.title}
              index={index}
              isActive={activeAlbumTitle === album.title}
              album={album}
              onEnter={onEnter}
              onLeave={onLeave}
              onSelect={handleChromeSelect}
            >
              {album.title}
            </ChromeMenuItem>
          ))}
        </motion.ul>
      </motion.div>
    );
  }

  // iOS/non-Chrome: original implementation with typewriter animation
  return (
    <div className="album-list-wrapper h-full" ref={wrapperRef}>
      <ul
        ref={listRef}
        className={`flex flex-col 
          items-center md:items-start
          tracking-tight 
          album-list
          ${isSliding ? 'album-list-sliding' : ''}`}
        style={{
          ['--album-list-font-size' as any]: `${fontPx}px`,
          ['--album-list-line-height' as any]: `${linePx}px`,
          ['--album-list-min-height' as any]: `${linePx}px`
        }}
      >
        {sortedAlbums.map(album => (
          <li
            key={album.title}
            className="max-w-fit"
          >
            <span 
              className={`album-list-item ${activeAlbumTitle === album.title ? 'album-title-active' : ''} cursor-pointer hover:text-gray-500 touch-manipulation select-none ${animatingTitle === album.title ? 'typewriter thick' : ''}`}
              onMouseEnter={() => onEnter(album)}
              onMouseLeave={() => onLeave()}
              onClick={(e) => handleAlbumTitleClick(album, e)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAlbumTitleClick(album, e);
              }}
            >
              <span aria-live="polite" aria-atomic="true">
                {animatingTitle === album.title ? (typedMap[album.title] ?? '') : album.title}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const AlbumList = React.memo(AlbumListComponent);
export default AlbumList;
