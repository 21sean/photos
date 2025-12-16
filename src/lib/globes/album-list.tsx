'use client';

import React from 'react';
import { Album, AlbumTitle } from '@/types/albums';

type Props = {
  albums: Array<Album>;
  activeAlbumTitle?: AlbumTitle;
  onEnter: (album: Album) => void;
  onLeave: () => void;
  onHideCard: () => void;
};

const BASE_FONT_SIZE_PX = 30; // matches Tailwind text-3xl (1.875rem)
const BASE_LINE_HEIGHT_PX = 44;
const MIN_SCALE = 0.55;

function AlbumListComponent({ albums, activeAlbumTitle, onEnter, onLeave, onHideCard }: Props) {
  const [isSliding, setIsSliding] = React.useState(false);
  const [animatingTitle, setAnimatingTitle] = React.useState<string | null>(null);
  const [typedMap, setTypedMap] = React.useState<Record<string, string>>({});
  const typingTimers = React.useRef<Record<string, number>>({});

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
        // done, keep caret visible briefly
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
    onEnter(album);
  };

  const resetAlbumListPosition = () => {
    setIsSliding(false);
  };

  const recomputeFit = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    const list = listRef.current;
    if (!wrapper || !list) return;

    // Wrapper is inside the flex "content-container"; its height reflects available space.
    const available = wrapper.clientHeight;
    if (!available || available <= 0) return;

    const currentScale = fitScaleRef.current || 1;
    const content = list.scrollHeight;
    if (!content || content <= 0) return;

    // Estimate unscaled content height so we can scale back up when space increases.
    const unscaled = content / currentScale;
    const next = Math.max(MIN_SCALE, Math.min(1, available / unscaled));

    // Avoid re-render loops from tiny float jitter.
    if (Math.abs(next - currentScale) >= 0.01) {
      setFitScale(next);
    }
  }, []);

  React.useLayoutEffect(() => {
    // Initial + whenever album count changes (new destinations)
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

  return (
    <>
      {/* Mobile-only header at the top */}
      <div className="album-list-wrapper h-full" ref={wrapperRef}>

      <ul
        ref={listRef}
        className={`flex flex-col 
          items-center
          md:items-start tracking-tight 
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
              onMouseLeave={onLeave}
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
    </>
  );
}

const AlbumList = React.memo(AlbumListComponent);
export default AlbumList;


