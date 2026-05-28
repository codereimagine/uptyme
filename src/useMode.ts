import { useCallback, useState } from 'react';

export type Mode = 'orbit' | 'clock';

const STORAGE_KEY = 'uptyme.mode';
const DEFAULT_MODE: Mode = 'orbit';

function readPersistedMode(): Mode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'clock' ? 'clock' : 'orbit';
  } catch {
    // localStorage access can throw (privacy mode, blocked storage) — fall through.
    return DEFAULT_MODE;
  }
}

export interface UseModeResult {
  mode: Mode;
  setMode: (next: Mode) => void;
}

/**
 * Face mode (Orbit ↔ Clock) with localStorage persistence.
 *
 * The mode is a face-layer concern; the engine and tick source are unaffected.
 * P3's sky-tracking + rotation will read `mode` to know whether the instrument
 * should rotate (Orbit) or stay still (Clock).
 */
export function useMode(): UseModeResult {
  const [mode, setModeState] = useState<Mode>(readPersistedMode);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  return { mode, setMode };
}
