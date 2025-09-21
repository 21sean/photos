'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Photo } from '@/types';
import { detectHDRCapabilities, getHDRImageStyles, isLikelyHDR } from '../hdr-utils';

interface HDRImageProps {
  photo: Photo;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function HDRImage({ 
  photo, 
  width, 
  height, 
  className = '', 
  alt = '',
  priority = false 
}: HDRImageProps) {
  const [hdrCapabilities, setHdrCapabilities] = useState({
    supportsHDR: false,
    supportsP3: false,
    supportsRec2020: false
  });
  
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Detect HDR capabilities on client side - cached for performance
    const capabilities = detectHDRCapabilities();
    setHdrCapabilities(capabilities);
  }, []);

  // Determine if this image should be treated as HDR
  const isHDR = photo.isHDR || isLikelyHDR(photo.url);
  
  // Get HDR-aware styles - memoized for performance
  const hdrStyles = useMemo(() => 
    getHDRImageStyles(isHDR, photo.colorSpace), 
    [isHDR, photo.colorSpace]
  );
  
  // Enhanced loading with HDR considerations
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Determine optimal image attributes
  const imageProps: React.ImgHTMLAttributes<HTMLImageElement> = {
    src: photo.url,
    width: width || photo.width,
    height: height || photo.height,
    alt: alt || photo.title || '',
    loading: (priority ? 'eager' : 'lazy') as 'eager' | 'lazy',
    decoding: 'async',
    onLoad: handleImageLoad,
    style: {
      ...hdrStyles,
      opacity: imageLoaded ? 1 : 0.8,
      transition: 'opacity 0.3s ease, filter 0.3s ease',
    },
    className: `hdr-image ${isHDR ? 'hdr-enhanced' : ''} ${className}`,
  };

  // Add HDR-specific data attributes
  if (isHDR && hdrCapabilities.supportsP3 && photo.colorSpace) {
    (imageProps as any)['data-color-space'] = photo.colorSpace;
  }
  
  if (isHDR && photo.hdrMetadata) {
    if (photo.hdrMetadata.maxLuminance) {
      (imageProps as any)['data-max-luminance'] = photo.hdrMetadata.maxLuminance;
    }
    if (photo.hdrMetadata.minLuminance) {
      (imageProps as any)['data-min-luminance'] = photo.hdrMetadata.minLuminance;
    }
  }

  return (
    <picture>
      {/* Provide fallbacks for different formats */}
      {isHDR && hdrCapabilities.supportsHDR && (
        <>
          {/* AVIF HDR support for modern browsers */}
          <source 
            srcSet={photo.url.replace(/\.(jpg|jpeg|png)$/i, '.avif')} 
            type="image/avif"
            media="(dynamic-range: high)"
          />
          {/* HEIF HDR support for Safari */}
          <source 
            srcSet={photo.url.replace(/\.(jpg|jpeg|png)$/i, '.heic')} 
            type="image/heic"
            media="(dynamic-range: high)"
          />
        </>
      )}
      
      <img {...imageProps} />
    </picture>
  );
}

export default HDRImage;