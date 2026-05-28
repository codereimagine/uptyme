import { useEffect, useRef, useState } from 'react';
import type { SunPosition } from '../engine';
import { useSettings } from '../store/settings';
import type { Frame } from '../useTicker';

const DIAL_CIRCUMFERENCE = 540;

function fracOfDay(d: Date): number {
  return (
    (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) /
    86400
  );
}

export interface OrbitProps {
  frame: Frame;
}

/**
 * Place a body at azimuth `az` and dial-radius `R` on the 200×200 instrument
 * centered at (100, 100). Ported byte-faithful from uptyme-dual.html (line 205):
 *   ang = (az - 180) · π/180
 *   cx  = 100 + R · sin(ang)
 *   cy  = 100 - R · cos(ang)
 * → az=180 (south) maps to the top of the dial; east is left, west is right.
 */
function place(az: number, R: number): { cx: number; cy: number } {
  const ang = ((az - 180) * Math.PI) / 180;
  return {
    cx: 100 + R * Math.sin(ang),
    cy: 100 - R * Math.cos(ang),
  };
}

function coordLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

// Shortest-path angle lerp (handles the 359° → 1° wrap).
function angleLerp(from: number, to: number, alpha: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  let result = from + delta * alpha;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  return result;
}

const SMOOTH_ALPHA = 0.18; // 60fps · 18% per frame → ~250ms to settle

