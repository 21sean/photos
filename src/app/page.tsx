import dynamic from 'next/dynamic';
import './globals.css';
import { getAlbums } from '@/lib/api';

const Globe = dynamic(() => import('@/lib/globes/globe'), {
  ssr: false
});

export default async function Page() {
  const albums = await getAlbums();

  return (
    <main role="main" className="app-fullscreen fullpage">
      <Globe albums={albums} />
    </main>
  );
}
