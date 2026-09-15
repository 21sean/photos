'use client';

import { useEffect, useState } from 'react';
import { ThinkingOrb, type OrbSize } from 'thinking-orbs';

// Held off briefly so photos that come straight from cache never flash an orb.
const APPEAR_DELAY_MS = 180;
const FADE_MS = 300;

interface LoadingOrbProps {
  /** Whether the thing being waited on is still loading. */
  active?: boolean;
  /** Tuned preset: 64 for a photo slot, 20 for inline text. */
  size?: OrbSize;
  className?: string;
}

/**
 * The dotted "working" orb, used while photos are still coming down the wire.
 * The album pages are dark whatever the OS prefers, so the theme is pinned
 * rather than left on `auto`.
 */
export function LoadingOrb({
  active = true,
  size = 64,
  className = ''
}: LoadingOrbProps) {
  // Stays mounted through the fade-out, so the orb doesn't pop off the screen.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const delay = active ? APPEAR_DELAY_MS : FADE_MS;
    const timeoutId = setTimeout(() => setMounted(active), delay);
    return () => clearTimeout(timeoutId);
  }, [active]);

  if (!mounted) return null;

  return (
    <div
      className={`pointer-events-none flex items-center justify-center ${className}`}
      style={{
        opacity: active ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`
      }}
    >
      <ThinkingOrb state="working" size={size} theme="dark" />
    </div>
  );
}

export default LoadingOrb;
