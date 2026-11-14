'use client';

import dynamic from 'next/dynamic';

// WebGL only: the globe cannot render on the server
export const GlobeLoader = dynamic(() => import('./globe'), { ssr: false });
