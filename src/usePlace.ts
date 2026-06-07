import { useCallback, useEffect, useState } from 'react';
import { LAT_DEFAULT, LON_DEFAULT } from './engine';

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
}

/**
 * Uptyme is a single-location instrument — one place's sky drives the dial.
 * `place` is that active location. `second` is an optional reference point
 * (name + lat/long readout under the instrument); it never drives the engine,
 * it's just an "elsewhere" marker. Both persist to localStorage; nothing is
 * transmitted except the geocoding search the user explicitly triggers.
 */
export function usePlace(): UsePlaceResult {
  const [place, setPlaceState] = useState<Place>(readPersistedPlace);
  const [second, setSecondState] = useState<Place | null>(readPersistedSecond);

  // First-paint geolocation: if the active place is still the default
  // (i.e., the user has never set one), ask the browser for the device's
  // coordinates and update IN-MEMORY ONLY. We do NOT persist these — the
  // saved place stays "default" until the user explicitly searches a city.
  // No network: the geolocation API is local; no reverse-geocode is issued.
  useEffect(() => {
    if (place.name !== 'default') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setPlaceState({
          name: 'default',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timezone: DEVICE_TZ,
        });
      },
      () => {
        // Permission denied / unavailable: keep Greenwich-derived default.
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
    return () => {
      cancelled = true;
    };
  }, [place.name]);

  const setPlace = useCallback((next: Place) => {
    setPlaceState(next);
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

  return { place, setPlace, second, setSecond, clearSecond };
}
