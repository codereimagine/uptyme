import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light' | 'night' | 'auto';
export type TimeFormat = '12' | '24';
export type Animations = 'on' | 'reduce' | 'off';
/** Real-time tick cadence in seconds. Demo mode keeps its own fast cadence. */
export type RefreshSeconds = 1 | 5 | 30 | 60;

/** Clock-face elapsed-of-day ring behavior.
 *  - 'smooth': rAF rotor inside Clock recomputes from Date.now() each frame
 *              → continuous sweep, "time feel".
 *  - 'snap':   ring jumps only when the engine ticker fires (1s/5s/30s/60s).
 *  Forced to 'snap' regardless of setting when Animations === 'off'. */
export type ClockSweep = 'smooth' | 'snap';

interface SettingsState {
  theme: Theme;
  timeFormat: TimeFormat;
  animations: Animations;
  refreshSeconds: RefreshSeconds;
  clockSweep: ClockSweep;
}

const STORAGE_KEY = 'uptyme.settings';

const DEFAULTS: SettingsState = {
  theme: 'dark',
  timeFormat: '12',
  animations: 'on',
  refreshSeconds: 1,
  clockSweep: 'smooth',
};

const THEMES: readonly Theme[] = ['dark', 'light', 'night', 'auto'];
const TIME_FORMATS: readonly TimeFormat[] = ['12', '24'];
const ANIMS: readonly Animations[] = ['on', 'reduce', 'off'];
const REFRESH_OPTIONS: readonly RefreshSeconds[] = [1, 5, 30, 60];
const CLOCK_SWEEPS: readonly ClockSweep[] = ['smooth', 'snap'];

function pickEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function pickNumber<T extends number>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function readPersisted(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      return {
        theme: pickEnum(o.theme, THEMES, DEFAULTS.theme),
        timeFormat: pickEnum(o.timeFormat, TIME_FORMATS, DEFAULTS.timeFormat),
        animations: pickEnum(o.animations, ANIMS, DEFAULTS.animations),
        refreshSeconds: pickNumber(o.refreshSeconds, REFRESH_OPTIONS, DEFAULTS.refreshSeconds),
        clockSweep: pickEnum(o.clockSweep, CLOCK_SWEEPS, DEFAULTS.clockSweep),
      };
    }
  } catch {
    // ignore — fall through to defaults
  }
  return DEFAULTS;
}

// Module-level shared state + listener set. useSyncExternalStore lets every
// React component see the SAME settings (Settings.tsx and App.tsx etc).
// Without this, each useState call had its own copy and edits didn't
// propagate — that was the 12h/24h bug.
let state: SettingsState = readPersisted();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SettingsState {
  return state;
}

function emit(next: SettingsState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  applyTheme(next.theme);
  applyAnimations(next.animations);
  listeners.forEach((l) => l());
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('theme-dark', 'theme-light', 'theme-night', 'theme-auto');
  html.classList.add(`theme-${theme}`);
}

export function applyAnimations(a: Animations): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('anim-on', 'anim-reduce', 'anim-off');
  html.classList.add(`anim-${a}`);
}

// Apply on module load so the first paint reflects persisted state.
if (typeof document !== 'undefined') {
  applyTheme(state.theme);
  applyAnimations(state.animations);
}

export interface UseSettingsResult extends SettingsState {
  setTheme: (v: Theme) => void;
  setTimeFormat: (v: TimeFormat) => void;
  setAnimations: (v: Animations) => void;
  setRefreshSeconds: (v: RefreshSeconds) => void;
  setClockSweep: (v: ClockSweep) => void;
  resetDefaults: () => void;
}

export function useSettings(): UseSettingsResult {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snap,
    setTheme: (v) => emit({ ...state, theme: v }),
    setTimeFormat: (v) => emit({ ...state, timeFormat: v }),
    setAnimations: (v) => emit({ ...state, animations: v }),
    setRefreshSeconds: (v) => emit({ ...state, refreshSeconds: v }),
    setClockSweep: (v) => emit({ ...state, clockSweep: v }),
    resetDefaults: () => {
      try {
        localStorage.removeItem('uptyme.settings');
        localStorage.removeItem('uptyme.mode');
        localStorage.removeItem('uptyme.place');
        localStorage.removeItem('uptyme.place2');
      } catch {
        // ignore
      }
      window.location.reload();
    },
  };
}
