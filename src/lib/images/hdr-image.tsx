'use client';

import { useCallback, useState } from 'react';
import { Photo } from '@/types';
import { isLikelyHDR } from '../hdr-utils';
import { gallerySizes } from './sizes';

interface HDRImageProps {
  photo: Photo;
  className?: string;
  alt?: string;
  /** Fetch now and at high priority (photos at the top of a gallery). */
  priority?: boolean;
  /** Called once the photo has loaded, or failed to. */
  onSettled?: () => void;
}

/**
 * A gallery photo. It deliberately does nothing to the pixels: HDR and
 * wide-gamut AVIFs are left to the browser's own tone mapping, and CSS
 * filters on top of that are what blow photos out.
 *
 * The markup is complete on the server, so the browser's preload scanner
 * finds the photo before any script runs. When the manifest lists smaller
 * variants they are offered through `srcset`.
 */
function HDRImage({
  photo,
  className = '',
  alt,
  priority = false,
  onSettled
}: HDRImageProps) {
  const [settled, setSettled] = useState(false);

  const settle = useCallback(() => {
    setSettled(true);
    onSettled?.();
  }, [onSettled]);

  // A server-rendered photo can finish loading before React attaches
  // `onLoad`, in which case that event never reaches us: check on mount
  const checkComplete = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth > 0) settle();
    },
    [settle]
  );

  const isHDR = photo.isHDR || isLikelyHDR(photo.url);

  return (
    <img
      ref={checkComplete}
      src={photo.url}
      srcSet={photo.srcSet}
      sizes={photo.srcSet ? gallerySizes(photo) : undefined}
      width={photo.width}
      height={photo.height}
      alt={alt ?? photo.title ?? ''}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={settle}
      onError={settle}
      data-settled={settled}
      data-color-space={photo.colorSpace}
      className={`hdr-image ${isHDR ? 'hdr-enhanced' : ''} ${className}`}
    />
  );
}

export default HDRImage;
