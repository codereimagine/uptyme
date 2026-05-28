import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTicker,
  moonPhase,
  sunCalc,
  type SunPosition,
  type TickerHandle,
} from './engine';

export interface Frame {
  /** the single timestamp this frame is derived from */
  now: Date;
  sun: SunPosition;
  /** moon phase fraction in [0, 1) — 0 = new, 0.5 = full */
  moonFraction: number;
  /**
   * Moon position approximation per uptyme-dual.html (line 226):
   *   moon.az  = (sun.az + 170) % 360
   *   moon.alt = -sun.alt * 0.6
   * Mockup-faithful but astronomically stylized. A true Meeus ch. 47 moon
   * position is a polish candidate logged in project memory.
   */
  moon: SunPosition;
  /** lat/lon used to compute this frame */
  lat: number;
  lon: number;
}

export interface UseTickerResult {
  frame: Frame | null;
  demo: boolean;
  setDemo: (next: boolean) => void;
}

/**
 * Single-ticker React hook around engine.createTicker.
 *
 * Lifecycle invariant: at most one setInterval handle is live per hook
 * instance. Cleanup on unmount calls TickerHandle.stop(); StrictMode's
 * double-mount in dev releases the first ticker before creating the second.
 *
 * Both faces of uptyme consume the Frame returned here — they never call
 * sunCalc / moonPhase themselves. The "ONE engine" property is enforced at
 * the call-site level.
 *
 * lat/lon update in-place via a ref read each tick, so changing location
 * doesn't tear down and re-create the ticker (which would briefly violate
 * the single-handle invariant).
 */
export function useTicker(
  initialDemo: boolean,
  lat: number,
  lon: number,
  realTickMs: number = 1000
): UseTickerResult {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [demo, setDemoState] = useState(initialDemo);
  const handleRef = useRef<TickerHandle | null>(null);
  const latLonRef = useRef({ lat, lon });

  useEffect(() => {
    latLonRef.current = { lat, lon };
  }, [lat, lon]);

  // Apply cadence changes in-place — no ticker recreation, single-handle invariant holds.
  useEffect(() => {
    handleRef.current?.setRealMs(realTickMs);
  }, [realTickMs]);

  useEffect(() => {
    const handle = createTicker({
      demo: initialDemo,
      realMs: realTickMs,
      onFrame: (now) => {
        const { lat: liveLat, lon: liveLon } = latLonRef.current;
        const sun = sunCalc(now, liveLat, liveLon);
        const moonFraction = moonPhase(now);
        const moon: SunPosition = {
          az: (sun.az + 170) % 360,
          alt: -sun.alt * 0.6,
        };
        setFrame({ now, sun, moonFraction, moon, lat: liveLat, lon: liveLon });
      },
    });
    handleRef.current = handle;
    return () => {
      handle.stop();
      handleRef.current = null;
    };
    // realTickMs intentionally NOT in deps — setRealMs effect above handles updates without recreating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDemo]);

  const setDemo = useCallback((next: boolean) => {
    setDemoState(next);
    handleRef.current?.setDemo(next);
  }, []);

  return { frame, demo, setDemo };
}
