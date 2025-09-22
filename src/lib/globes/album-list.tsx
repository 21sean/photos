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

  const handleAlbumTitleClick = (album: Album, event?: React.MouseEvent | React.TouchEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setAnimatingTitle(album.title);
    window.setTimeout(() => setAnimatingTitle(null), 900);
    setIsSliding(true);
    onEnter(album);
  };

  const resetAlbumListPosition = () => {
    setIsSliding(false);
  };

  return (
    <>
      {/* Mobile-only header at the top */}
      <h1 
        className="md:hidden font-bold text-3xl text-center mb-8 absolute top-4 left-0 right-0 cursor-pointer"
        onClick={resetAlbumListPosition}
        onDoubleClick={onHideCard}
      >
        sean.photo
      </h1>

      <h1 
        className="hidden md:block font-bold mb-6 sm:mb-12 text-center md:text-left cursor-pointer"
        onDoubleClick={onHideCard}
      >
        sean.photo
      </h1>

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
              className={`album-title-split ${animatingTitle === album.title ? 'album-title-split-animating' : ''} ${activeAlbumTitle === album.title ? 'album-title-active' : ''} cursor-pointer hover:text-gray-500 touch-manipulation select-none`}
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
              <span className="album-title-split-top" data-text={album.title} aria-hidden="true" />
              <span className="album-title-split-bottom" data-text={album.title} aria-hidden="true" />
              <span className="album-title-text">{album.title}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const AlbumList = React.memo(AlbumListComponent);
export default AlbumList;


