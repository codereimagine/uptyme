import { useEffect, useMemo, useRef, useState } from 'react';
import './uptyme.css';
import { bandOf, skyColor, type Band } from './engine';
import { Clock } from './faces/Clock';
import { Orbit } from './faces/Orbit';
import { PlacesView } from './components/PlacesView';
import { Settings } from './components/Settings';
import { UpdateBanner } from './components/UpdateBanner';
import { useSettings, type TimeFormat } from './store/settings';
import { useMode } from './useMode';
import { useFitScale } from './hooks/useFitScale';
import { usePlace } from './usePlace';
import { useTicker } from './useTicker';

// Show the time IN the selected place's timezone when known (so searching a
// city shows that city's local time), falling back to the device's local time
// for the default place or an unknown/invalid tz.
function fmtParts(h: number, m: number, format: TimeFormat): { time: string; mer: string } {
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (format === '24') {
    const hh = h < 10 ? `0${h}` : `${h}`;
    return { time: `${hh}:${mm}`, mer: '' };
  }
  const mer = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return { time: `${hh}:${mm}`, mer };
}

// Show the time IN the selected place. Source chain (no extra network — that
// would break the zero-network lock): 1) the place's IANA timezone (exact,
// DST-aware, from the geocoder / device for the default place); 2) a secure
// LOCAL fallback derived from the city's longitude (offline, city-relative,
// ~±1h on DST); 3) device-local time only if neither is available.
function fmtTime(date: Date, format: TimeFormat, timeZone?: string, lon?: number): { time: string; mer: string } {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: format === '12' ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: format === '12',
        hourCycle: format === '24' ? 'h23' : undefined,
      }).formatToParts(date);
      const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
      const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
      const dp = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
      if (hour) return { time: `${hour}:${minute}`, mer: format === '12' ? dp.toUpperCase() : '' };
    } catch {
      // invalid tz → longitude fallback below
    }
  }
  if (typeof lon === 'number' && Number.isFinite(lon)) {
    const shifted = new Date(date.getTime() + Math.round(lon / 15) * 3_600_000);
    return fmtParts(shifted.getUTCHours(), shifted.getUTCMinutes(), format);
  }
  return fmtParts(date.getHours(), date.getMinutes(), format);
}

function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function phaseLabel(b: Band): string {
  switch (b) {
    case 'day':
      return '☉ daylight';
    case 'golden':
      return '☉ golden hour';
    case 'twilight':
      return '☉→☾ twilight';
    case 'night':
      return '☾ night';
  }
}

interface Star {
  left: string;
  top: string;
  opacity: string;
  size: string;
  animation: string | undefined;
}

function genStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() > 0.82;
    const twinkles = Math.random() > 0.3;
    stars.push({
      left: `${(Math.random() * 100).toFixed(2)}%`,
      top: `${(Math.random() * 100).toFixed(2)}%`,
      opacity: (0.2 + Math.random() * 0.5).toFixed(2),
      size: big ? '2px' : '1.5px',
      animation: twinkles
        ? `tw ${(2.5 + Math.random() * 3).toFixed(1)}s ease-in-out ${(Math.random() * 3).toFixed(1)}s infinite`
        : undefined,
    });
  }
  return stars;
}