export function Orbit({ frame }: OrbitProps) {
  const { sun: targetSun, moon: targetMoon, moonFraction, lat, lon, now } = frame;
  const { clockSweep, animations } = useSettings();
  const smooth = clockSweep === 'smooth' && animations !== 'off';

  // Elapsed-of-day fraction — shared with Clock face. When smooth, a rAF
  // rotor recomputes from Date.now() every frame; otherwise tracks the
  // engine frame's wall-clock minute.
  const snapFrac = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const [frac, setFrac] = useState<number>(smooth ? fracOfDay(new Date()) : snapFrac);
  useEffect(() => {
    if (!smooth) {
      setFrac(snapFrac);
      return;
    }
    let cancelled = false;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      setFrac(fracOfDay(new Date()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [smooth, snapFrac]);

  const elapDashOffset = DIAL_CIRCUMFERENCE * (1 - frac);
  // Seconds-hand: full 360° rotation per minute (6°/sec — perceptibly fast).
  // In smooth mode reads Date.now() so sub-second ms feeds continuous sweep.
  // In snap mode uses the engine frame's seconds (steps once per data tick).
  const dotSrc = smooth ? new Date() : now;
  const secFrac = (dotSrc.getSeconds() + dotSrc.getMilliseconds() / 1000) / 60;
  const dotA = secFrac * 2 * Math.PI - Math.PI / 2;
  const dotCx = 100 + 86 * Math.cos(dotA);
  const dotCy = 100 + 86 * Math.sin(dotA);

  // Per-frame rAF interpolation between engine ticks. The engine emits a new
  // sun/moon position every TICK_MS (120ms demo, 1s+ real-time); the rotor
  // rotates continuously at 60fps. Without interpolation the bodies "step"
  // every tick against the rotor's smooth rotation, which reads as ghosting/
  // "two suns". Interpolating each rAF toward the engine target makes the
  // bodies move continuously at 60fps.
  const [display, setDisplay] = useState<{ sun: SunPosition; moon: SunPosition }>({
    sun: targetSun,
    moon: targetMoon,
  });
  const targetRef = useRef({ sun: targetSun, moon: targetMoon });
  targetRef.current = { sun: targetSun, moon: targetMoon };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setDisplay((prev) => {
        const t = targetRef.current;
        return {
          sun: {
            alt: prev.sun.alt + (t.sun.alt - prev.sun.alt) * SMOOTH_ALPHA,
            az: angleLerp(prev.sun.az, t.sun.az, SMOOTH_ALPHA),
          },
          moon: {
            alt: prev.moon.alt + (t.moon.alt - prev.moon.alt) * SMOOTH_ALPHA,
            az: angleLerp(prev.moon.az, t.moon.az, SMOOTH_ALPHA),
          },
        };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sun = display.sun;
  const moon = display.moon;
  const sunPos = place(sun.az, 86);
  const moonPos = place(moon.az, 86);
  const sunOpacity = sun.alt > -2 ? 1 : 0.25;
  const moonOpacity = moon.alt > -2 ? 1 : 0.45;

  // Lit-disc cx (mockup-faithful, stylized — flagged in P1.2 for later polish).
  const offRaw =
    moonFraction < 0.5
      ? moonFraction * 2 * 10 - 5
      : (1 - moonFraction) * 2 * 10 - 5;
  const moonLitCx = moonFraction < 0.5 ? offRaw : -offRaw;

  return (
    <svg viewBox="0 0 200 200">
      <defs>
        <radialGradient id="sunG">
          <stop offset="0%" stopColor="#FFD98A" />
          <stop offset="100%" stopColor="#FFB04D" />
        </radialGradient>
        <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFB04D" />
          <stop offset="45%" stopColor="#FF5C7A" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
        <linearGradient id="arcNight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFB04D" />
          <stop offset="50%" stopColor="#0C0C18" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
        {/* Shared elapsed-of-day gradient — matches Clock's #clockElapsed
            so both faces tell the same time story. */}
        <linearGradient id="orbitElapsed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9FB4E0" />
          <stop offset="25%" stopColor="#FFB04D" />
          <stop offset="50%" stopColor="#FF5C7A" />
          <stop offset="75%" stopColor="#FFB04D" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
        <clipPath id="moonClip">
          <circle cx="0" cy="0" r="5" />
        </clipPath>
      </defs>

      {/* shared ring + horizon */}
      <circle cx="100" cy="100" r="92" fill="none" stroke="#1A1A28" strokeWidth="1" />
      <line
        x1="14"
        y1="100"
        x2="186"
        y2="100"
        stroke="#1A1A28"
        strokeWidth="1"
        strokeDasharray="2 4"
      />

      {/* day arc gradient + night arc + lat/long curve + horizon markers */}
      <path
        d="M 14 100 A 86 86 0 0 1 186 100"
        fill="none"
        stroke="url(#arc)"
        strokeWidth="2.5"
        opacity="0.8"
      />
      <path
        d="M 186 100 A 86 86 0 0 1 14 100"
        fill="none"
        stroke="url(#arcNight)"
        strokeWidth="1.5"
        opacity="0.7"
      />
      <path
        id="latPath"
        d="M 22 100 A 78 78 0 0 0 178 100"
        fill="none"
        stroke="none"
      />
      <text
        fill="#9FB4E0"
        fontSize="9"
        letterSpacing="3"
        fontFamily="'JetBrains Mono', monospace"
      >
        <textPath href="#latPath" startOffset="50%" textAnchor="middle">
          {coordLabel(lat, lon)}
        </textPath>
      </text>
      <circle cx="14" cy="100" r="3.5" fill="#FFB04D" opacity="0.4" />
      <circle cx="186" cy="100" r="3.5" fill="#9FB4E0" opacity="0.4" />

      {/* elapsed-of-day ring + traveling marker — same as Clock face.
          Renders BELOW the sun/moon so they stay on top visually. */}
      <circle
        cx="100"
        cy="100"
        r="86"
        fill="none"
        stroke="url(#orbitElapsed)"
        strokeWidth="1.5"
        strokeDasharray="540"
        strokeDashoffset={elapDashOffset.toFixed(2)}
        strokeLinecap="round"
        opacity="0.5"
        transform="rotate(-90 100 100)"
      />
      <g>
        <circle cx={dotCx.toFixed(2)} cy={dotCy.toFixed(2)} r="3.5" fill="#FF2D3E" opacity="0.95" />
        <circle cx={dotCx.toFixed(2)} cy={dotCy.toFixed(2)} r="6" fill="none" stroke="#FF2D3E" strokeWidth="0.6" opacity="0.4" />
      </g>

      {/* sun */}
      <g
        className="orbit-body"
        transform={`translate(${sunPos.cx.toFixed(1)},${sunPos.cy.toFixed(1)})`}
        opacity={sunOpacity}
      >
        <circle r="13" fill="none" stroke="#FFB04D" strokeWidth="0.8" opacity="0.5" />
        <circle r="8" fill="url(#sunG)" />
      </g>

      {/* moon */}
      <g
        className="orbit-body"
        transform={`translate(${moonPos.cx.toFixed(1)},${moonPos.cy.toFixed(1)})`}
        opacity={moonOpacity}
      >
        <circle r="5" fill="#26304A" />
        <g clipPath="url(#moonClip)">
          <circle r="5" fill="#D6E2FF" cx={moonLitCx.toFixed(1)} />
        </g>
        <circle r="5" fill="none" stroke="#9FB4E0" strokeWidth="0.6" opacity="0.6" />
      </g>
    </svg>
  );
}
