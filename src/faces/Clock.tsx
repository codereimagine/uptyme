import { useEffect, useState } from 'react';
import { useSettings } from '../store/settings';
import type { Frame } from '../useTicker';

export interface ClockProps {
  frame: Frame;
}

/**
 * Circumference of the r=86 dial circle = 2π·86 ≈ 540.16. The mockup uses
 * 540 as the dasharray constant; we keep the same value byte-faithfully so
 * the visible-fraction-of-circle math matches what the source-of-truth
 * (uptyme-dual.html lines 111–115 + tick() at lines 238–240) produces.
 */
const DIAL_CIRCUMFERENCE = 540;

function fracOfDay(d: Date): number {
  return (
    (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) /
    86400
  );
}

function HourTicks() {
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const maj = i % 3 === 0;
    const innerR = maj ? 78 : 82;
    const x1 = 100 + Math.cos(a) * innerR;
    const y1 = 100 + Math.sin(a) * innerR;
    const x2 = 100 + Math.cos(a) * 86;
    const y2 = 100 + Math.sin(a) * 86;
    ticks.push(
      <line
        key={i}
        x1={x1.toFixed(2)}
        y1={y1.toFixed(2)}
        x2={x2.toFixed(2)}
        y2={y2.toFixed(2)}
      />
    );
  }
  return (
    <g stroke="#2A2A40" strokeWidth="0.8">
      {ticks}
    </g>
  );
}

export function Clock({ frame }: ClockProps) {
  const { clockSweep, animations } = useSettings();
  // Animations:off forces snap regardless of clockSweep — Off means no motion.
  const smooth = clockSweep === 'smooth' && animations !== 'off';

  const { now } = frame;
  // Snap fraction from the engine ticker (minute-resolution like the
  // original mockup). When smooth is on, the rAF rotor below overrides
  // this with a Date.now()-derived fraction every frame.
  const snapFrac = (now.getHours() * 60 + now.getMinutes()) / 1440;

  const [frac, setFrac] = useState<number>(smooth ? fracOfDay(new Date()) : snapFrac);

  // rAF rotor: when smooth, recompute fraction from Date.now() each frame.
  // Stops cleanly when smooth turns off (snap takes over from frame.now).
  useEffect(() => {
    if (!smooth) return;
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
  }, [smooth]);

  // When snap mode, sync fraction with the engine frame's wall-clock minute.
  useEffect(() => {
    if (smooth) return;
    setFrac(snapFrac);
  }, [smooth, snapFrac]);

  const elapDashOffset = DIAL_CIRCUMFERENCE * (1 - frac);

  return (
    <svg viewBox="0 0 200 200">
      <defs>
        <linearGradient id="clockArc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFB04D" />
          <stop offset="45%" stopColor="#FF5C7A" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
        <linearGradient id="clockArcNight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFB04D" />
          <stop offset="50%" stopColor="#0C0C18" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
        {/* Elapsed-ring gradient: symmetric horizontal sweep
            (blue → orange → pink → orange → blue) so when the circle is
            rotated -90° and the dash grows clockwise from 12 o'clock the
            visible colors flow sun → moon and moon → sun — matching
            Orbit's day-arc / night-arc story. */}
        <linearGradient id="clockElapsed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9FB4E0" />
          <stop offset="25%" stopColor="#FFB04D" />
          <stop offset="50%" stopColor="#FF5C7A" />
          <stop offset="75%" stopColor="#FFB04D" />
          <stop offset="100%" stopColor="#9FB4E0" />
        </linearGradient>
      </defs>

      {/* shared ring + horizon (also in Orbit — both faces inherit this chrome) */}
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

      {/* dial: same day/night fade gradient pair as Orbit. Replaces the mockup's
          static orange dayProg slice so both faces share the sun→moon /
          moon→sun color story. */}
      <path
        d="M 14 100 A 86 86 0 0 1 186 100"
        fill="none"
        stroke="url(#clockArc)"
        strokeWidth="2.5"
        opacity="0.5"
      />
      <path
        d="M 186 100 A 86 86 0 0 1 14 100"
        fill="none"
        stroke="url(#clockArcNight)"
        strokeWidth="2.5"
        opacity="0.4"
      />

      {/* elapsed-of-day ring (gradient, grows from 12 o'clock clockwise) */}
      <circle
        cx="100"
        cy="100"
        r="86"
        fill="none"
        stroke="url(#clockElapsed)"
        strokeWidth="2.5"
        strokeDasharray="540"
        strokeDashoffset={elapDashOffset.toFixed(2)}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />

      {/* Seconds-hand marker — full 360° per minute (6°/sec, perceptibly
          visible motion). In smooth mode reads fresh Date.now() per render;
          in snap mode uses the engine frame's seconds (steps per data tick).
          The elapsed-of-day ring above shows the long-period day progress;
          this dot shows the fast-period second progress — two clocks layered. */}
      {(() => {
        const dotSrc = smooth ? new Date() : now;
        const secFrac = (dotSrc.getSeconds() + dotSrc.getMilliseconds() / 1000) / 60;
        const a = secFrac * 2 * Math.PI - Math.PI / 2;
        const cx = 100 + 86 * Math.cos(a);
        const cy = 100 + 86 * Math.sin(a);
        return (
          <g>
            <circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r="3.5" fill="#FF2D3E" opacity="0.95" />
            <circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r="6" fill="none" stroke="#FF2D3E" strokeWidth="0.6" opacity="0.4" />
          </g>
        );
      })()}

      {/* 12 hour ticks (majors at 12 / 3 / 6 / 9) */}
      <HourTicks />
    </svg>
  );
}
