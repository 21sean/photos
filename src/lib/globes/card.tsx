import { Album } from '@/types';
import React from 'react';

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function AlbumCard({ 
  album, 
  onMobileClick 
}: { 
  album: Album;
  onMobileClick?: () => void;
}) {
  const randomLeft = randomInRange(10, 80);
  const randomTop = randomInRange(10, 50);

  let tags = [album.description];
  for (const location of album.locations) {
    tags.push(location.description || '');
  }
  tags = tags.filter(Boolean) as string[];

  return (
    <aside
      className={`p-4
        absolute z-50
        rounded-lg bg-black-100 w-60 text-2xl opacity-100 flex flex-col
        border border-gray-200
        overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors duration-200
        touch-manipulation`} /* Add touch-manipulation for better mobile interaction */
      style={{
        left: `calc(33% + ${randomLeft}px)`,
        top: `calc(33% + ${randomTop}px)`,
        minHeight: '138px' /* Ensure minimum height to prevent clipping */
      }}
      onClick={onMobileClick}
    >
      <span className="blink rounded-lg flex-shrink-0 text-lg md:text-2xl">{album.title}</span>
      <span className="text-sm md:text-base flex-shrink-0">{album.date}</span>
      <div className="marquee py-4 text-sm md:text-base flex-grow overflow-hidden">
        <div className="marquee-content">
          {tags.map(tag => (
            <span key={`${tag}-1`}>{tag}</span>
          ))}
        </div>
        <div className="marquee-content" aria-hidden={true}>
          {tags.map(tag => (
            <span key={`${tag}-2`}>{tag}</span>
          ))}
        </div>
      </div>

      <span className="flex-shrink-0 text-sm md:text-base">&rarr;Click to enter&rarr;</span>
    </aside>
  );
}
