'use client';

import dynamic from 'next/dynamic';
import Nav from '@/lib/nav';
import { GlobeIcon } from '@/lib/icons';
import { useState, useCallback } from 'react';
import { Album, AlbumList } from '@/types/albums';
import { Photo } from '@/types';
import { titleToSlug } from '@/lib/api/slug';

const Masonry = dynamic(() => import('@/lib/images/masonry'), {
  ssr: false
});

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
  const sortedAlbums = [...albums].sort((a, b) => a.title.localeCompare(b.title));

  // Throttled toggle to prevent rapid clicks causing performance issues
  const handleToggle = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsCollapsed(!isCollapsed);
    // Reset animation lock after animation completes
    setTimeout(() => setIsAnimating(false), 500);
  }, [isCollapsed, isAnimating]);

  return (
    <section className="album-page flex flex-col sm:flex-row sm:my-4" id="top">
      <div className="pt-3 sm:pt-6 sm:pl-10 sm:pr-20 lg:pl-20 lg:pr-40 space-y-1">
        <Nav albums={albums} title={album.title} isCollapsed={isCollapsed} />
      </div>

      <div className="flex flex-col items-start">
        <div
          className={`rounded-lg bg-gray-100
            mx-auto sm:m-0
            px-5 py-4
            min-w-[calc(100%-16px)] max-w-[600px] sm:min-w-[400px]`}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="font-normal text-2xl text-gray-600 min-w-32">
                {album.title}
              </h1>
              <div className="text-gray-500 text-sm mt-1">
                {album.date}
              </div>
            </div>
            <a 
              href="/"
              className="flex items-center gap-1.5 text-gray-600 hover:text-red-600 transition-colors duration-200 font-normal text-lg leading-none tracking-tight"
            >
              <GlobeIcon />
              <span>Home</span>
            </a>
          </div>
          
          {/* Mobile destinations toggle */}
          <button
            onClick={handleToggle}
            className="sm:hidden mt-4 text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-2 transition-colors duration-200"
            disabled={isAnimating}
          >
            <span className={`transform transition-transform duration-300 ${
              isCollapsed ? 'rotate-0' : 'rotate-90'
            }`}>
              →
            </span>
            {isCollapsed ? 'More destinations' : 'Less destinations'}
          </button>
          
          {/* Mobile destinations list inside the white box */}
          <div className={`sm:hidden overflow-hidden will-change-transform transition-all duration-500 ease-in-out ${
            isCollapsed 
              ? 'max-h-0 opacity-0 transform translate3d(0, -10px, 0)' 
              : 'max-h-96 opacity-100 transform translate3d(0, 0, 0)'
          }`}>
            <ul className="mt-2 pt-4 pb-6 border-t border-gray-300 space-y-2">
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
                          ? 'font-bold text-gray-800' 
                          : 'text-gray-600 hover:text-gray-800'
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

  <Masonry className="mt-4 mb-6" items={photos} maxColumnCount={1} />
      </div>
    </section>
  );
}