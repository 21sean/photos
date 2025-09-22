import { useEffect, useState } from 'react';

type State = {
  width: number | undefined;
  height: number | undefined;
};

export function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState<State>({
    width: undefined,
    height: undefined
  });

  useEffect(() => {
    function getViewportHeight() {
      // Prefer visualViewport height on iOS Safari to avoid top/bottom gaps
      const vv = window.visualViewport;
      const visualHeight = vv ? vv.height : undefined;
      const fallback = window.innerHeight;
      return Math.round(visualHeight || fallback);
    }

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: getViewportHeight()
      });
    }

    window.addEventListener('resize', handleResize);

    handleResize();

    // On iOS Safari, the visualViewport resizes when the URL bar collapses/expands
    const vv = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize); // account for viewport shifting
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (vv && vv.removeEventListener) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      }
    };
  }, []);
  return windowSize;
}
