'use client';

import { useEffect, useState } from 'react';
import type { Feedback } from '@/lib/game';
import { CHAR_INFO, FINGER_GROUP, ROWS, shiftKeyFor, type KeyCell } from '@/lib/keyboard';

interface Props {
  /** characters in play for the current mode */
  chars: string;
  target: string | null;
  showTarget: boolean;
  pulse: boolean;
  feedback: Feedback | null;
  onTap: (ch: string) => void;
}

const keyWidth = (w = 1) => `calc(var(--u) * ${w} + var(--gap) * ${w - 1})`;
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

export default function Keyboard({ chars, target, showTarget, pulse, feedback, onTap }: Props) {
  const [shiftLatched, setShiftLatched] = useState(false);
  const [flash, setFlash] = useState<{ base: string; kind: 'good' | 'bad' } | null>(null);

  // briefly flash the key that was pressed green or red
  useEffect(() => {
    if (!feedback) return;
    const base = CHAR_INFO[feedback.ch]?.base;
    if (!base) return;
    setFlash({ base, kind: feedback.kind });
    const t = setTimeout(() => setFlash(null), 220);
    return () => clearTimeout(t);
  }, [feedback]);

  const info = target ? CHAR_INFO[target] : undefined;
  const targetBase = showTarget ? info?.base : undefined;
  const targetShift = showTarget && info?.shift ? shiftKeyFor(info.finger) : undefined;
  const usesShift = [...chars].some(ch => CHAR_INFO[ch]?.shift);
  const inMode = (cell: Extract<KeyCell, { kind: 'char' }>) =>
    chars.includes(cell.base) || (!!cell.shift && chars.includes(cell.shift));

  return (
    <section className="keyboard" aria-label="Keyboard guide">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map(cell => {
            if (cell.kind === 'special') {
              const isShift = cell.id === 'shiftL' || cell.id === 'shiftR';
              const active = isShift && usesShift;
              return (
                <button
                  key={cell.id}
                  type="button"
                  tabIndex={-1}
                  aria-hidden={!active}
                  className={cx(
                    'key special',
                    active ? 'f-pinky' : 'off',
                    targetShift === cell.id && 'target',
                    targetShift === cell.id && pulse && 'assist',
                    active && shiftLatched && 'latched',
                  )}
                  style={{ width: keyWidth(cell.w) }}
                  onPointerDown={e => {
                    e.preventDefault();
                    if (active) setShiftLatched(v => !v);
                  }}
                >
                  {cell.label}
                </button>
              );
            }

            const isLetter = /[a-z]/.test(cell.base);
            const isTarget = targetBase === cell.base;
            return (
              <button
                key={cell.base}
                type="button"
                tabIndex={-1}
                aria-label={cell.shift ? `${cell.base} or ${cell.shift}` : cell.base.toUpperCase()}
                className={cx(
                  'key',
                  `f-${FINGER_GROUP[cell.finger]}`,
                  !inMode(cell) && 'off',
                  (cell.base === 'f' || cell.base === 'j') && 'home',
                  isTarget && 'target',
                  isTarget && pulse && 'assist',
                  flash?.base === cell.base && flash.kind,
                )}
                style={{ width: keyWidth(cell.w) }}
                onPointerDown={e => {
                  // tapping a key counts as typing it (touch screens / no keyboard)
                  e.preventDefault();
                  const ch = shiftLatched && cell.shift ? cell.shift : cell.base;
                  setShiftLatched(false);
                  onTap(ch);
                }}
              >
                {cell.shift && <span className="shift-label">{cell.shift}</span>}
                <span className="base-label">{isLetter ? cell.base.toUpperCase() : cell.base}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="legend">
        {(['pinky', 'ring', 'middle', 'index'] as const).map(g => (
          <span key={g} style={{ ['--sw' as string]: `var(--f-${g})` }}>
            {g[0].toUpperCase() + g.slice(1)}
          </span>
        ))}
        <span className="no-swatch">Bumps on F and J mark the home keys</span>
        {usesShift && <span className="no-swatch">Small top symbol = hold Shift</span>}
      </div>
    </section>
  );
}
