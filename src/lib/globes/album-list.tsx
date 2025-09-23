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

function AlbumListComponent({ albums, activeAlbumTitle, onEnter, onLeave, onHideCard }: Props) {
  const [isSliding, setIsSliding] = React.useState(false);
  const [animatingTitle, setAnimatingTitle] = React.useState<string | null>(null);
  const [typedMap, setTypedMap] = React.useState<Record<string, string>>({});
  const typingTimers = React.useRef<Record<string, number>>({});

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

  return (
    <>
      {/* Mobile-only header at the top */}
      <div className="album-list-wrapper">

      <ul
        className={`flex flex-col 
          items-center
          md:items-start tracking-tight 
          album-list
          ${isSliding ? 'album-list-sliding' : ''}`}
      >
        {albums.map(album => (
          <li
            key={album.title}
            className="max-w-fit"
            onMouseEnter={() => onEnter(album)}
            onMouseLeave={onLeave}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span 
              className={`${activeAlbumTitle === album.title ? 'album-title-active' : ''} cursor-pointer hover:text-gray-500 touch-manipulation select-none ${animatingTitle === album.title ? 'typewriter thick' : ''}`}
              onClick={(e) => handleAlbumTitleClick(album, e)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAlbumTitleClick(album, e);
              }}
              style={{
                minHeight: '44px',
                display: 'inline-block',
                lineHeight: '44px'
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


