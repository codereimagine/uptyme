import { useEffect, useState } from 'react';

export interface VisualViewportState {
  width: number;
  height: number;
  offsetTop: number;
}

const EMPTY: VisualViewportState = { width: 0, height: 0, offsetTop: 0 };

function getSnapshot(): VisualViewportState {
  if (typeof window === 'undefined' || !window.visualViewport) return EMPTY;
  return {
    width: window.visualViewport.width,
    height: window.visualViewport.height,
    offsetTop: window.visualViewport.offsetTop,
  };
}

/**
 * Tracks the visual viewport — the rectangle of viewport actually visible
 * to the user, which shrinks when the on-screen keyboard appears on iOS
 * Safari and Android Chrome, and excludes the browser's own toolbar. CSS
 * units (vh, dvh, svh) do not account for the keyboard since it's an
 * OS-level overlay; this hook bridges the gap.
 *
 * Returns {0, 0, 0} when the API is unavailable; consumers should treat that
 * as "fall back to window.inner* / CSS-driven sizing." Ported from bewthr.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(getSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () =>
      setState({ width: vv.width, height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}
