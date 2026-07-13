'use client';

import React from 'react';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

// Swap letters case-for-case so glyph widths stay close and the line doesn't jitter
function randomGlyphFor(ch: string): string {
  if (/[a-z]/.test(ch)) return LOWER[(Math.random() * LOWER.length) | 0];
  if (/[A-Z]/.test(ch)) return UPPER[(Math.random() * UPPER.length) | 0];
  return ch; // keep spaces, digits and punctuation
}

function scrambleAll(text: string): string {
  return Array.from(text, randomGlyphFor).join('');
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  );
}

type Props = {
  text: string;
  /** ms after mount before the decode starts (use for staggering items) */
  mountDelay?: number;
  /** bump this number to replay the scramble (e.g. on select) */
  playKey?: number;
  /** decode duration in ms */
  duration?: number;
  className?: string;
};

/**
 * Decode/scramble text effect: renders as glyph soup and resolves
 * left-to-right into the real text. Replays when `playKey` changes.
 */
export function ScrambleText({
  text,
  mountDelay = 0,
  playKey = 0,
  duration = 900,
  className
}: Props) {
  const [display, setDisplay] = React.useState<string>(() =>
    prefersReducedMotion() ? text : scrambleAll(text)
  );
  const rafRef = React.useRef<number>(0);

  const play = React.useCallback(
    (ms: number) => {
      if (prefersReducedMotion()) {
        setDisplay(text);
        return;
      }
      cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        // ease-out reveal: early letters settle first
        const revealed = Math.floor(text.length * (1 - Math.pow(1 - t, 2)));
        if (t >= 1) {
          setDisplay(text);
          return;
        }
        let out = '';
        for (let i = 0; i < text.length; i++) {
          out += i < revealed ? text[i] : randomGlyphFor(text[i]);
        }
        setDisplay(out);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [text]
  );

  // Decode on mount, staggered by mountDelay
  React.useEffect(() => {
    const id = setTimeout(() => play(duration), mountDelay);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(rafRef.current);
    };
  }, [play, duration, mountDelay]);

  // Replay on demand (select/tap)
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (playKey > 0) play(Math.min(duration, 550));
  }, [playKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

export default ScrambleText;
