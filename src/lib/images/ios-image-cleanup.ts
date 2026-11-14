/**
 * iOS Safari image memory cleanup.
 *
 * iOS Safari keeps a tight per-tab memory budget. When photos scroll far
 * out of view their decoded bitmaps are released by swapping the source for
 * a tiny placeholder; scrolling back restores them. This prevents the
 * "disappearing content" and lag that long galleries otherwise hit on iOS.
 */

import { isIOSSafari } from '../browser-utils';

// Transparent 1x1 GIF
const EMPTY_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const ORIGINAL_SRC = 'data-original-src';
const ORIGINAL_SRCSET = 'data-original-srcset';

/**
 * Watch the images inside `container` and release the ones far off screen.
 * Returns a function that stops watching and restores every image.
 * Does nothing outside iOS Safari.
 */
export function setupImageCleanup(
  container: HTMLElement | null,
  options?: {
    /** How far outside the viewport images stay loaded. */
    rootMargin?: string;
  }
): () => void {
  if (!container || !isIOSSafari()) return () => {};

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const image = entry.target as HTMLImageElement;
        if (entry.isIntersecting) restoreImage(image);
        else releaseImage(image);
      }
    },
    { rootMargin: options?.rootMargin ?? '200% 0px', threshold: 0 }
  );

  const images = Array.from(container.querySelectorAll('img'));
  for (const image of images) observer.observe(image);

  return () => {
    observer.disconnect();
    for (const image of images) restoreImage(image);
  };
}

/** Drop the decoded bitmap by pointing the image at a placeholder. */
function releaseImage(image: HTMLImageElement): void {
  if (image.hasAttribute(ORIGINAL_SRC)) return; // already released
  if (!image.src || image.src.startsWith('data:')) return;

  image.setAttribute(ORIGINAL_SRC, image.src);
  // `srcset` wins over `src`, so it has to go too or nothing is released
  const srcset = image.getAttribute('srcset');
  if (srcset) {
    image.setAttribute(ORIGINAL_SRCSET, srcset);
    image.removeAttribute('srcset');
  }
  image.src = EMPTY_GIF;
}

function restoreImage(image: HTMLImageElement): void {
  const src = image.getAttribute(ORIGINAL_SRC);
  if (!src) return;

  const srcset = image.getAttribute(ORIGINAL_SRCSET);
  if (srcset) image.setAttribute('srcset', srcset);
  image.src = src;
  image.removeAttribute(ORIGINAL_SRC);
  image.removeAttribute(ORIGINAL_SRCSET);
}
