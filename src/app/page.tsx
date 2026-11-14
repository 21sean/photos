import { getDestinations } from '@/lib/destinations';
import { Landing } from '@/lib/landing/landing';

export default function Page() {
  const destinations = getDestinations();
  const photoCount = destinations.reduce(
    (total, destination) => total + destination.photoCount,
    0
  );

  return (
    <Landing
      destinations={destinations}
      photoCount={photoCount}
      year={new Date().getFullYear()}
    />
  );
}
