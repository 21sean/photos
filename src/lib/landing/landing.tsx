'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent
} from 'react';
import type { Destination } from '@/lib/destinations';
import { DestinationCallout } from './destination-callout';
import { DestinationDeck } from './destination-deck';
import { DestinationIndex } from './destination-index';
import { albumHref } from './format';
import { IndexSheet } from './index-sheet';
import './landing.css';

// WebGL only, and by far the heaviest chunk: load it after first paint
const GlobeCanvas = dynamic(() => import('@/lib/globe/globe-canvas'), {
  ssr: false
});

const INSTAGRAM_URL = 'https://instagram.com/sean.photo';

/** How long a hover preview lingers after the pointer leaves. */
const PREVIEW_GRACE_MS = 160;
/** Length of the dive into a destination before the album route loads. */
const LEAVE_MS = 620;

type Selection = {
  slug: string;
  /** Pinned selections stay put; previews end when the pointer moves on. */
  pinned: boolean;
} | null;

type Props = {
  destinations: Destination[];
  /** Total number of photographs across all albums. */
  photoCount: number;
  year: number;
};

/** Start fetching an album's first photo before its page is even requested. */
function warmUp({ lead }: Destination) {
  if (!lead) return;
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'high';
  if (lead.srcSet) {
    image.sizes = lead.sizes;
    image.srcset = lead.srcSet;
  }
  image.src = lead.url;
}

function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function Landing({ destinations, photoCount, year }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [globeReady, setGlobeReady] = useState(false);
  // Whether the globe is painting the glass panels (see lib/globe/glass.ts)
  const [glass, setGlass] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const active = useMemo(
    () => destinations.find(d => d.slug === selection?.slug) ?? null,
    [destinations, selection]
  );

  // Elements the globe positions or measures directly, every frame
  const frameRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  // What was selected when the current press began. A tap also fires hover
  // and focus events before its click, which select the place being tapped,
  // so by click time "is it already selected?" has to be asked of the past.
  const selectedAtPress = useRef<string | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(previewTimer.current);
      clearTimeout(leaveTimer.current);
    },
    []
  );

  const select = useCallback(
    (destination: Destination | null, pinned: boolean) => {
      clearTimeout(previewTimer.current);
      setSelection(destination ? { slug: destination.slug, pinned } : null);
    },
    []
  );

  const preview = useCallback(
    (destination: Destination) => select(destination, false),
    [select]
  );

  // Moving between two list items passes through a gap: wait a beat before
  // sending the globe home
  const endPreview = useCallback(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      setSelection(current => (current?.pinned ? current : null));
    }, PREVIEW_GRACE_MS);
  }, []);

  const open = useCallback(
    (destination: Destination) => {
      const href = albumHref(destination);
      warmUp(destination);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        router.push(href);
        return;
      }
      select(destination, true);
      setLeaving(true);
      leaveTimer.current = setTimeout(() => router.push(href), LEAVE_MS);
    },
    [router, select]
  );

  const activate = useCallback(
    (event: MouseEvent, destination: Destination) => {
      // Leave new-tab / new-window clicks to the browser
      if (!isPlainClick(event)) return;
      event.preventDefault();

      const canHover = window.matchMedia(
        '(hover: hover) and (pointer: fine)'
      ).matches;
      const wasSelected = selectedAtPress.current === destination.slug;
      // Without hover there is no preview, so the first tap shows the place
      // and the second one opens it
      if (destination.photoCount === 0 || (!canHover && !wasSelected)) {
        select(destination, true);
        return;
      }
      open(destination);
    },
    [select, open]
  );

  const handleGlobeHover = useCallback(
    (destination: Destination | null) => {
      if (!destination) {
        endPreview();
        return;
      }
      clearTimeout(previewTimer.current);
      setSelection(current =>
        current?.pinned ? current : { slug: destination.slug, pinned: false }
      );
    },
    [endPreview]
  );

  const handleGlobePick = useCallback(
    (destination: Destination | null) => {
      const isPinnedHere =
        destination !== null &&
        selection?.pinned === true &&
        selection.slug === destination.slug;
      // Clicking the pinned marker again opens it
      if (isPinnedHere && destination.photoCount > 0) open(destination);
      else select(destination, true);
    },
    [selection, select, open]
  );

  const handleSettle = useCallback(
    (destination: Destination) => select(destination, true),
    [select]
  );

  const handleSheetPick = useCallback(
    (event: MouseEvent, destination: Destination) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      setSheetOpen(false);
      select(destination, true);
    },
    [select]
  );

  const handleReady = useCallback((state: { glass: boolean }) => {
    setGlobeReady(true);
    setGlass(state.glass);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') select(null, false);
    };
    // Coming back through the back/forward cache: undo the exit transition
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [select]);

  return (
    <main
      className="landing"
      data-glass-root=""
      data-glass-live={glass}
      data-ready={globeReady}
      data-active={active !== null}
      data-leaving={leaving}
      onPointerDownCapture={() => {
        selectedAtPress.current = selection?.slug ?? null;
      }}
    >
      {/* Its box is the globe's place on screen (see landing.css); until
          WebGL is up it also shows a stand-in planet */}
      <div className="globe-frame" ref={frameRef} aria-hidden="true">
        <div className="globe-frame__orb" />
      </div>

      <GlobeCanvas
        destinations={destinations}
        active={active}
        diving={leaving}
        frameRef={frameRef}
        anchorRef={anchorRef}
        readoutRef={readoutRef}
        onHover={handleGlobeHover}
        onPick={handleGlobePick}
        onReady={handleReady}
      />

      <div className="landing-scrim" aria-hidden="true" />

      <header className="landing-header">
        <h1 className="wordmark">sean.photo</h1>
        <nav className="landing-nav" aria-label="Site">
          <button
            type="button"
            className="landing-nav__index"
            data-glass=""
            onClick={() => setSheetOpen(true)}
          >
            All places
          </button>
          <Link href="/about/">About</Link>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-nav__external"
          >
            Instagram
          </a>
        </nav>
      </header>

      <nav className="index" aria-label="Destinations">
        <p className="index__label">
          <span>Places</span>
          <span>{destinations.length}</span>
        </p>
        <DestinationIndex
          destinations={destinations}
          activeSlug={active?.slug ?? null}
          onPreview={preview}
          onPreviewEnd={endPreview}
          onActivate={activate}
        />
      </nav>

      <DestinationCallout
        anchorRef={anchorRef}
        active={active}
        total={destinations.length}
        pinned={selection?.pinned ?? false}
        onActivate={activate}
      />

      <DestinationDeck
        destinations={destinations}
        activeSlug={active?.slug ?? null}
        onSettle={handleSettle}
        onActivate={activate}
      />

      <p className="hud hud--readout" aria-hidden="true">
        <span ref={readoutRef}>&nbsp;</span>
      </p>
      <p className="hud hud--credit">
        <span>&copy; {year}</span>
        <span>{photoCount} photos</span>
        <span>Drag the globe to turn it</span>
      </p>

      <IndexSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Places"
        count={destinations.length}
      >
        <DestinationIndex
          destinations={destinations}
          activeSlug={active?.slug ?? null}
          onActivate={handleSheetPick}
          className="index__list--sheet"
        />
      </IndexSheet>

      <div className="landing-veil" aria-hidden="true" />
    </main>
  );
}