export function App() {
  const { place, setPlace, second, setSecond, clearSecond } = usePlace();
  const { timeFormat, refreshSeconds } = useSettings();
  const { frame, demo, setDemo } = useTicker(
    false,
    place.lat,
    place.lon,
    refreshSeconds * 1000
  );
  const { mode, setMode } = useMode();
  const stars = useMemo(() => genStars(96), []);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const fitScale = useFitScale(stageRef);

  const phoneBg = frame ? skyColor(frame.sun.alt) : '#04040A';
  const t = frame ? fmtTime(frame.now, timeFormat, place.timezone, place.lon) : null;
  const band = frame ? bandOf(frame.sun.alt) : null;

  // Keep the browser UI (Chrome's toolbar / status-bar tint on iOS + Android)
  // in sync with the sky so it reads as part of the instrument instead of a
  // black bar. theme-color is honored cross-platform; a no-op where unsupported.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', phoneBg);
  }, [phoneBg]);

  return (
    <>
      <div className="sky" style={{ background: phoneBg }}>
        <div className="stars">
          {stars.map((s, i) => (
            <div
              key={i}
              className="star"
              style={{
                left: s.left,
                top: s.top,
                opacity: s.opacity,
                width: s.size,
                height: s.size,
                animation: s.animation,
              }}
            />
          ))}
        </div>
      </div>

      <div className="stage-wrap">
      <div className="phone" ref={stageRef} style={{ transform: `scale(${fitScale})` }}>
        <div className="hdr">
          <div className="brand">
            <div className="brand-mark">U</div>
            <div className="brand-text">
              up<span className="a">tyme</span>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              title="Search a location"
              aria-label="Search location"
              onClick={() => setPlacesOpen(true)}
            >
              +
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Settings"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              {'⚙'}
            </button>
          </div>
        </div>
        <UpdateBanner />

        <div className="meta-bar">
          <div className={`meta-sys${demo ? ' demo' : ''}`}>
            <span className="status-dot" />
            {demo ? 'DEMO' : 'SYS.RUNNING'}
          </div>
          <div className="meta-place" title={fmtCoord(place.lat, place.lon)}>
            {place.name === 'default' ? fmtCoord(place.lat, place.lon) : place.name.toUpperCase()}
          </div>
        </div>

        <div className="modes" role="tablist" aria-label="Face mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'orbit'}
            className={`mode-btn${mode === 'orbit' ? ' active' : ''}`}
            onClick={() => setMode('orbit')}
          >
            ◎ Orbit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'clock'}
            className={`mode-btn${mode === 'clock' ? ' active' : ''}`}
            onClick={() => setMode('clock')}
          >
            ◷ Clock
          </button>
        </div>

        <div className="instrument">
          {frame && (mode === 'orbit' ? <Orbit frame={frame} /> : <Clock frame={frame} />)}
          <div className="core">
            <div className="now">
              {t ? t.time : '--:--'}
              <span className="mer">{t ? t.mer : ''}</span>
            </div>
            <div className="solar">
              SOLAR · alt {frame ? frame.sun.alt.toFixed(0) : '—'}°
            </div>
            <div className="here">◎ YOU ARE HERE</div>
          </div>
        </div>

        <div className="second-city">
          {second ? (
            <>
              <button
                type="button"
                className="second-city-readout"
                onClick={() => setSecondOpen(true)}
                aria-label={`Edit second city ${second.name}`}
              >
                <span className="second-city-label">elsewhere</span>
                <span className="second-city-name">{second.name.toUpperCase()}</span>
                <span className="second-city-coord">{fmtCoord(second.lat, second.lon)}</span>
              </button>
              <button
                type="button"
                className="second-city-clear"
                onClick={clearSecond}
                aria-label="Clear second city"
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className="second-city-add"
              aria-label="Add second city"
              onClick={() => setSecondOpen(true)}
            >
              + second city
            </button>
          )}
        </div>

        <div className="phase">
          <div className="big">{band ? phaseLabel(band) : '—'}</div>
          <div className="small">
            {frame
              ? `sun az ${frame.sun.az.toFixed(0)}° · alt ${frame.sun.alt.toFixed(1)}°`
              : '—'}
          </div>
        </div>

        <div className="foot">
          up<span className="a">tyme</span> v0.1 · open source
        </div>
      </div>
      </div>

      <PlacesView
        open={placesOpen}
        onClose={() => setPlacesOpen(false)}
        current={place}
        onSelect={setPlace}
      />

      <PlacesView
        open={secondOpen}
        onClose={() => setSecondOpen(false)}
        current={second}
        onSelect={setSecond}
        title="SET SECOND CITY"
      />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        demo={demo}
        onDemoChange={setDemo}
      />
    </>
  );
}
