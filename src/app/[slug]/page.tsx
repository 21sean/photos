import { notFound } from 'next/navigation';
import { getAlbums, getAlbum } from '@/lib/data';
import { titleToSlug } from '@/lib/slug';
import AlbumPageClient from './client';

export const dynamicParams = false;

export async function generateStaticParams() {
  const albums = await getAlbums();
  return albums.map(album => ({
    slug: titleToSlug(album.title)
  }));
}

async function AlbumPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params;
  // Guard against non-album routes like favicon.ico
  if (slug.includes('.') || slug.startsWith('_')) {
    notFound();
  }

  const albumsData = await getAlbums();
  const { album, photos } = await getAlbum(slug);

  // No explicit preload() for the first photo here. React already emits a
  // preload for the gallery's high-priority images when it renders the HTML,
  // and a hint issued from this server component would also ride along in
  // the route's prefetch payload: the landing page prefetches every album,
  // so it would start downloading every album's first photo.

  return (
    <AlbumPageClient
      albums={albumsData}
      album={album}
      photos={photos}
      slug={slug}
    />
  );
}

export default AlbumPage;
