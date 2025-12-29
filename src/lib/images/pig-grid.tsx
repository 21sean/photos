'use client';

import { useLightbox } from '@/hooks/use-lightbox';
import { useWindowSize } from '@/hooks/use-window-size';
import { Photo } from '@/types';
import { useEffect, useState } from 'react';
import { isLikelyHDR, getHDRImageStyles } from '../hdr-utils';
import { isIOSSafari } from '../browser-utils';
import { FlipIcon } from '../icons';

// Format EXIF metadata for display
function formatExifData(item: Photo): string | null {
  const parts: string[] = [];
  
  if (item.focalLength) {
    // Remove " mm" suffix if present for cleaner display
    const focal = item.focalLength.replace(' mm', 'mm');
    parts.push(focal);
  }
  if (item.aperture) {
    parts.push(`ƒ/${item.aperture}`);
  }
  if (item.shutterSpeed) {
    parts.push(`${item.shutterSpeed}s`);
  }
  if (item.iso) {
    parts.push(`ISO ${item.iso}`);
  }
  
  return parts.length > 0 ? parts.join('  •  ') : null;
}

function MobileImageWithLoading({ item }: { item: Photo }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);

  // Detect iOS Safari for specific optimizations
  const isIOS = isIOSSafari();
  
  const exifData = formatExifData(item);

  return (
    <div className="relative group">
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
          // Disable lazy loading on iOS Safari to prevent aggressive unloading
          loading={isIOS ? 'eager' : 'lazy'}
          style={{
            // iOS-specific optimizations to prevent image unloading
            contain: isIOS ? 'layout style' : undefined,
            WebkitTransform: isIOS ? 'translateZ(0)' : undefined,
            transform: isFlipped ? 'scaleX(-1)' : (isIOS ? 'translateZ(0)' : undefined),
            transition: 'transform 0.3s ease',
          }}
          onLoad={() => {
            // Ensure loading animation is visible for at least 500ms
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
          }}
        />
        {/* EXIF overlay on hover */}
        {exifData && !isLoading && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-mono tracking-wide">
              {exifData}
            </div>
          </div>
        )}
      </a>
      
      {/* Flip button */}
      {!isLoading && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFlipped(!isFlipped);
          }}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm z-10"
          aria-label="Flip image horizontally"
        >
          <FlipIcon />
        </button>
      )}
      
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
      
      // Create a wrapper div for positioning the overlay
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.width = '100%';
      wrapper.style.height = 'auto';
      wrapper.style.display = 'block';
      wrapper.style.overflow = 'hidden';
      
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('data-pswp-width', item.width.toString());
      anchor.setAttribute('data-pswp-height', item.height.toString());
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.style.display = 'block';
      anchor.style.width = '100%';
      anchor.style.height = '100%';
      anchor.style.position = 'relative';
      
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.title || '';
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = 'auto';
      
      // Detect iOS Safari for specific optimizations
      const isIOS = isIOSSafari();
      
      // Set loading attribute based on iOS detection
      img.loading = isIOS ? 'eager' : 'lazy';
      
      // Apply iOS optimizations
      if (isIOS) {
        img.style.contain = 'layout style';
        img.style.webkitTransform = 'translateZ(0)';
        img.style.transform = 'translateZ(0)';
      }
      
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
      wrapper.appendChild(anchor);
      
      // Create flip button
      const flipButton = document.createElement('button');
      flipButton.setAttribute('aria-label', 'Flip image horizontally');
      flipButton.className = 'pig-flip-button';
      flipButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        border-radius: 9999px;
        padding: 8px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease, background 0.2s ease;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 10;
      `;
      
      // Create flip icon SVG
      flipButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; display: block;">
          <path d="M21 8v13H3" />
          <path d="M3 3h.01" />
          <path d="M7 3h.01" />
          <path d="M11 3h.01" />
          <path d="M15 3h.01" />
          <path d="M19 3h.01" />
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <line x1="12" y1="7" x2="12" y2="21" />
        </svg>
      `;
      
      // Add flip state tracking
      let isFlipped = false;
      img.style.transition = 'transform 0.3s ease';
      
      // Add flip button click handler
      flipButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isFlipped = !isFlipped;
        img.style.transform = isFlipped ? 'scaleX(-1)' : (isIOS ? 'translateZ(0)' : 'scaleX(1)');
        if (isIOS && isFlipped) {
          img.style.transform = 'translateZ(0) scaleX(-1)';
        }
      });
      
      // Add hover effect to button
      flipButton.addEventListener('mouseenter', () => {
        flipButton.style.background = 'rgba(0, 0, 0, 0.7)';
      });
      flipButton.addEventListener('mouseleave', () => {
        flipButton.style.background = 'rgba(0, 0, 0, 0.5)';
      });
      
      wrapper.appendChild(flipButton);
      
      // Create EXIF overlay if metadata exists
      const exifData = formatExifData(item);
      if (exifData) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: absolute;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0 12px 12px 12px;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        `;
        
        const badge = document.createElement('div');
        badge.style.cssText = `
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          color: white;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 9999px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          letter-spacing: 0.025em;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.08);
        `;
        badge.textContent = exifData;
        
        overlay.appendChild(badge);
        wrapper.appendChild(overlay);
        
        // Add hover events for overlay and flip button
        wrapper.addEventListener('mouseenter', () => {
          overlay.style.opacity = '1';
          flipButton.style.opacity = '1';
        });
        wrapper.addEventListener('mouseleave', () => {
          overlay.style.opacity = '0';
          flipButton.style.opacity = '0';
        });
      } else {
        // If no EXIF, still show flip button on hover
        wrapper.addEventListener('mouseenter', () => {
          flipButton.style.opacity = '1';
        });
        wrapper.addEventListener('mouseleave', () => {
          flipButton.style.opacity = '0';
        });
      }
      
      return wrapper;
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
