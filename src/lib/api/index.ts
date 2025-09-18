import { mockAlbums, mockFolders } from '../mock-data';
import { titleToSlug } from './slug';

export async function getAlbums() {
  // Using mock data instead of Contentful
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  return mockAlbums.sort((a, b) => a.order - b.order);
}

export async function getAlbum(slug: string) {
  // Find album by slug
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  const album = mockAlbums.find(a => titleToSlug(a.title) === slug);
  if (album) {
    return { album, photos: album.photos };
  }
  throw new Error(`Failed to fetch album ${slug}`);
}

export async function getPhotos(tag: string) {
  // Return photos from all albums that might match the tag
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  const allPhotos = mockAlbums.flatMap(album => album.photos);
  return allPhotos.filter(photo => 
    photo.title.toLowerCase().includes(tag.toLowerCase())
  );
}

export async function getFolders() {
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  return mockFolders.sort((a, b) => a.order - b.order);
}

export async function getFolder(folderSlug: string) {
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  const folder = mockFolders.find(f => titleToSlug(f.title) === folderSlug);
  if (folder) {
    return { folder, photos: folder.photos };
  }
  throw new Error(`Failed to fetch folder '${folderSlug}'`);
}
