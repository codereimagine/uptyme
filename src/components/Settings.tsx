import { useEffect } from 'react';
import { usePwaUpdate } from '../lib/PwaUpdate';
import type { GeoFix } from '../geo';
import {
  useSettings,
  type Animations,
  type ClockSweep,
  type RefreshSeconds,
  type Theme,
  type TimeFormat,
} from '../store/settings';

const CLOCK_SWEEP_OPTIONS: { value: ClockSweep; label: string }[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'snap', label: 'Snap' },
];

const THEMES: { value: Theme; label: string; glyph: string }[] = [
  { value: 'dark', label: 'Dark', glyph: '\u{1F319}' },
  { value: 'light', label: 'Light', glyph: '☀' },
  { value: 'night', label: 'Night', glyph: '\u{1F311}' },
  { value: 'auto', label: 'Auto', glyph: '\u{1F317}' },
];

const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: '12', label: '12h' },
  { value: '24', label: '24h' },
];

const ANIMS: { value: Animations; label: string }[] = [
  { value: 'on', label: 'On' },
  { value: 'reduce', label: 'Reduce' },
  { value: 'off', label: 'Off' },
];

const REFRESH_OPTIONS: { value: RefreshSeconds; label: string }[] = [
  { value: 1, label: '1s' },
  { value: 5, label: '5s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
];

interface ChipRowProps<T extends string | number> {
  ariaLabel: string;
  options: { value: T; label: string; glyph?: string }[];
  value: T;
  onChange: (v: T) => void;
}

function ChipRow<T extends string | number>({
  ariaLabel,
  options,
  value,
  onChange,
}: ChipRowProps<T>) {
  return (
    <div className="settings-chip-row" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`settings-chip${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.glyph && <span className="settings-chip-glyph">{opt.glyph}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UpdatesSection() {
  const { checkForUpdates, checkResult } = usePwaUpdate();
  const checking = checkResult === 'checking';

  let label = 'Check for updates';
  if (checking) label = 'Checking…';

  let note: string | null = null;
  if (checkResult === 'up-to-date') note = "You're up to date";
  else if (checkResult === 'found') note = 'New version found — close Settings to refresh';
  else if (checkResult === 'error') note = "Couldn't check right now";

  return (
    <div className="settings-section">
      <div className="settings-section-title">Updates</div>
      <button
        type="button"
        className="settings-update-check"
        onClick={() => void checkForUpdates()}
        disabled={checking}
        aria-busy={checking}
      >
        {label}
      </button>
      {note && <div className="settings-update-note">{note}</div>}
    </div>
  );
}

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  demo: boolean;
  onDemoChange: (on: boolean) => void;
  geoEnabled: boolean;
  onGeoEnabledChange: (on: boolean) => void;
  geoFix: GeoFix | null;
  geoLocating: boolean;
  geoFailed: boolean;
}

// LOCATION — same switch as bewthr: on by default. This button is the security
// chokepoint. Off wipes the saved fix and stops all location use; nothing is
// acquired or sent. GPS coords stay on-device (they only feed the sky math).
function LocationSection({ enabled, onChange, fix, loading, failed }: {
  enabled: boolean;
  onChange: (on: boolean) => void;
  fix: GeoFix | null;
  loading: boolean;
  failed: boolean;
}) {
  let note: string;
  if (loading) note = 'Getting your location…';
  else if (!enabled) note = 'Location is off. Nothing is acquired or sent. Turn on, or pick a city with +.';
  else if (failed) note = 'Couldn’t get precise or network location. Add a place by name with + instead.';
  else if (fix?.approximate) note = 'On — approximate, from your network (GPS was blocked). Kept on your device. Tap the target button to try GPS again.';
  else if (fix) note = 'On — starts automatically each visit, kept on your device. Tap the target button to update.';
  else note = 'On — tap the target button in the top bar. If GPS is blocked, it uses your approximate network location.';

  return (
    <div className="settings-section">
      <div className="settings-section-title">Location</div>
      <button
        type="button"
        className="settings-update-check"
        onClick={() => onChange(!enabled)}
        // Never disabled (unlike bewthr's): a kill switch must work mid-lookup.
        // Turning OFF while a request is in flight is safe — see usePlace/geo.
        aria-busy={loading}
        aria-pressed={enabled}
      >
        {enabled ? 'Location: On — tap to turn off' : 'Location: Off — tap to turn on'}
      </button>
      <div className="settings-update-note">{note}</div>
    </div>
  );
}

// Settings is a full-screen OPAQUE view (same shell as PlacesView), not a
// translucent draggable bottom sheet. The sheet-over-the-live-scaled-app forced
// iOS to re-blend a full-screen translucent layer every drag frame — the cause
// of the drag jank. A full-screen opaque view has nothing to blend and no drag,
// so the jank is structurally impossible (matches the never-janky search view).
export function Settings({ open, onClose, demo, onDemoChange, geoEnabled, onGeoEnabledChange, geoFix, geoLocating, geoFailed }: SettingsProps) {
  const settings = useSettings();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
        <div className="places-view-title">SETTINGS</div>
        <button
          type="button"
          className="places-view-icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="settings-view-body">
      <LocationSection enabled={geoEnabled} onChange={onGeoEnabledChange} fix={geoFix} loading={geoLocating} failed={geoFailed} />

      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <ChipRow<Theme>
          ariaLabel="Theme"
          options={THEMES}
          value={settings.theme}
          onChange={settings.setTheme}
        />
        <div className="settings-note">
          Auto follows OS preference. Night is a deeper palette for actual night use.
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Time format</div>
        <ChipRow<TimeFormat>
          ariaLabel="Time format"
          options={TIME_FORMATS}
          value={settings.timeFormat}
          onChange={settings.setTimeFormat}
        />
        <div className="settings-note">12h adds AM/PM. 24h hides the meridiem.</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Animations</div>
        <ChipRow<Animations>
          ariaLabel="Animations"
          options={ANIMS}
          value={settings.animations}
          onChange={settings.setAnimations}
        />
        <div className="settings-note">
          Reduce slows transitions and stops the star twinkle. Off disables motion entirely.
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Clock</div>
        <ChipRow<ClockSweep>
          ariaLabel="Clock ring sweep"
          options={CLOCK_SWEEP_OPTIONS}
          value={settings.clockSweep}
          onChange={settings.setClockSweep}
        />
        <div className="settings-note">
          Smooth gives the elapsed-of-day ring a continuous second-by-second
          sweep — the "time feel." Snap jumps the ring once per data tick.
          Animations: Off forces Snap regardless of this setting.
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <ChipRow<RefreshSeconds>
          ariaLabel="Real-time refresh interval"
          options={REFRESH_OPTIONS}
          value={settings.refreshSeconds}
          onChange={settings.setRefreshSeconds}
        />
        <div className="settings-note">
          How often the engine recomputes in real-time mode. 1m saves battery on
          mobile; the core clock only changes minute-by-minute anyway. Demo mode
          keeps its own fast cadence.
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Demo</div>
        <ChipRow<'on' | 'off'>
          ariaLabel="Demo time-lapse"
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          value={demo ? 'on' : 'off'}
          onChange={(v) => onDemoChange(v === 'on')}
        />
        <div className="settings-note">
          Time-lapse sweep — the sun and moon race through a full day so you can
          watch the cycle. Off is real-time. The meta-bar shows DEMO while it's on.
        </div>
      </div>

      <UpdatesSection />

      <div className="settings-section">
        <div className="settings-section-title">Reset</div>
        <button
          type="button"
          className="settings-reset"
          onClick={() => {
            if (confirm('Reset uptyme settings, saved location, and face mode?')) {
              settings.resetDefaults();
            }
          }}
        >
          Reset all settings to defaults
        </button>
      </div>
      </div>
    </div>
  );
}
