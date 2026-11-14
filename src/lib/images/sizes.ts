/**
 * `sizes` for gallery photos: how wide a photo is laid out, so the browser
 * can pick the right `srcset` candidate before any CSS has loaded. Phones
 * show photos edge to edge; larger screens cap them beside the album nav.
 *
 * The landing page uses the same value when it warms up an album's first
 * photo, so both pages agree on which file to fetch.
 */
export const GALLERY_SIZES =
  '(max-width: 640px) 100vw, min(1100px, calc(100vw - 16rem))';
