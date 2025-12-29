import { useEffect, useRef, useCallback } from 'react';

interface UseShakeOptions {
  threshold?: number; // Acceleration threshold for shake detection (in m/s²)
  cooldown?: number; // Cooldown period between shake events (in ms)
  onShake?: () => void; // Callback when shake is detected
}

interface DeviceMotionEventiOS extends DeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Detects if the current browser is iOS Safari
 */
function isIOSSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return isIOS && isSafari;
}

/**
 * Hook for detecting shake gestures on iOS Safari
 * Requests motion permission when required and provides shake detection
 * 
 * @param options Configuration options for shake detection
 * @returns Object with shake detection status and permission request function
 */
export function useShake(options: UseShakeOptions = {}) {
  const {
    threshold = 15, // Default threshold of 15 m/s²
    cooldown = 1000, // Default 1 second cooldown
    onShake
  } = options;

  const lastShakeTime = useRef<number>(0);
  const permissionGranted = useRef<boolean>(false);
  const isActive = useRef<boolean>(false);

  /**
   * Request permission to access device motion on iOS 13+
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isIOSSafari()) {
      return false;
    }

    // Check if permission API is available (iOS 13+)
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        permissionGranted.current = permission === 'granted';
        return permissionGranted.current;
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        return false;
      }
    } else {
      // Older iOS versions don't require permission
      permissionGranted.current = true;
      return true;
    }
  }, []);

  /**
   * Handle device motion events and detect shakes
   */
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isActive.current) return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    const { x, y, z } = acceleration;
    if (x === null || y === null || z === null) return;

    // Calculate total acceleration magnitude
    const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

    // Check if acceleration exceeds threshold
    const now = Date.now();
    if (
      totalAcceleration > threshold &&
      now - lastShakeTime.current > cooldown
    ) {
      lastShakeTime.current = now;
      onShake?.();
    }
  }, [threshold, cooldown, onShake]);

  /**
   * Set up motion event listeners
   */
  useEffect(() => {
    if (!isIOSSafari()) {
      return;
    }

    isActive.current = true;

    // Auto-request permission on mount if not already granted
    if (!permissionGranted.current) {
      requestPermission();
    }

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      isActive.current = false;
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion, requestPermission]);

  return {
    isSupported: isIOSSafari(),
    requestPermission
  };
}
