'use client';

import { useEffect } from 'react';
import { addHDRMetaTags, detectHDRCapabilities } from '../lib/hdr-utils';

/**
 * Hook to initialize HDR capabilities and set up the app for HDR support
 */
export function useHDRSetup() {
  useEffect(() => {
    // Add HDR meta tags
    addHDRMetaTags();
    
    // Detect and log HDR capabilities for debugging
    const capabilities = detectHDRCapabilities();
    console.log('HDR Capabilities:', capabilities);
    
    // Add HDR class to document if supported
    if (capabilities.supportsHDR) {
      document.documentElement.classList.add('hdr-supported');
    }
    
    if (capabilities.supportsP3) {
      document.documentElement.classList.add('p3-supported');
    }
    
    if (capabilities.supportsRec2020) {
      document.documentElement.classList.add('rec2020-supported');
    }
  }, []);
}

export default useHDRSetup;