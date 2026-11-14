'use client';

import Link from 'next/link';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { Destination } from '@/lib/destinations';
import { albumHref, ordinal, photoTally } from './format';

type Props = {
  destinations: Destination[];
  activeSlug: string | null;
  /** Pointer or keyboard focus moved onto a destination. */
  onPreview?: (destination: Destination) => void;
  /** Pointer or focus left the list altogether. */
  onPreviewEnd?: () => void;
  /** A destination was clicked. Call `event.preventDefault()` to take over. */
  onActivate: (event: MouseEvent, destination: Destination) => void;
  className?: string;
};

/**
 * The typographic list of destinations. Entries with photos are real links;
 * the rest are buttons that only point the globe at the place.
 */
export function DestinationIndex({
  destinations,
  activeSlug,
  onPreview,
  onPreviewEnd,
  onActivate,
  className = ''
}: Props) {
  // Arrow keys walk the list, as they would in a menu
  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('.index__item')
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + step + items.length) % items.length].focus();
  };

  return (
    <ol
      className={`index__list ${className}`}
      data-has-active={activeSlug !== null}
      style={{ '--rows': destinations.length } as CSSProperties}
      onKeyDown={handleKeyDown}
      onMouseLeave={onPreviewEnd}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onPreviewEnd?.();
      }}
    >
      {destinations.map((destination, i) => {
        const isActive = destination.slug === activeSlug;
        const shared = {
          className: 'index__item',
          'data-active': isActive,
          'aria-current': isActive ? ('true' as const) : undefined,
          onMouseEnter: () => onPreview?.(destination),
          onFocus: () => onPreview?.(destination),
          onClick: (event: MouseEvent) => onActivate(event, destination)
        };
        const content = (
          <>
            <span className="index__num">{ordinal(destination.index)}</span>
            <span className="index__name">{destination.title}</span>
            <span className="index__meta">
              {destination.year && destination.photoCount > 0
                ? `${destination.year}, ${photoTally(destination)}`
                : photoTally(destination)}
            </span>
          </>
        );

        return (
          <li key={destination.slug} style={{ '--i': i } as CSSProperties}>
            {destination.photoCount > 0 ? (
              <Link href={albumHref(destination)} {...shared}>
                {content}
              </Link>
            ) : (
              <button type="button" {...shared}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
