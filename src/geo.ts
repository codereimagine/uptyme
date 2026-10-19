// LOCATION — ported from bewthr (store/geo.ts + lib/ipGeo.ts), framework-free.
//
// Two modes, chosen in Settings:
//   AUTO (default) — device GPS first; if it's blocked, fails, times out or never
//     answers (a real Chrome-on-iOS state), fall back to an approximate, city-level
//     location from the network (ipwho.is, keyless, no permission prompt).
//   MANUAL — the kill switch: nothing is acquired or sent, the saved fix is wiped,
//     and the user picks a city with the + search instead.
// GPS coords never leave the device (they only feed the on-device sun/moon math).
// The IP lookup is the only network use, and only in AUTO after GPS failed.

export interface GeoFix {
  lat: number;
  lon: number;
  /** true = city-level fix from the network fallback, not device GPS. */
  approximate: boolean;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const GEO_KEY = 'uptyme_geo_v1';
export const GEO_AUTO_KEY = 'uptyme_geo_auto';
export const GPS_TIMEOUT_MS = 8000;
export const GPS_MAX_AGE_MS = 600000;
/** Our own deadline: the API's `timeout` only starts once permission resolves,
 *  so a request whose permission never resolves would otherwise hang forever. */
export const LOCATE_WATCHDOG_MS = 12000;
export const IP_ENDPOINT = 'https://ipwho.is/';

function defaultStorage(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultGeolocation(): Geolocation | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.geolocation;
}

/** Finite, in range, and not the 0,0 "null island" some lookups return on failure. */
export function validCoords(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

export function parseStoredGeo(raw: unknown): GeoFix | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!validCoords(r.lat, r.lon)) return null;
  return { lat: r.lat as number, lon: r.lon as number, approximate: r.approximate === true };
}

export function readStoredGeo(kv: KV | null = defaultStorage()): GeoFix | null {
  try {
    return parseStoredGeo(JSON.parse(kv?.getItem(GEO_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function writeStoredGeo(fix: GeoFix, kv: KV | null = defaultStorage()): void {
  try {
    kv?.setItem(GEO_KEY, JSON.stringify({ lat: fix.lat, lon: fix.lon, approximate: fix.approximate }));
  } catch {
    // private mode / blocked storage — the fix still lives in memory this session
  }
}

export function clearStoredGeo(kv: KV | null = defaultStorage()): void {
  try { kv?.removeItem(GEO_KEY); } catch { /* ignore */ }
}

/** AUTO is the default; MANUAL is persisted as '0'. */
export function readGeoAuto(kv: KV | null = defaultStorage()): boolean {
  try {
    const v = kv?.getItem(GEO_AUTO_KEY);
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}

export function writeGeoAuto(auto: boolean, kv: KV | null = defaultStorage()): void {
  try { kv?.setItem(GEO_AUTO_KEY, auto ? '1' : '0'); } catch { /* ignore */ }
}

/** Device GPS with our watchdog. Rejects on error, missing API or no answer. */
export function gpsFix(
  geo: Geolocation | undefined = defaultGeolocation(),
  watchdogMs: number = LOCATE_WATCHDOG_MS,
): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!geo) {
      reject(new Error('no-geolocation'));
      return;
    }
    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('no-response'));
    }, watchdogMs);
    geo.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        reject(new Error('gps-failed'));
      },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: GPS_MAX_AGE_MS },
    );
  });
}

/** Approximate, permission-free location from the network. City-level only. */
export async function fetchIpLocation(
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetchImpl(IP_ENDPOINT, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const d = (await res.json()) as { latitude?: unknown; longitude?: unknown; success?: boolean };
    if (d.success === false) return null;
    return validCoords(d.latitude, d.longitude)
      ? { lat: d.latitude as number, lon: d.longitude as number }
      : null;
  } catch {
    return null;
  }
}

export interface AcquireDeps {
  auto?: boolean;
  geo?: Geolocation;
  fetchImpl?: typeof fetch;
  watchdogMs?: number;
}

/** GPS → network fallback. Returns null in MANUAL mode without touching GPS or
 *  the network (the kill switch is enforced here, not just in the UI). */
export async function acquireLocation(deps: AcquireDeps = {}): Promise<GeoFix | null> {
  const auto = deps.auto ?? readGeoAuto();
  if (!auto) return null;
  try {
    const g = await gpsFix('geo' in deps ? deps.geo : defaultGeolocation(), deps.watchdogMs);
    return { ...g, approximate: false };
  } catch {
    const ip = await fetchIpLocation(deps.fetchImpl ?? fetch);
    return ip ? { ...ip, approximate: true } : null;
  }
}

/** True only when geolocation is ALREADY granted — querying never prompts. */
export async function geoPermissionGranted(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return p?.state === 'granted';
  } catch {
    return false;
  }
}
