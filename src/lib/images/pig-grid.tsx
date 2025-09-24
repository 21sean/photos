'use client';

import { useLightbox } from '@/hooks/use-lightbox';
import { useWindowSize } from '@/hooks/use-window-size';
import { Photo } from '@/types';
import { useEffect, useState } from 'react';
import { isLikelyHDR, getHDRImageStyles } from '../hdr-utils';

function MobileImageWithLoading({ item }: { item: Photo }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative">
      <a
        data-pwsp-width={item.width}
        data-pwsp-height={item.height}
        target="_blank"
        rel="noreferrer"
        href={item.url}
      >
        <img 
          src={item.url} 
          alt={item.title || ""} 
          className={`w-full h-auto transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => {
            // Ensure loading animation is visible for at least 500ms
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
          }}
        />
      </a>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50 min-h-[200px]">
          <div className="loader"></div>
        </div>
      )}
    </div>
  );
}

function PigGrid({ items }: { items: Array<Photo> }) {
  useLightbox(items);

  const { width } = useWindowSize();
  const isMobile = width && width <= 640;

  const options = {
    containerId: 'pig',
    classPrefix: 'pig',
    spaceBetweenImages: 12,
    transitionSpeed: 500,
    primaryImageBufferHeight: 1000,
    secondaryImageBufferHeight: 300,
    urlForSize: function (filename: string, size: number) {
      return filename;
    },
    createElement: function (url: string) {
      // PhotoSwipe elements
      const item = items.find(item => item.url == url) as Photo;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('data-pswp-width', item.width.toString());
      anchor.setAttribute('data-pswp-height', item.height.toString());
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.title || '';
      
      // Apply HDR styles if image is HDR
      const isHDR = item.isHDR || isLikelyHDR(item.url);
      if (isHDR) {
        const hdrStyles = getHDRImageStyles(isHDR, item.colorSpace);
        Object.assign(img.style, hdrStyles);
        img.className = 'hdr-image hdr-enhanced';
        
        // Add HDR data attributes
        if (item.colorSpace) {
          img.setAttribute('data-color-space', item.colorSpace);
        }
        if (item.hdrMetadata?.maxLuminance) {
          img.setAttribute('data-max-luminance', item.hdrMetadata.maxLuminance.toString());
        }
      }
      
      anchor.appendChild(img);
      return anchor;
    },
    getMinAspectRatio: function (lastWindowWidth: number) {
      if (lastWindowWidth <= 1920) {
        return 1;
      } else if (lastWindowWidth <= 2560) {
        return 1.5;
      } else {
        return 2;
      }
    },
    getImageSize: function (lastWindowWidth: number) {
      if (lastWindowWidth <= 1920) {
        return 400;
      } else if (lastWindowWidth <= 2560) {
        return 350;
      } else {
        return 300;
      }
    }
  };

  useEffect(() => {
    const data = items.map(item => {
      return { filename: item.url, aspectRatio: item.width / item.height };
    });
    const pigGrid = new window.Pig(data, options);
    pigGrid.enable();

    return () => {
      if (pigGrid) pigGrid.disable();
      const pigElement = document.getElementById('pig');
      if (pigElement) pigElement.innerHTML = '';
    };
  }, [items, width, isMobile]);

  return (
    <section className="w-full" id="gallery">
      <div id="pig" className="mx-auto max-sm:hidden" />

      {isMobile && (
        <div className="flex flex-col gap-1 px-2">
          {items.map(item => (
            <MobileImageWithLoading key={item.url} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export default PigGrid;
