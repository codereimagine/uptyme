import { useCallback, useEffect, useState } from 'react';
import { LAT_DEFAULT, LON_DEFAULT } from './engine';
import {
  acquireLocation,
  clearStoredGeo,
  geoPermissionGranted,
  readGeoAuto,
  readStoredGeo,
  writeGeoAuto,
  writeStoredGeo,
  type GeoFix,
} from './geo';

export interface Place {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  /** IANA tz of this place; when set, the clock shows THIS city's local time. */
  timezone?: string;
}

const STORAGE_KEY = 'uptyme.place';
const SECOND_STORAGE_KEY = 'uptyme.place2';

// The default/home place uses the DEVICE's IANA timezone so it shows correct
// local time (DST-aware); searched cities carry their own tz from the geocoder.
const DEVICE_TZ: string | undefined = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
})();

const DEFAULT_PLACE: Place = {
  name: 'default',
  lat: LAT_DEFAULT,
  lon: LON_DEFAULT,
  timezone: DEVICE_TZ,
};

function isValidPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === 'number' &&
    typeof v.lon === 'number' &&
    typeof v.name === 'string' &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lon)
  );
}

function normalizePlace(parsed: Place): Place {
  return {
    name: parsed.name,
    region: typeof parsed.region === 'string' ? parsed.region : undefined,
    country: typeof parsed.country === 'string' ? parsed.country : undefined,
    lat: parsed.lat,
    lon: parsed.lon,
    timezone: typeof parsed.timezone === 'string' ? parsed.timezone : undefined,
  };
}

function readPersistedPlace(): Place {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLACE;
    const parsed: unknown = JSON.parse(raw);
    if (isValidPlace(parsed)) return normalizePlace(parsed);
  } catch {
    // ignore parse / storage failures — fall through to default
  }
  return DEFAULT_PLACE;
}

function readPersistedSecond(): Place | null {
  try {
    const raw = localStorage.getItem(SECOND_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValidPlace(parsed)) return normalizePlace(parsed);
  } catch {
    // ignore — treat as unset
  }
  return null;
}

export interface UsePlaceResult {
  place: Place;
  setPlace: (next: Place) => void;
  /** Optional reference location ("elsewhere"), null when unset. */
  second: Place | null;
  setSecond: (next: Place) => void;
  clearSecond: () => void;
  /** Locate now: GPS, else approximate network location. Tap-gated (or the
   *  Settings switch to AUTO). No-op in MANUAL mode. */
  locate: () => void;
  /** The location fix currently driving the dial, or null (Greenwich / a city). */
  fix: GeoFix | null;
  /** True from the tap until a fix arrives or both sources fail. */
  locating: boolean;
  /** True when the last AUTO attempt got neither GPS nor a network location. */
  locateFailed: boolean;
  /** AUTO (GPS → network fallback) or MANUAL (kill switch: city search only). */
  geoAuto: boolean;
  setGeoAuto: (auto: boolean) => void;
}

/** A location fix drives the dial as the unnamed "default" place in device tz. */
function fixToPlace(fix: GeoFix): Place {
  return { name: 'default', lat: fix.lat, lon: fix.lon, timezone: DEVICE_TZ };
}

/** A picked city (name !== 'default') always wins; otherwise, in AUTO, the
 *  last-known fix loads instantly (like bewthr), else Greenwich. */
function initialLocation(): { place: Place; fix: GeoFix | null } {
  const persisted = readPersistedPlace();
  if (persisted.name !== 'default' || !readGeoAuto()) return { place: persisted, fix: null };
  const fix = readStoredGeo();
  return fix ? { place: fixToPlace(fix), fix } : { place: persisted, fix: null };
}

/**
 * Uptyme is a single-location instrument — one place's sky drives the dial.
 * `place` is that active location. `second` is an optional reference point
 * (name + lat/long readout under the instrument); it never drives the engine,
 * it's just an "elsewhere" marker. Both persist to localStorage. Network use is
 * the geocoding search the user triggers, plus — in AUTO only, when GPS fails —
 * the approximate network-location fallback (see ./geo.ts). MANUAL sends nothing.
 */
export function usePlace(): UsePlaceResult {
  const [init] = useState(initialLocation);
  const [place, setPlaceState] = useState<Place>(init.place);
  const [fix, setFix] = useState<GeoFix | null>(init.fix);
  const [second, setSecondState] = useState<Place | null>(readPersistedSecond);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [geoAuto, setGeoAutoState] = useState(readGeoAuto);

  // Most recent choice wins: a fix replaces a picked city (the city is dropped
  // from storage so the fix also wins on the next load).
  const applyFix = useCallback((next: GeoFix) => {
    writeStoredGeo(next);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setPlaceState(fixToPlace(next));
    setFix(next);
    setLocateFailed(false);
  }, []);

  // Tap-gated: never prompts on load (no geolocation-on-start). See ./geo.ts.
  const locate = useCallback(() => {
    if (!readGeoAuto()) return;
    setLocating(true);
    setLocateFailed(false);
    void acquireLocation().then((next) => {
      setLocating(false);
      if (next) applyFix(next);
      else setLocateFailed(true);
    });
  }, [applyFix]);

  // Like bewthr: if permission is ALREADY granted, silently refresh the last-known
  // fix on load (querying never prompts). Only when no city is picked.
  useEffect(() => {
    if (!readGeoAuto() || readPersistedPlace().name !== 'default') return;
    let cancelled = false;
    void geoPermissionGranted().then(async (granted) => {
      if (!granted || cancelled) return;
      const next = await acquireLocation();
      if (next && !cancelled && readPersistedPlace().name === 'default') applyFix(next);
    });
    return () => { cancelled = true; };
  }, [applyFix]);

  // MANUAL is the kill switch: wipe the saved fix and drop back to Greenwich
  // (a picked city is kept). AUTO acquires right away — the switch is a gesture.
  const setGeoAuto = useCallback((auto: boolean) => {
    writeGeoAuto(auto);
    setGeoAutoState(auto);
    setLocateFailed(false);
    if (auto) {
      locate();
      return;
    }
    clearStoredGeo();
    setFix(null);
    setPlaceState((p) => (p.name === 'default' ? readPersistedPlace() : p));
  }, [locate]);

  const setPlace = useCallback((next: Place) => {
    setPlaceState(next);
    setFix(null);
    setLocateFailed(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures (privacy mode, etc.)
    }
  }, []);

  const setSecond = useCallback((next: Place) => {
    setSecondState(next);
    try {
      localStorage.setItem(SECOND_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  const clearSecond = useCallback(() => {
    setSecondState(null);
    try {
      localStorage.removeItem(SECOND_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  return {
    place, setPlace, second, setSecond, clearSecond,
    locate, fix, locating, locateFailed, geoAuto, setGeoAuto,
  };
}
