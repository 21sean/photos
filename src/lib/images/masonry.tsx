'use client';

import * as React from 'react';
import { Masonry as MasonicMasonry } from 'masonic';
import { type RenderComponentProps } from 'masonic';
import { useLightbox } from '../../hooks/use-lightbox';
import { Photo } from '@/types';
import HDRImage from './hdr-image';

const MasonryItem = ({
  width: itemWidth,
  data: photo
}: RenderComponentProps<Photo>) => {
  // Calculate proper scaled dimensions for the masonry item
  const aspectRatio = photo.width / photo.height;
  const scaledHeight = itemWidth / aspectRatio;
  
  return (
    <div
      className="cursor-pointer masonry-item"
      onClick={() => window.open(photo.url, '_blank', 'noopener,noreferrer')}
    >
      <HDRImage
        photo={photo}
        width={itemWidth}
        height={scaledHeight}
        className="masonry-item"
      />
    </div>
  );
};

function currentColumnWidth() {
  if (window.innerWidth > 2000) {
    // 3xl
    return 425;
  } else if (window.innerWidth > 1536) {
    // 2xl
    return 400;
  } else if (window.innerWidth > 1280) {
    // xl
    return 350;
  } else {
    // mobile-ish
    return 250;
  }
}

function useAverageHeight(items: Array<Photo>, columnWidth: number) {
  const heights = items.map(item => {
    const aspectRatio = item.width / item.height;
    const scaledHeight = columnWidth / aspectRatio;
    return scaledHeight;
  });
  const averageHeight =
    heights.reduce((sum, height) => sum + height, 0) / items.length;
  return Math.floor(averageHeight);
}

export const Masonry = ({
  items = [],
  ...props
}: {
  items: Array<Photo>;
  className?: string;
}) => {
  useLightbox(items);

  const columnWidth = React.useMemo(() => currentColumnWidth(), []);
  const averageHeight = useAverageHeight(items, columnWidth);

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      id="gallery"
      className={`h-auto w-full
      md:w-[500px] lg:w-[720px] xl:w-[1000px] 2xl:w-[1200px] 3xl:w-[1250px]
      px-2 sm:p-0
      fade-in-delayed`}
    >
      <MasonicMasonry
        items={items}
        render={MasonryItem}
        columnGutter={window.innerWidth <= 512 ? 9 : 18}
        columnWidth={columnWidth}
        itemHeightEstimate={averageHeight}
        maxColumnCount={4}
        overscanBy={5}
        {...props}
      />
    </section>
  );
};

export default Masonry;
