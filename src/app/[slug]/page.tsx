import { getAlbums, getAlbum } from '@/lib/api';
import { titleToSlug, slugToAlbumTitle } from '@/lib/api/slug';
import AlbumPageClient from './client';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

export async function generateStaticParams() {
  const albums = await getAlbums();
  return albums.map(album => ({
    slug: titleToSlug(album.title)
  }));
}

async function AlbumPage({ params: { slug } }: { params: { slug: string } }) {
  // Guard against non-album routes like favicon.ico
  if (slug.includes('.') || slug.startsWith('_')) {
    notFound();
  }
  
  const albumsData = await getAlbums();
  const { album, photos } = await getAlbum(slug);

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
