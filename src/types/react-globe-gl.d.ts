import 'react-globe.gl';

declare module 'react-globe.gl' {
  export interface GlobeProps {
    globeTileEngineMaxLevel?: number | null;
  }
}
