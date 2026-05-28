import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sunCalc,
  moonPhase,
  bandOf,
  skyColor,
  createTicker,
  LAT_DEFAULT,
  LON_DEFAULT,
  TICK_MS_REAL,
  TICK_MS_DEMO,
} from './engine';

// Signed phase delta on the unit circle [0,1) — handles wrap-around at 0/1.
function wrapDelta(c: number, r: number): number {
  let d = c - r;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

describe('P1.1 sunCalc — NOAA fixture (Meeus ch. 25)', () => {
  const fixture = new Date(Date.UTC(2026, 4, 26, 16, 0, 0));
  const REF_ALT = 67.8757;
  const REF_AZ = 145.2497;
  const TOL = 0.5;

  it('alt within ±0.5° of NOAA reference', () => {
    const r = sunCalc(fixture, LAT_DEFAULT, LON_DEFAULT);
    expect(Math.abs(r.alt - REF_ALT)).toBeLessThanOrEqual(TOL);
  });

  it('az within ±0.5° of NOAA reference', () => {
    const r = sunCalc(fixture, LAT_DEFAULT, LON_DEFAULT);
    expect(Math.abs(r.az - REF_AZ)).toBeLessThanOrEqual(TOL);
  });
});

describe('P1.2 moonPhase — Meeus ch. 49 fixtures', () => {
  const TOL = 0.02;

  it('new-moon instant 2026-04-17T11:54:13.780Z → fraction ≈ 0 within ±0.02', () => {
    const f = moonPhase(new Date('2026-04-17T11:54:13.780Z'));
    expect(Math.abs(wrapDelta(f, 0.0))).toBeLessThanOrEqual(TOL);
  });

  it('full-moon instant 2026-05-01T17:25:29.598Z → fraction ≈ 0.5 within ±0.02', () => {
    const f = moonPhase(new Date('2026-05-01T17:25:29.598Z'));
    expect(Math.abs(wrapDelta(f, 0.5))).toBeLessThanOrEqual(TOL);
  });
});

describe('P1.3 bandOf — 4 interior probes', () => {
  it.each([
    { alt: 20, band: 'day' as const },
    { alt: 5, band: 'golden' as const },
    { alt: -4, band: 'twilight' as const },
    { alt: -20, band: 'night' as const },
  ])('alt $alt° → $band', ({ alt, band }) => {
    expect(bandOf(alt)).toBe(band);
  });
});

describe('P1.3 bandOf — boundary cuts (exclusive lower edge)', () => {
  it.each([
    { alt: 12, band: 'golden' as const },
    { alt: 12.1, band: 'day' as const },
    { alt: 0, band: 'twilight' as const },
    { alt: 0.1, band: 'golden' as const },
    { alt: -8, band: 'night' as const },
    { alt: -7.9, band: 'twilight' as const },
  ])('boundary $alt° → $band', ({ alt, band }) => {
    expect(bandOf(alt)).toBe(band);
  });
});

describe('P1.3 skyColor — gradient string contains band-specific first stop', () => {
  it.each([
    { alt: 20, frag: '#13182A' },
    { alt: 5, frag: '#3A2A30' },
    { alt: -4, frag: '#1E1830' },
    { alt: -20, frag: '#0C0C18' },
  ])('alt $alt° gradient contains $frag', ({ alt, frag }) => {
    expect(skyColor(alt)).toContain(frag);
  });
});

describe('P1.4 createTicker — single tick source invariant', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('boots with one immediate frame and one live interval', () => {
    vi.useFakeTimers();
    const onFrame = vi.fn();
    const h = createTicker({ demo: true, onFrame });
    expect(onFrame).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TICK_MS_DEMO);
    expect(onFrame).toHaveBeenCalledTimes(2);
    h.stop();
  });

  it('stop() releases the interval — no further frames', () => {
    vi.useFakeTimers();
    const onFrame = vi.fn();
    const h = createTicker({ demo: true, onFrame });
    h.stop();
    vi.advanceTimersByTime(TICK_MS_DEMO * 10);
    expect(onFrame).toHaveBeenCalledTimes(1); // only the boot frame
  });

  it('setDemo(false) swaps cadence cleanly — old demo timer does not fire', () => {
    vi.useFakeTimers();
    const onFrame = vi.fn();
    const h = createTicker({ demo: true, onFrame });
    expect(onFrame).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TICK_MS_DEMO);
    expect(onFrame).toHaveBeenCalledTimes(2);

    h.setDemo(false); // immediate fire on cadence change
    expect(onFrame).toHaveBeenCalledTimes(3);

    // demo cadence must not fire — old interval is cleared
    vi.advanceTimersByTime(TICK_MS_DEMO);
    expect(onFrame).toHaveBeenCalledTimes(3);

    // real-time cadence fires
    vi.advanceTimersByTime(TICK_MS_REAL);
    expect(onFrame).toHaveBeenCalledTimes(4);

    h.stop();
  });

  it('demo mode advances onFrame "now" forward by +4 min per frame', () => {
    vi.useFakeTimers();
    const ts: Date[] = [];
    const h = createTicker({ demo: true, onFrame: (now) => ts.push(now) });
    vi.advanceTimersByTime(TICK_MS_DEMO);
    vi.advanceTimersByTime(TICK_MS_DEMO);
    expect(ts).toHaveLength(3);
    // 3 frames; demoT accumulates +4 min each frame. Diff between frame[0] and
    // frame[2] should exceed 8 min of wall+demoT.
    const diffMs = ts[2].getTime() - ts[0].getTime();
    expect(diffMs).toBeGreaterThan(8 * 60 * 1000);
    h.stop();
  });

  it('real-time mode advances "now" by wall clock only', () => {
    vi.useFakeTimers();
    const ts: Date[] = [];
    const h = createTicker({ demo: false, onFrame: (now) => ts.push(now) });
    vi.advanceTimersByTime(TICK_MS_REAL);
    vi.advanceTimersByTime(TICK_MS_REAL);
    expect(ts).toHaveLength(3);
    // wall advanced by ~2s; no demoT applied.
    const diffMs = ts[2].getTime() - ts[0].getTime();
    expect(diffMs).toBeLessThan(3 * TICK_MS_REAL);
    h.stop();
  });
});
