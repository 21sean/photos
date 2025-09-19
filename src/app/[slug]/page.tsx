'use client';

import { getAlbums, getAlbum } from '@/lib/api';
import { titleToSlug, slugToAlbumTitle } from '@/lib/api/slug';

export async function generateStaticParams() {
  const albums = await getAlbums();
  return albums.map(album => ({
    slug: titleToSlug(album.title)
  }));
}

import dynamic from 'next/dynamic';
import Nav from '@/lib/nav';
import { GlobeIcon } from '@/lib/icons/globe-icon';
import { useState, useEffect } from 'react';
import { Album, AlbumList } from '@/types/albums';
import { Photo } from '@/types';

const Masonry = dynamic(() => import('@/lib/images/masonry'), {
  ssr: false
});

function AlbumPage({ params: { slug } }: { params: { slug: string } }) {
  const [albums, setAlbums] = useState<AlbumList>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Guard against non-album routes like favicon.ico
  if (slug.includes('.') || slug.startsWith('_')) {
    throw new Error('Not found');
  }
  
  const title = slugToAlbumTitle(slug);

  useEffect(() => {
    async function loadData() {
      const albumsData = await getAlbums();
      const { album: albumData, photos: photosData } = await getAlbum(slug);
      setAlbums(albumsData);
      setAlbum(albumData);
      setPhotos(photosData);
    }
    loadData();
  }, [slug]);

  if (!album) {
    return <div>Loading...</div>;
  }

  return (
    <section className="flex flex-col sm:flex-row sm:my-20" id="top">
      <div className="pt-10 sm:pl-10 sm:pr-20 lg:pl-20 lg:pr-40 space-y-1">
        <Nav albums={albums} title={title} isCollapsed={isCollapsed} />
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
                {title}
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
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="sm:hidden mt-4 text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-2 transition-colors duration-200"
          >
            <span className={`transform transition-transform duration-300 ${
              isCollapsed ? 'rotate-0' : 'rotate-90'
            }`}>
              →
            </span>
            {isCollapsed ? 'More destinations' : 'Less destinations'}
          </button>
          
          {/* Mobile destinations list inside the white box */}
          <div className={`sm:hidden overflow-hidden transition-all duration-500 ease-in-out ${
            isCollapsed 
              ? 'max-h-0 opacity-0 translate-y-[-10px]' 
              : 'max-h-96 opacity-100 translate-y-0'
          }`}>
            <ul className="mt-2 pt-4 pb-6 border-t border-gray-300 space-y-2">
              {albums.map((albumItem, index) => {
                const isActive = title.toLowerCase() === albumItem.title.toLowerCase();
                return (
                  <li 
                    key={albumItem.title} 
                    className={`transition-all duration-300 ease-out ${
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

        <Masonry className="my-12" items={photos} />

        <a
          href="#top"
          className={`pt-6 max-sm:px-2 max-sm:pb-6
            max-sm:text-center max-sm:w-full
            text-gray-400 hover:text-gray-600
            fade-in-delayed`}
        >
          Go to top ↑
        </a>
      </div>
    </section>
  );
}

export default AlbumPage;
