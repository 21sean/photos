// Browser detection utilities

/**
 * Detect if the current browser is iOS Safari
 * Used to apply iOS-specific optimizations for image loading and memory management
 */
export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
    !(window as any).MSStream;
}
