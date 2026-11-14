import type { Photo } from '@/types';

/**
 * How a gallery photo is laid out, expressed once and used twice: as CSS
 * (the `--ratio` and orientation on a gallery item, see globals.css) and as
 * the `sizes` attribute below, so the browser can pick the right `srcset`
 * candidate before any CSS has loaded.
 *
 * Phones show photos edge to edge. Larger screens cap them: a landscape
 * photo at 65% of the viewport's height, a portrait one so that it fits
 * under the album header. Both are also capped in width, and by the room
 * left beside the album nav.
 */
const LANDSCAPE = { maxWidth: 1100, maxHeight: '65vh' };
const PORTRAIT = { maxWidth: 700, maxHeight: '(100vh - 190px)' };

export function orientationOf({
  width,
  height
}: Pick<Photo, 'width' | 'height'>) {
  return width > height ? ('landscape' as const) : ('portrait' as const);
}

export function gallerySizes(photo: Pick<Photo, 'width' | 'height'>): string {
  const ratio = (photo.width / photo.height).toFixed(4);
  const { maxWidth, maxHeight } =
    orientationOf(photo) === 'landscape' ? LANDSCAPE : PORTRAIT;
  return `(max-width: 640px) 100vw, min(${maxWidth}px, calc(100vw - 16rem), calc(${maxHeight} * ${ratio}))`;
}
