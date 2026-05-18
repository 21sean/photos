import { albums } from './albums';
import { titleToSlug } from './slug';

/**
 * Return every album, ordered by its `order` field.
 */
export async function getAlbums() {
  return [...albums].sort((a, b) => a.order - b.order);
}

/**
 * Return a single album (and its photos) by URL slug.
 */
export async function getAlbum(slug: string) {
  const album = albums.find(a => titleToSlug(a.title) === slug);
  if (album) {
    return { album, photos: album.photos };
  }
  throw new Error(`Failed to fetch album ${slug}`);
}
