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

    // Stable full-screen CSS var for iOS 26 fixed overlays
    function setOuterHeightVar() {
      try {
        const outerH = Math.max(window.outerHeight || 0, window.innerHeight || 0);
        document.documentElement.style.setProperty('--outer-h', outerH + 'px');
      } catch {}
    }
    setOuterHeightVar();
    window.addEventListener('orientationchange', setOuterHeightVar, { passive: true } as any);
    window.addEventListener('pageshow', setOuterHeightVar, { passive: true } as any);
    // Visual viewport changes can also affect layout; update var then too
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setOuterHeightVar);
    }
    return () => {
      window.removeEventListener('orientationchange', setOuterHeightVar as any);
      window.removeEventListener('pageshow', setOuterHeightVar as any);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setOuterHeightVar as any);
      }
    };
  }, []);
}

export default useHDRSetup;