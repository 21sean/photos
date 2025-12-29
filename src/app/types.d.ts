declare module 'topojson-client';
declare module 'three-geojson-geometry';
declare module 'd3-geo';
declare module 'three';

declare module '*.geojson' {
  const value: any;
  export default value;
}

interface Window {
  Pig: any;
}
