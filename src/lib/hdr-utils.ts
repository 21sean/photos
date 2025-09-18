// HDR image detection and handling utilities

export interface HDRCapabilities {
  supportsHDR: boolean;
  supportsP3: boolean;
  supportsRec2020: boolean;
  maxLuminance?: number;
}

/**
 * Detect HDR capabilities of the current display
 */
export function detectHDRCapabilities(): HDRCapabilities {
  if (typeof window === 'undefined') {
    return {
      supportsHDR: false,
      supportsP3: false,
      supportsRec2020: false
    };
  }

  const capabilities: HDRCapabilities = {
    supportsHDR: false,
    supportsP3: false,
    supportsRec2020: false
  };

  // Check for HDR support via media queries
  if (window.matchMedia) {
    // Check for P3 color gamut support
    capabilities.supportsP3 = window.matchMedia('(color-gamut: p3)').matches;
    
    // Check for Rec2020 color gamut support
    capabilities.supportsRec2020 = window.matchMedia('(color-gamut: rec2020)').matches;
    
    // Check for high dynamic range support
    capabilities.supportsHDR = window.matchMedia('(dynamic-range: high)').matches;
  }

  // Check for canvas HDR support
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
    if (ctx && 'colorSpace' in ctx.getContextAttributes()) {
      capabilities.supportsP3 = true;
    }
  } catch (e) {
    // HDR not supported
  }

  return capabilities;
}

/**
 * Get optimal color space for image based on HDR capabilities
 */
export function getOptimalColorSpace(isHDR: boolean = false, colorSpace?: string): string {
  const capabilities = detectHDRCapabilities();
  
  if (isHDR) {
    if (colorSpace === 'Rec2020' && capabilities.supportsRec2020) {
      return 'rec2020';
    }
    if (colorSpace === 'P3' && capabilities.supportsP3) {
      return 'display-p3';
    }
  }
  
  return 'srgb';
}

/**
 * Check if an image URL appears to be HDR based on file extension or URL patterns
 */
export function isLikelyHDR(url: string): boolean {
  const hdrExtensions = ['.hdr', '.exr', '.heif', '.heic', '.avif'];
  const hdrIndicators = ['hdr', 'p3', 'rec2020', 'dolby', 'vision'];
  
  const urlLower = url.toLowerCase();
  
  // Check file extensions
  if (hdrExtensions.some(ext => urlLower.endsWith(ext))) {
    return true;
  }
  
  // Check URL patterns
  if (hdrIndicators.some(indicator => urlLower.includes(indicator))) {
    return true;
  }
  
  return false;
}

/**
 * Generate HDR-aware CSS for images
 */
export function getHDRImageStyles(isHDR: boolean = false, colorSpace?: string) {
  const optimalColorSpace = getOptimalColorSpace(isHDR, colorSpace);
  
  return {
    colorScheme: isHDR ? 'light dark' : 'light',
    // Enhanced contrast and brightness for HDR displays
    filter: isHDR ? 'contrast(1.1) brightness(1.05)' : 'none',
    // Smooth transitions for color space changes
    transition: 'filter 0.3s ease',
    // Ensure proper color space
    colorSpace: optimalColorSpace,
  };
}

/**
 * Add HDR meta tags to document head
 */
export function addHDRMetaTags() {
  if (typeof document === 'undefined') return;
  
  const capabilities = detectHDRCapabilities();
  
  // Add viewport meta for HDR
  if (capabilities.supportsHDR) {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || '';
      if (!content.includes('color-scheme')) {
        viewport.setAttribute('content', content + ', color-scheme=light dark');
      }
    }
  }
  
  // Add color-scheme meta
  let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (!colorSchemeMeta) {
    colorSchemeMeta = document.createElement('meta');
    colorSchemeMeta.setAttribute('name', 'color-scheme');
    document.head.appendChild(colorSchemeMeta);
  }
  colorSchemeMeta.setAttribute('content', 'light dark');
}