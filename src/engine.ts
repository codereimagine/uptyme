// uptyme engine — pure, on-device, no DOM, no network.
// Ported byte-faithful from the verified vanilla harness at commit 24feb72.
//
// Verification references carried forward as src/engine.test.ts:
//   sunCalc   — NOAA Solar Position Algorithm (Meeus ch. 25), tol ±0.5°
//   moonPhase — Meeus ch. 49 true new- and full-moon instants, tol ±0.02
//   bandOf    — 4-band thresholds from uptyme-dual.html source-of-truth

export const LAT_DEFAULT = 40.21;
export const LON_DEFAULT = -74.04;

const RAD = Math.PI / 180;
const J2000_NOON_MS = Date.UTC(2000, 0, 1, 12);
const SYNODIC_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_SECONDS = 2551443;

export interface SunPosition {
  /** altitude in degrees; > 0 means above the horizon */
  alt: number;
  /** azimuth in degrees, 0=N 90=E 180=S 270=W */
  az: number;
}

export type Band = 'day' | 'golden' | 'twilight' | 'night';

export function sunCalc(
  date: Date,
  lat: number = LAT_DEFAULT,
  lon: number = LON_DEFAULT
): SunPosition {
  const d2 = (date.getTime() - J2000_NOON_MS) / 86400000;
  const g = (357.529 + 0.98560028 * d2) % 360;
  const q = (280.459 + 0.98564736 * d2) % 360;
  const L = (q + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD)) % 360;
  const e = 23.439 - 0.00000036 * d2;
  const RA = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / RAD;
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) / RAD;
  const GMST = (18.697374558 + 24.06570982441908 * d2) % 24;
  const LST = (GMST * 15 + lon) % 360;
  const HA = ((LST - RA + 540) % 360) - 180;
  const alt =
    Math.asin(
      Math.sin(lat * RAD) * Math.sin(dec * RAD) +
        Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(HA * RAD)
    ) / RAD;
  let az =
    Math.atan2(
      -Math.sin(HA * RAD),
      Math.tan(dec * RAD) * Math.cos(lat * RAD) - Math.sin(lat * RAD) * Math.cos(HA * RAD)
    ) / RAD;
  az = (az + 360) % 360;
  return { alt, az };
}

export function moonPhase(date: Date): number {
  const now = date.getTime() / 1000;
  const newMoon = SYNODIC_EPOCH_MS / 1000;
  const phase = ((now - newMoon) % SYNODIC_SECONDS) / SYNODIC_SECONDS;
  return phase < 0 ? phase + 1 : phase;
}

export function bandOf(alt: number): Band {
  if (alt > 12) return 'day';
  if (alt > 0) return 'golden';
  if (alt > -8) return 'twilight';
  return 'night';
}

export function skyColor(alt: number): string {
  switch (bandOf(alt)) {
    case 'day':
      return 'radial-gradient(ellipse at 50% 20%,#13182A,#0A0C16 60%,#06060C)';
    case 'golden':
      return 'radial-gradient(ellipse at 50% 25%,#3A2A30,#15101C 55%,#08070E)';
    case 'twilight':
      return 'radial-gradient(ellipse at 50% 30%,#1E1830,#0C0A18 55%,#06060C)';
    case 'night':
      return 'radial-gradient(ellipse at 50% 30%,#0C0C18,#06060C 60%,#040408)';
  }
}

// === Tick: single-interval scheduler, no DOM ===
//
// Mirrors the proven invariant from the vanilla harness: at most one
// setInterval handle is live per ticker. setDemo() clears the current
// timer and replaces it with one at the new cadence.

export const TICK_MS_REAL = 1000;
export const TICK_MS_DEMO = 120;
export const DEMO_ADVANCE_MS = 240000;

export interface TickerOptions {
  demo: boolean;
  onFrame: (now: Date) => void;
  /** Override real-time cadence in ms. Default = TICK_MS_REAL (1000). Demo cadence is fixed. */
  realMs?: number;
}

export interface TickerHandle {
  setDemo: (demo: boolean) => void;
  setRealMs: (ms: number) => void;
  stop: () => void;
}

export function createTicker(opts: TickerOptions): TickerHandle {
  let demo = opts.demo;
  let realMs = opts.realMs ?? TICK_MS_REAL;
  let demoT = 0;
  let id: ReturnType<typeof setInterval> | null = null;

  function fire(): void {
    let now = new Date();
    if (demo) {
      demoT += DEMO_ADVANCE_MS;
      now = new Date(now.getTime() + demoT);
    }
    opts.onFrame(now);
  }

  function start(): void {
    if (id !== null) {
      clearInterval(id);
      id = null;
    }
    id = setInterval(fire, demo ? TICK_MS_DEMO : realMs);
    fire();
  }

  start();

  return {
    setDemo(next: boolean): void {
      demo = next;
      demoT = 0;
      start();
    },
    setRealMs(ms: number): void {
      realMs = ms;
      // Only restart if we're currently in real-time; demo cadence is fixed.
      if (!demo) start();
    },
    stop(): void {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    },
  };
}
