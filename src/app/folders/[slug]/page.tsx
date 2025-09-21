import { getFolder, getFolders } from '@/lib/api';
import { slugToFolderName, titleToSlug } from '@/lib/api/slug';
import Grid from '@/lib/images/pig-grid';
import Link from 'next/link';

export async function generateStaticParams() {
  const folders = await getFolders();
  return folders.map(folder => ({ slug: titleToSlug(folder.title) }));
}

async function Folder({ params: { slug } }: { params: { slug: string } }) {
  const { folder, photos } = await getFolder(slug);

  return (
    <section className="flex flex-col justify-center sm:flex-row sm:my-4 sm:mt-8">
      <div className="px-2 sm:px-4 w-full max-w-6xl">
        <h1
          id="top"
          className="font-semibold tracking-tight text-4xl mb-8 w-full"
        >
          {folder.title}
        </h1>

        <Grid items={photos} />

        <div className="flex justify-end items-center mt-6">
          <Link href="/folders" className="text-gray-400 hover:text-gray-600">← Back to all folders</Link>
        </div>
      </div>
    </section>
  );
}

export default Folder;
