'use client';

import Link from 'next/link';
import { useState, type MouseEvent, type RefObject } from 'react';
import type { Destination } from '@/lib/destinations';
import { ArrowIcon } from './arrow-icon';
import { albumHref, formatCoordinates, photoTally, position } from './format';

type Props = {
  /** The globe moves this element onto the active marker every frame. */
  anchorRef: RefObject<HTMLDivElement | null>;
  active: Destination | null;
  total: number;
  /** Pinned callouts are interactive; previews only describe. */
  pinned: boolean;
  onActivate: (event: MouseEvent, destination: Destination) => void;
};

/**
 * A map annotation: a reticle on the active destination's marker with a
 * leader line out to a card describing the place.
 */
export function DestinationCallout({
  anchorRef,
  active,
  total,
  pinned,
  onActivate
}: Props) {
  // Keep showing the last destination while the callout fades out
  const [shown, setShown] = useState(active);
  if (active && active !== shown) setShown(active);

  return (
    <div
      ref={anchorRef}
      className="callout-anchor"
      data-visible="false"
      data-pinned={pinned}
      aria-hidden={!active}
    >
      <span className="callout__reticle" />
      <span className="callout__leader" />
      {shown && (
        <CalloutCard
          key={shown.slug}
          destination={shown}
          total={total}
          onActivate={onActivate}
        />
      )}
    </div>
  );
}

function CalloutCard({
  destination,
  total,
  onActivate
}: {
  destination: Destination;
  total: number;
  onActivate: (event: MouseEvent, destination: Destination) => void;
}) {
  const coordinates = formatCoordinates(destination);
  const hasPhotos = destination.photoCount > 0;

  const body = (
    <>
      {destination.preview && (
        <span
          className="callout__preview"
          style={{
            backgroundImage: destination.preview.lqip
              ? `url("${destination.preview.lqip}")`
              : undefined
          }}
        >
          {/* Decorative: the album itself carries the described photos */}
          <img
            src={destination.preview.url}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
      )}
      <span className="callout__eyebrow">
        <span>{position(destination.index, total)}</span>
        {destination.year && <span>{destination.year}</span>}
      </span>
      <span className="callout__title">{destination.title}</span>
      <span className="callout__coords">
        {coordinates.lat}, {coordinates.lng}
      </span>
      {destination.description && (
        <span className="callout__text">{destination.description}</span>
      )}
      {destination.places.length > 0 && (
        <span className="callout__places">
          {destination.places.map(place => (
            <span key={place}>{place}</span>
          ))}
        </span>
      )}
      <span className="callout__footer">
        <span className="callout__cta">
          {hasPhotos ? (
            <>
              Open album <ArrowIcon />
            </>
          ) : (
            'Photos coming soon'
          )}
        </span>
        {hasPhotos && <span>{photoTally(destination)}</span>}
      </span>
    </>
  );

  return hasPhotos ? (
    <Link
      href={albumHref(destination)}
      className="callout"
      data-glass=""
      onClick={event => onActivate(event, destination)}
    >
      {body}
    </Link>
  ) : (
    <div className="callout" data-glass="">
      {body}
    </div>
  );
}
