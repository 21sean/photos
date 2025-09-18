'use client';

import React from 'react';
import { detectHDRCapabilities } from '../lib/hdr-utils';

/**
 * Component to display HDR capabilities and status
 */
export function HDRStatus() {
  const [capabilities, setCapabilities] = React.useState({
    supportsHDR: false,
    supportsP3: false,
    supportsRec2020: false
  });

  React.useEffect(() => {
    setCapabilities(detectHDRCapabilities());
  }, []);

  return (
    <div className="hdr-status fixed top-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs font-mono z-50">
      <div className="text-green-400 mb-1">HDR Status:</div>
      <div>HDR: {capabilities.supportsHDR ? '✅' : '❌'}</div>
      <div>P3: {capabilities.supportsP3 ? '✅' : '❌'}</div>
      <div>Rec2020: {capabilities.supportsRec2020 ? '✅' : '❌'}</div>
    </div>
  );
}

export default HDRStatus;