// HDR image detection and handling utilities

export interface HDRCapabilities {
  supportsHDR: boolean;
  supportsP3: boolean;
  supportsRec2020: boolean;
  maxLuminance?: number;
}

/**
 * Detect HDR capabilities of the current display
 * Optimized for iPhone 16 Pro and modern HDR displays
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
    // Check for P3 color gamut support (iPhone 16 Pro supports this)
    capabilities.supportsP3 = window.matchMedia('(color-gamut: p3)').matches;
    
    // Check for Rec2020 color gamut support
    capabilities.supportsRec2020 = window.matchMedia('(color-gamut: rec2020)').matches;
    
    // Check for high dynamic range support (iPhone 16 Pro: 1000-1600 nits)
    capabilities.supportsHDR = window.matchMedia('(dynamic-range: high)').matches;
    
    // Additional iPhone 16 Pro specific checks
    const isHighLuminance = window.matchMedia('(min-luminance: 100)').matches;
    if (isHighLuminance) {
      capabilities.supportsHDR = true;
      capabilities.maxLuminance = 1600; // iPhone 16 Pro peak HDR brightness
    }
  }

  // Check for canvas HDR support with better error handling
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { 
      colorSpace: 'display-p3',
      willReadFrequently: false // Performance optimization
    }) as CanvasRenderingContext2D | null;
    if (ctx && typeof (ctx as any).getContextAttributes === 'function') {
      const attrs = (ctx as any).getContextAttributes();
      if (attrs && 'colorSpace' in attrs) {
        capabilities.supportsP3 = true;
      }
    }
    
    // Test for Rec2020 support via CSS media queries instead
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const rec2020Query = window.matchMedia('(color-gamut: rec2020)');
        capabilities.supportsRec2020 = rec2020Query.matches;
      }
    } catch (e) {
      console.warn('Rec2020 detection failed:', e);
    }
  } catch (e) {
    console.warn('HDR canvas detection failed:', e);
  }

  // iPhone 16 Pro specific detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isModernSafari = /Version\/1[7-9]/.test(navigator.userAgent); // iOS 17+
  if (isIOS && isModernSafari && capabilities.supportsP3) {
    // iPhone 16 Pro likely supports gain maps and ISO 21496-1
    capabilities.supportsHDR = true;
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
 * Optimized for iPhone 16 Pro HDR display (1000-1600 nits)
 */
export function getHDRImageStyles(isHDR: boolean = false, colorSpace?: string) {
  const optimalColorSpace = getOptimalColorSpace(isHDR, colorSpace);
  const capabilities = detectHDRCapabilities();
  
  // Base styles for all images
  const baseStyles = {
    colorScheme: isHDR ? 'light dark' : 'light',
    transition: 'filter 0.2s ease, opacity 0.2s ease', // Faster transitions for better performance
    colorSpace: optimalColorSpace,
    imageRendering: 'auto' as const, // Let browser optimize
    imageOrientation: 'from-image' as const, // Respect EXIF orientation
  };
  
  if (!isHDR) {
    return {
      ...baseStyles,
      filter: 'none',
    };
  }
  
  // HDR-specific optimizations for iPhone 16 Pro
  if (capabilities.supportsHDR && capabilities.maxLuminance && capabilities.maxLuminance >= 1000) {
    // iPhone 16 Pro optimized settings (1000-1600 nits)
    return {
      ...baseStyles,
      filter: 'contrast(1.15) brightness(1.08) saturate(1.05)',
      // Gain map support hint for modern browsers
      colorSpace: capabilities.supportsP3 ? 'display-p3' : 'srgb',
    };
  } else if (capabilities.supportsHDR) {
    // General HDR display
    return {
      ...baseStyles,
      filter: 'contrast(1.1) brightness(1.05) saturate(1.02)',
    };
  } else {
    // Fallback for non-HDR displays
    return {
      ...baseStyles,
      filter: 'none',
    };
  }
}

/**
 * Add HDR meta tags to document head
 * Optimized for iPhone 16 Pro and iOS 18+ HDR support
 */
export function addHDRMetaTags() {
  if (typeof document === 'undefined') return;
  
  const capabilities = detectHDRCapabilities();
  
  // Enhanced viewport meta for HDR with iPhone 16 Pro optimizations
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  
  // iPhone 16 Pro optimized viewport settings
  const viewportContent = [
    'width=device-width',
    'initial-scale=1',
    'maximum-scale=1', // Prevent zoom lag
    'user-scalable=no', // Disable zoom for performance
    'viewport-fit=cover', // Ensure content extends into iOS safe areas
    capabilities.supportsHDR ? 'color-scheme=light dark' : ''
  ].filter(Boolean).join(', ');
  
  viewport.setAttribute('content', viewportContent);
  
  // Add color-scheme meta with HDR support
  let colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (!colorSchemeMeta) {
    colorSchemeMeta = document.createElement('meta');
    colorSchemeMeta.setAttribute('name', 'color-scheme');
    document.head.appendChild(colorSchemeMeta);
  }
  colorSchemeMeta.setAttribute('content', 'light dark');
  
  // Add supported-color-schemes for iPhone 16 Pro
  if (capabilities.supportsHDR) {
    let supportedColorSchemes = document.querySelector('meta[name="supported-color-schemes"]');
    if (!supportedColorSchemes) {
      supportedColorSchemes = document.createElement('meta');
      supportedColorSchemes.setAttribute('name', 'supported-color-schemes');
      document.head.appendChild(supportedColorSchemes);
    }
    supportedColorSchemes.setAttribute('content', 'light dark hdr');
  }
  
  // Add HDR capability hints for gain map processing
  if (capabilities.supportsP3) {
    let hdrCapabilities = document.querySelector('meta[name="hdr-capabilities"]');
    if (!hdrCapabilities) {
      hdrCapabilities = document.createElement('meta');
      hdrCapabilities.setAttribute('name', 'hdr-capabilities');
      document.head.appendChild(hdrCapabilities);
    }
    const capabilityList = [
      capabilities.supportsP3 ? 'p3' : '',
      capabilities.supportsRec2020 ? 'rec2020' : '',
      capabilities.supportsHDR ? 'gain-maps' : ''
    ].filter(Boolean).join(' ');
    hdrCapabilities.setAttribute('content', capabilityList);
  }
}