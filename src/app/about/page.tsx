import { getAlbums } from '@/lib/api';
import Globe from '@/lib/globes/mini-globe';
import Nav from '@/lib/nav';
import Noise from '@/lib/fx/noise';
import { ExternalLink } from '@/lib/external-link';

export async function generateStaticParams() {
  const albums = await getAlbums();
  return albums.map(album => ({ slug: album.title.toLowerCase() }));
}

function Contact() {
  return (
    <div id="contact" className="flex gap-14">
      <div>
        <h2 className="uppercase tracking-tight text-sm mb-1 font-light text-gray-400">
          Socials
        </h2>
        <ul className="text-lg font-medium">
          <li>
            <ExternalLink href="https://instagram.com/sean.photo">
              Instagram
            </ExternalLink>
          </li>
        </ul>
      </div>
    </div>
  );
}

async function AboutPage() {
  const albums = await getAlbums();

  return (
    <section
      className={`flex flex-col sm:flex-row
        pt-4 sm:pt-5 sm:pb-5
        min-h-[100dvh] max-sm:h-auto max-sm:overflow-y-auto`}
    >
      <div
        className={`
           mx-auto sm:mx-0 sm:pt-24 sm:pl-20 sm:pr-30 space-y-1
           w-[320px]`}
      >
        <Nav albums={albums} />
      </div>

      <div
        className={`rounded-tl-xl rounded-bl-xl bg-black
          px-4 sm:px-9 py-4 sm:py-8 pt-8 sm:pt-20
          w-full relative overflow-hidden`}
      >
        <section className="z-20 relative max-w-96">
          <h1 className="font-bold text-4xl tracking-tight text-white">sean.photo</h1>
          <p className="text-2xl text-gray-300 font-light">
            <span className="text-gray-500">✦</span> Photography Portfolio
          </p>

          <p className="mt-20 mb-6 text-lg text-white">{`
        
        `}</p>

          <p className="mb-32 text-lg text-white">
            
          </p>

          <Contact />
        </section>

        <Globe
          albums={albums}
          className={`-bottom-72 -right-48 max-sm:-bottom-36 max-sm:-right-40
            max-w-[1024px] max-sm:w-[768px]
            fade-in`}
        />
        {/* Overlap Globe to fade in the edges */}
        <div
          aria-hidden={true}
          className={`
            absolute -bottom-72 -right-48 pointer-events-none
            rounded-full border-[100px] border-black
            max-xl:hidden max-w-[1024px]`}
          style={{
            width: 1000,
            height: 1000,
            boxShadow: 'inset 0 0 50px 125px rgb(0 0 0 / 50%)'
          }}
        />
        <Noise />
      </div>
    </section>
  );
}

export default AboutPage;
