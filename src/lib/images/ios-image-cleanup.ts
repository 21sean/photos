/**
 * iOS Safari Image Memory Cleanup Utility
 * 
 * iOS Safari aggressively manages memory and has a ~500MB per tab limit.
 * When images scroll far out of view, we release their memory by replacing
 * the src with a tiny placeholder. When they scroll back, we restore them.
 * 
 * This prevents the "disappearing content" and lag issues on iOS.
 */

import { isIOSSafari } from '../browser-utils';

// Tiny transparent 1x1 GIF - only 43 bytes
export const EMPTY_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Data attribute to store original src
const ORIGINAL_SRC_ATTR = 'data-original-src';

// Track if cleanup is enabled (only on iOS Safari)
let cleanupEnabled: boolean | null = null;

/**
 * Check if image cleanup should be enabled
 */
export function isCleanupEnabled(): boolean {
  if (cleanupEnabled === null) {
    cleanupEnabled = isIOSSafari();
  }
  return cleanupEnabled;
}

/**
 * Setup IntersectionObserver for image memory cleanup
 * Returns cleanup function to disconnect observer
 */
export function setupImageCleanup(
  container: HTMLElement | null,
  options?: {
    rootMargin?: string;  // How far outside viewport to keep images loaded
  }
): () => void {
  if (!container || !isCleanupEnabled()) {
    return () => {}; // No-op on non-iOS
  }

  // Keep images loaded within 2 viewport heights (reduced from default)
  const rootMargin = options?.rootMargin ?? '200% 0px';

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target as HTMLImageElement;
        
        if (entry.isIntersecting) {
          // Image entering viewport area - restore original src
          restoreImage(img);
        } else {
          // Image leaving viewport area - release memory
          releaseImage(img);
        }
      });
    },
    {
      root: null, // viewport
      rootMargin,
      threshold: 0,
    }
  );

  // Observe all images in container
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    // Store original src before observing
    if (img.src && !img.src.startsWith('data:')) {
      img.setAttribute(ORIGINAL_SRC_ATTR, img.src);
    }
    observer.observe(img);
  });

  // Return cleanup function
  return () => {
    observer.disconnect();
    // Restore all images when unmounting
    images.forEach((img) => restoreImage(img as HTMLImageElement));
  };
}

/**
 * Release image memory by replacing src with placeholder
 */
function releaseImage(img: HTMLImageElement): void {
  // Don't release if already released or no original stored
  if (img.src === EMPTY_GIF) return;
  
  // Store original src if not already stored
  if (!img.hasAttribute(ORIGINAL_SRC_ATTR) && img.src && !img.src.startsWith('data:')) {
    img.setAttribute(ORIGINAL_SRC_ATTR, img.src);
  }
  
  // Replace with empty placeholder to release decoded image memory
  img.src = EMPTY_GIF;
}

/**
 * Restore image from placeholder
 */
function restoreImage(img: HTMLImageElement): void {
  const originalSrc = img.getAttribute(ORIGINAL_SRC_ATTR);
  
  if (originalSrc && img.src === EMPTY_GIF) {
    img.src = originalSrc;
  }
}

/**
 * Hook for React components to setup image cleanup
 */
export function useIOSImageCleanup(
  containerRef: React.RefObject<HTMLElement>,
  deps: React.DependencyList = []
): void {
  if (typeof window === 'undefined') return;
  
  // This will be called from useEffect in the component
  // We can't use React hooks here, so this is just the setup function
}

/**
 * Observe a single image for cleanup (for dynamically created images)
 */
export function observeImageForCleanup(
  img: HTMLImageElement,
  observer: IntersectionObserver
): void {
  if (!isCleanupEnabled()) return;
  
  // Store original src
  if (img.src && !img.src.startsWith('data:')) {
    img.setAttribute(ORIGINAL_SRC_ATTR, img.src);
  }
  
  observer.observe(img);
}

/**
 * Create a shared observer for a gallery
 * Use this when dynamically adding images
 */
export function createImageCleanupObserver(
  rootMargin = '200% 0px'
): IntersectionObserver | null {
  if (!isCleanupEnabled()) return null;

  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target as HTMLImageElement;
        
        if (entry.isIntersecting) {
          restoreImage(img);
        } else {
          releaseImage(img);
        }
      });
    },
    {
      root: null,
      rootMargin,
      threshold: 0,
    }
  );
}
