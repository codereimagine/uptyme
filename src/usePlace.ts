import { useCallback, useEffect, useState } from 'react';
import { LAT_DEFAULT, LON_DEFAULT } from './engine';
import {
  acquireLocation,
  clearStoredGeo,
  geoPermissionGranted,
  readGeoEnabled,
  readStoredGeo,
  writeGeoEnabled,
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
  /** One-tap locate (same as bewthr): turns location ON if it's off, else
   *  re-acquires — GPS, else approximate network location. Tap-gated. */
  locate: () => void;
  /** The location fix currently driving the dial, or null (Greenwich / a city). */
  fix: GeoFix | null;
  /** True from the tap until a fix arrives or both sources fail. */
  locating: boolean;
  /** True when the last attempt got neither GPS nor a network location. */
  locateFailed: boolean;
  /** ON (GPS → network fallback) or OFF (kill switch: city search only). */
  geoEnabled: boolean;
  setGeoEnabled: (on: boolean) => void;
}

/** A location fix drives the dial as the unnamed "default" place in device tz. */
function fixToPlace(fix: GeoFix): Place {
  return { name: 'default', lat: fix.lat, lon: fix.lon, timezone: DEVICE_TZ };
}

/** A picked city (name !== 'default') always wins; otherwise, in ON, the
 *  last-known fix loads instantly (like bewthr), else Greenwich. */
function initialLocation(): { place: Place; fix: GeoFix | null } {
  const persisted = readPersistedPlace();
  if (persisted.name !== 'default' || !readGeoEnabled()) return { place: persisted, fix: null };
  const fix = readStoredGeo();
  return fix ? { place: fixToPlace(fix), fix } : { place: persisted, fix: null };
}

/**
 * Uptyme is a single-location instrument — one place's sky drives the dial.
 * `place` is that active location. `second` is an optional reference point
 * (name + lat/long readout under the instrument); it never drives the engine,
 * it's just an "elsewhere" marker. Both persist to localStorage. Network use is
 * the geocoding search the user triggers, plus — only when ON and GPS fails —
 * the approximate network-location fallback (see ./geo.ts). OFF sends nothing.
 */
export function usePlace(): UsePlaceResult {
  const [init] = useState(initialLocation);
  const [place, setPlaceState] = useState<Place>(init.place);
  const [fix, setFix] = useState<GeoFix | null>(init.fix);
  const [second, setSecondState] = useState<Place | null>(readPersistedSecond);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [geoEnabled, setGeoEnabledState] = useState(readGeoEnabled);

  // Most recent choice wins: a fix replaces a picked city (the city is dropped
  // from storage so the fix also wins on the next load).
  // The single chokepoint for saving a fix: re-check the switch here so a request
  // that was in flight when the user turned location OFF can't save or apply it.
  const applyFix = useCallback((next: GeoFix) => {
    if (!readGeoEnabled()) return;
    writeStoredGeo(next);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setPlaceState(fixToPlace(next));
    setFix(next);
    setLocateFailed(false);
  }, []);

  // Tap-gated: never prompts on load (no geolocation-on-start). See ./geo.ts.
  const acquireNow = useCallback(() => {
    if (!readGeoEnabled()) return;
    setLocating(true);
    setLocateFailed(false);
    void acquireLocation().then((next) => {
      setLocating(false);
      if (!readGeoEnabled()) return;   // switched OFF mid-flight — drop it
      if (next) applyFix(next);
      else setLocateFailed(true);
    });
  }, [applyFix]);

  // Like bewthr: if permission is ALREADY granted, silently refresh the last-known
  // fix on load (querying never prompts). Only when no city is picked.
  useEffect(() => {
    if (!readGeoEnabled() || readPersistedPlace().name !== 'default') return;
    let cancelled = false;
    void geoPermissionGranted().then(async (granted) => {
      if (!granted || cancelled) return;
      const next = await acquireLocation();
      if (next && !cancelled && readPersistedPlace().name === 'default') applyFix(next);
    });
    return () => { cancelled = true; };
  }, [applyFix]);

  // OFF is the kill switch: wipe the saved fix and drop back to Greenwich
  // (a picked city is kept). ON acquires right away — the switch is a gesture.
  const setGeoEnabled = useCallback((on: boolean) => {
    writeGeoEnabled(on);
    setGeoEnabledState(on);
    setLocateFailed(false);
    if (on) {
      acquireNow();
      return;
    }
    clearStoredGeo();
    setFix(null);
    setLocating(false);
    setPlaceState((p) => (p.name === 'default' ? readPersistedPlace() : p));
  }, [acquireNow]);

  // bewthr's one-tap locate: turn location ON if it's off (which acquires),
  // else re-acquire.
  const locate = useCallback(() => {
    if (!readGeoEnabled()) setGeoEnabled(true);
    else acquireNow();
  }, [setGeoEnabled, acquireNow]);

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
    locate, fix, locating, locateFailed, geoEnabled, setGeoEnabled,
  };
}
