import './globals.css';
import { getAlbums } from '@/lib/data';
import { GlobeLoader } from '@/lib/globes/globe-loader';

export default async function Page() {
  const albums = await getAlbums();

  return (
    <main role="main" className="fullpage">
      <GlobeLoader albums={albums} />
    </main>
  );
}
