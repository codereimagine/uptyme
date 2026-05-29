import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchPlaces, type GeocodingResult } from '../lib/geocode';
import type { Place } from '../usePlace';

export interface PlacesViewProps {
  open: boolean;
  onClose: () => void;
  /** The currently-set place for this slot, or null when nothing is set yet. */
  current: Place | null;
  onSelect: (place: Place) => void;
  /** Overlay heading. Defaults to the primary-location wording. */
  title?: string;
}

const DEBOUNCE_MS = 300;

function resultToPlace(r: GeocodingResult): Place {
  return {
    name: r.name,
    region: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  };
}

function fmtLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function PlacesView({
  open,
  onClose,
  current,
  onSelect,
  title = 'SET LOCATION',
}: PlacesViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset transient state every time the view opens/closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes (desktop only — touch devices won't fire keydown for this).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function runSearch(value: string) {
    setQuery(value);
    setSearchError(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(value);
        setResults(data);
      } catch {
        setSearchError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Search is implicit via debounced typing; Enter just dismisses the
    // keyboard so the results are freely browsable (bewthr pattern).
    inputRef.current?.blur();
  }

  function handlePick(r: GeocodingResult) {
    onSelect(resultToPlace(r));
    onClose();
  }

  return (
    <div className={`places-view${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="places-view-header">
        <button
          type="button"
          className="places-view-icon-btn"
          onClick={onClose}
          aria-label="Back"
        >
          ←
        </button>
        <div className="places-view-title">{title}</div>
        <button
          type="button"
          className="places-view-icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form className="places-view-search" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Search any city worldwide…"
          value={query}
          onChange={(e) => runSearch(e.currentTarget.value)}
        />
      </form>

      {current && (
        <div className="places-view-current">
          <div className="places-view-current-label">current</div>
          <div className="places-view-current-value">
            <b>{current.name}</b>
            {current.region ? ` · ${current.region}` : ''}
            {current.country ? ` · ${current.country}` : ''}
            <span className="places-view-coord">{fmtLatLon(current.lat, current.lon)}</span>
          </div>
        </div>
      )}

      <div className="places-view-results" role="listbox" aria-label="Search results">
        {!searchError && query.trim().length < 2 && (
          <div className="places-view-status hint">Type 2 or more characters to search</div>
        )}
        {searching && results.length === 0 && (
          <div className="places-view-status">searching…</div>
        )}
        {searchError && (
          <div className="places-view-status error">
            search failed — check your connection
          </div>
        )}
        {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
          <div className="places-view-status">No results found</div>
        )}
        {results.map((r, i) => (
          <button
            key={`${r.latitude}-${r.longitude}-${i}`}
            type="button"
            role="option"
            className="places-view-result"
            onClick={() => handlePick(r)}
          >
            <div className="places-view-result-name">
              <b>{r.name}</b>
              {r.admin1 ? ` · ${r.admin1}` : ''}
              {r.country ? ` · ${r.country}` : ''}
            </div>
            <div className="places-view-result-coord">{fmtLatLon(r.latitude, r.longitude)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
