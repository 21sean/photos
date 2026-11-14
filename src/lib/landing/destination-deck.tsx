'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react';
import type { Destination } from '@/lib/destinations';
import { ArrowIcon } from './arrow-icon';
import { albumHref, photoTally, position } from './format';

type Props = {
  destinations: Destination[];
  activeSlug: string | null;
  /** Total number of photographs, for the opening card. */
  photoCount: number;
  /** The deck came to rest on a destination (`null`: the opening card). */
  onSettle: (destination: Destination | null) => void;
  onActivate: (event: MouseEvent, destination: Destination) => void;
};

/** How long the deck must sit still before the globe is sent somewhere. */
const SETTLE_MS = 110;

/**
 * Phone layout: destinations as a row of cards to swipe through. Whichever
 * card sits in the middle is the one the globe flies to. Slide 0 is an
 * opening card with nothing selected.
 */
export function DestinationDeck({
  destinations,
  activeSlug,
  photoCount,
  onSettle,
  onActivate
}: Props) {
  const deckRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Slide under the centre line right now (0 is the opening card)
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const slideAt = useCallback((index: number) => {
    return trackRef.current?.querySelectorAll<HTMLElement>('.deck__card')[index];
  }, []);

  const scrollToSlide = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const track = trackRef.current;
      const slide = slideAt(index);
      if (!track || !slide) return;
      track.scrollTo({
        left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
        behavior
      });
    },
    [slideAt]
  );

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    let nearestDistance = Infinity;
    track.querySelectorAll<HTMLElement>('.deck__card').forEach((slide, i) => {
      const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - centre);
      if (distance < nearestDistance) {
        nearest = i;
        nearestDistance = distance;
      }
    });

    if (nearest !== currentRef.current) {
      currentRef.current = nearest;
      setCurrent(nearest);
    }
    // Flinging past several cards shouldn't send the globe to each of them
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      onSettle(nearest === 0 ? null : destinations[nearest - 1]);
    }, SETTLE_MS);
  };
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Tell the layout how tall the deck really is, so the globe and the
  // readout above it clear the cards on any phone and at any text size
  useEffect(() => {
    const deck = deckRef.current;
    const page = deck?.closest<HTMLElement>('.landing');
    if (!deck || !page) return;
    const observer = new ResizeObserver(() => {
      if (deck.offsetHeight > 0) {
        page.style.setProperty('--deck-height', `${deck.offsetHeight}px`);
      }
    });
    observer.observe(deck);
    return () => {
      observer.disconnect();
      page.style.removeProperty('--deck-height');
    };
  }, []);

  // Follow selections made elsewhere (a tap on the globe, the index sheet)
  useEffect(() => {
    const target = activeSlug
      ? destinations.findIndex(d => d.slug === activeSlug) + 1
      : 0;
    if (target !== currentRef.current) scrollToSlide(target);
  }, [activeSlug, destinations, scrollToSlide]);

  return (
    <section className="deck" aria-label="Places" ref={deckRef}>
      <div className="deck__track" ref={trackRef} onScroll={handleScroll}>
        <div
          className="deck__card deck__card--intro"
          data-glass=""
          data-current={current === 0}
        >
          <p className="deck__headline">
            {destinations.length} places, {photoCount} photos
          </p>
          <p className="deck__text">
            Swipe through the cards, or tap a light on the globe.
          </p>
          <button
            type="button"
            className="button deck__start"
            onClick={() => scrollToSlide(1)}
          >
            See the first place <ArrowIcon />
          </button>
        </div>

        {destinations.map((destination, i) => {
          const isCurrent = current === i + 1;
          const hasPhotos = destination.photoCount > 0;
          const shared = {
            className: 'deck__card',
            'data-glass': '',
            'data-current': isCurrent,
            'data-empty': !hasPhotos,
            onClick: (event: MouseEvent) => {
              // A card peeking in from the side comes to the middle first
              if (!isCurrent) {
                event.preventDefault();
                scrollToSlide(i + 1);
                return;
              }
              onActivate(event, destination);
            }
          };
          const body = (
            <>
              <span className="deck__eyebrow">
                <span>
                  {position(destination.index, destinations.length)}
                </span>
                {destination.year && <span>{destination.year}</span>}
              </span>
              <span className="deck__title">{destination.title}</span>
              {destination.description && (
                <span className="deck__text">{destination.description}</span>
              )}
              <span className="deck__footer">
                <span>{hasPhotos ? photoTally(destination) : ''}</span>
                <span className="deck__cta">
                  {hasPhotos ? (
                    <>
                      Open album <ArrowIcon />
                    </>
                  ) : (
                    'Photos coming soon'
                  )}
                </span>
              </span>
            </>
          );

          return hasPhotos ? (
            <Link key={destination.slug} href={albumHref(destination)} {...shared}>
              {body}
            </Link>
          ) : (
            <div key={destination.slug} {...shared}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="deck__ruler">
        <button
          type="button"
          className="deck__tick deck__tick--intro"
          data-current={current === 0}
          aria-label="Overview"
          onClick={() => scrollToSlide(0)}
        />
        {destinations.map((destination, i) => (
          <button
            key={destination.slug}
            type="button"
            className="deck__tick"
            data-current={current === i + 1}
            aria-label={destination.title}
            onClick={() => scrollToSlide(i + 1)}
          />
        ))}
      </div>
    </section>
  );
}
