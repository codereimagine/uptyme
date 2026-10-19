import { describe, expect, it, vi } from 'vitest';
import {
  acquireLocation,
  clearStoredGeo,
  fetchIpLocation,
  GEO_AUTO_KEY,
  GEO_KEY,
  IP_ENDPOINT,
  parseStoredGeo,
  readGeoAuto,
  readStoredGeo,
  validCoords,
  writeGeoAuto,
  writeStoredGeo,
} from './geo';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

type Outcome = 'ok' | 'error' | 'hang';
function fakeGeo(outcome: Outcome) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, err?: PositionErrorCallback | null) => {
    if (outcome === 'ok') ok({ coords: { latitude: 40.71, longitude: -74.01 } } as GeolocationPosition);
    if (outcome === 'error') err?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    // 'hang': never calls back (seen on Chrome iOS)
  });
  return { getCurrentPosition } as unknown as Geolocation & { getCurrentPosition: typeof getCurrentPosition };
}

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('validCoords / parseStoredGeo', () => {
  it('accepts real coords and rejects out-of-range, non-finite and 0,0', () => {
    expect(validCoords(40.71, -74.01)).toBe(true);
    expect(validCoords(91, 0)).toBe(false);
    expect(validCoords(0, 181)).toBe(false);
    expect(validCoords(Number.NaN, 1)).toBe(false);
    expect(validCoords('40', 1)).toBe(false);
    expect(validCoords(0, 0)).toBe(false);
  });
  it('parses a stored fix and defaults approximate to false', () => {
    expect(parseStoredGeo({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2, approximate: false });
    expect(parseStoredGeo({ lat: 1, lon: 2, approximate: true })).toEqual({ lat: 1, lon: 2, approximate: true });
    expect(parseStoredGeo({ lat: 'x', lon: 2 })).toBeNull();
    expect(parseStoredGeo(null)).toBeNull();
  });
});

describe('storage', () => {
  it('round-trips and clears the saved fix', () => {
    const kv = memoryStorage();
    writeStoredGeo({ lat: 40.71, lon: -74.01, approximate: true }, kv);
    expect(readStoredGeo(kv)).toEqual({ lat: 40.71, lon: -74.01, approximate: true });
    clearStoredGeo(kv);
    expect(kv.map.has(GEO_KEY)).toBe(false);
    expect(readStoredGeo(kv)).toBeNull();
  });
  it('mode is AUTO by default and persists MANUAL', () => {
    const kv = memoryStorage();
    expect(readGeoAuto(kv)).toBe(true);
    writeGeoAuto(false, kv);
    expect(kv.map.get(GEO_AUTO_KEY)).toBe('0');
    expect(readGeoAuto(kv)).toBe(false);
    writeGeoAuto(true, kv);
    expect(readGeoAuto(kv)).toBe(true);
  });
  it('survives corrupt storage', () => {
    const kv = memoryStorage();
    kv.setItem(GEO_KEY, '{not json');
    expect(readStoredGeo(kv)).toBeNull();
  });
});

describe('fetchIpLocation', () => {
  it('reads ipwho.is coordinates', async () => {
    const f = fakeFetch({ success: true, latitude: 40.7, longitude: -74.0 });
    expect(await fetchIpLocation(f)).toEqual({ lat: 40.7, lon: -74.0 });
    expect(f).toHaveBeenCalledWith(IP_ENDPOINT, expect.anything());
  });
  it('returns null on failure, bad data, HTTP error or network error', async () => {
    expect(await fetchIpLocation(fakeFetch({ success: false }))).toBeNull();
    expect(await fetchIpLocation(fakeFetch({ success: true, latitude: 0, longitude: 0 }))).toBeNull();
    expect(await fetchIpLocation(fakeFetch({}, false))).toBeNull();
    expect(await fetchIpLocation((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});

describe('acquireLocation', () => {
  const ipBody = { success: true, latitude: 40.7, longitude: -74.0 };

  it('uses GPS when it answers, and never calls the network', async () => {
    const geo = fakeGeo('ok');
    const f = fakeFetch(ipBody);
    expect(await acquireLocation({ auto: true, geo, fetchImpl: f })).toEqual({ lat: 40.71, lon: -74.01, approximate: false });
    expect(f).not.toHaveBeenCalled();
  });

  it('falls back to the network when GPS is denied/fails', async () => {
    const f = fakeFetch(ipBody);
    expect(await acquireLocation({ auto: true, geo: fakeGeo('error'), fetchImpl: f })).toEqual({ lat: 40.7, lon: -74.0, approximate: true });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to the network when GPS never answers (watchdog)', async () => {
    const f = fakeFetch(ipBody);
    expect(await acquireLocation({ auto: true, geo: fakeGeo('hang'), fetchImpl: f, watchdogMs: 20 })).toEqual({ lat: 40.7, lon: -74.0, approximate: true });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to the network when the browser has no geolocation API', async () => {
    const f = fakeFetch(ipBody);
    expect(await acquireLocation({ auto: true, geo: undefined, fetchImpl: f })).toEqual({ lat: 40.7, lon: -74.0, approximate: true });
  });

  it('returns null when both GPS and the network fail', async () => {
    expect(await acquireLocation({ auto: true, geo: fakeGeo('error'), fetchImpl: fakeFetch({ success: false }) })).toBeNull();
  });

  it('MANUAL mode (kill switch): no GPS request and no network request', async () => {
    const geo = fakeGeo('ok');
    const f = fakeFetch(ipBody);
    expect(await acquireLocation({ auto: false, geo, fetchImpl: f })).toBeNull();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });
});
