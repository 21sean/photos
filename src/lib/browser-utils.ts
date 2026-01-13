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

/**
 * Detect if the current browser is Chrome (excluding Edge)
 * Used to enable Chrome-specific features like the background switcher
 */
export function isChrome(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const userAgent = navigator.userAgent;
  // Check for Chrome but exclude Edge (which also contains "Chrome" in UA)
  return /Chrome/.test(userAgent) && !/Edg/.test(userAgent);
}
