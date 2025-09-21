import { useEffect } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/dist/photoswipe.css';

export interface LightboxData {
  url: string;
  width: number;
  height: number;
}

function selectDataSource(data: Array<LightboxData>) {
  return data.map(item => ({
    url: item.url,
    width: item.width,
    height: item.height
  }));
}

export function useLightbox(data: Array<LightboxData>) {
  // Lightbox is disabled - no longer initializing PhotoSwipe
  useEffect(() => {
    // Lightbox functionality has been disabled for performance
    // Images will now open in new tab instead
    return;
  }, [data]);
}
