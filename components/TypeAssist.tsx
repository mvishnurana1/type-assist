'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import Keyboard from './Keyboard';
import {
  ASSIST_DELAY_MS, MODES, MODE_IDS, ROUND_LENGTHS,
  computeStats, gameReducer, initialState, rating, troubleChars,
  type ModeId, type TroubleChar,
} from '@/lib/game';
import {
  CHAR_INFO, CHAR_NAMES, FINGER_GROUP, FINGER_NAMES,
  displayChar, isLeftHand, normalizeKey, type Finger,
} from '@/lib/keyboard';
import {
  DEFAULT_SETTINGS, bestKey, loadSettings, loadStore, saveSettings, saveStore, type Settings,
} from '@/lib/storage';

const secs = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(2)} s`);

interface Summary {
  score: number;
  avg: number | null;
  lpm: number | null;
  acc: number | null;
  bestStreak: number;
  prevBest: number | null;
  newBest: boolean;
  trouble: TroubleChar[];
  mode: ModeId;
}

function FingerChip({ finger }: { finger: Finger }) {
  return (
    <span className="chip" style={{ background: `var(--f-${FINGER_GROUP[finger]})` }}>
      {FINGER_NAMES[finger]} finger
    </span>
  );
}

function GuideText({ ch }: { ch: string }) {
  const info = CHAR_INFO[ch];
  if (!info) return null;
  return (
    <>
      Use your <FingerChip finger={info.finger} />
      {info.shift && (
        <> and hold the <strong>{isLeftHand(info.finger) ? 'right' : 'left'} Shift</strong> key</>
      )}
    </>
  );
}

function TroubleList({ items }: { items: TroubleChar[] }) {
  return (
    <>
      {items.map(t => (
        <span className="tl" key={t.ch}>
          <b>{displayChar(t.ch)}</b>
          <small>
            {secs(t.avg)}
            {t.misses > 0 && ` · ${t.misses} miss${t.misses > 1 ? 'es' : ''}`}
          </small>
        </span>
      ))}
    </>
  );
}

function summaryMessage(s: Summary) {
  if (s.newBest && s.prevBest !== null) return `You beat your old best of ${s.prevBest}. Great progress!`;
  if (s.prevBest === null) return 'Your first round on this setting. This is the score to beat.';
  if ((s.acc ?? 100) < 85) return 'Try slowing down a little: accuracy builds speed.';
  if (s.mode === 'hard') return 'Symbols take practice. Remember to hold Shift with the opposite hand.';
  if ((s.avg ?? 0) > 1500) return 'Keep your fingers resting on the home row (the bumps on F and J) between letters.';
  return `Your best here is ${s.prevBest}. Keep practising and you'll get there!`;
}

/** Short beep for right/wrong answers. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((ok: boolean) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = (ctxRef.current ??= new Ctx());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = ok ? 880 : 220;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.25));
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.3);
    } catch {
      /* audio unavailable */
    }
  }, []);
}

export default function TypeAssist() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initialState(DEFAULT_SETTINGS.mode, DEFAULT_SETTINGS.roundLen),
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const statusRef = useRef(state.status);
  const beep = useBeep();

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  // load saved settings once on the client
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    dispatch({ type: 'configure', mode: s.mode, roundLen: s.roundLen });
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (patch.mode !== undefined || patch.roundLen !== undefined) {
      dispatch({ type: 'configure', mode: next.mode, roundLen: next.roundLen });
    }
  };

  const startRound = useCallback(() => {
    dialogRef.current?.close();
    dispatch({ type: 'start', now: performance.now(), rand: Math.random() });
  }, []);

  // physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (dialogRef.current?.open) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          startRound();
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      const inField = !!target?.matches?.('select, input');
      if (e.key === ' ') {
        if (inField) return;
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        dispatch({ type: 'toggle', now: performance.now(), rand: Math.random() });
        return;
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'pause' });
        return;
      }
      if (e.key.length !== 1) return; // Shift, Tab, arrows, dead keys…
      const status = statusRef.current;
      if (status !== 'running' && status !== 'paused') return; // let selects use type-to-choose when idle
      e.preventDefault();
      if (e.repeat) return;
      dispatch({ type: 'press', ch: normalizeKey(e.key), now: performance.now(), rand: Math.random() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startRound]);

  // pause when the window loses focus
  useEffect(() => {
    const pause = () => dispatch({ type: 'pause' });
    const onVis = () => document.hidden && pause();
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // reveal the guide if the player is stuck
  useEffect(() => {
    if (state.status !== 'running' || state.assisted) return;
    const seq = state.seq;
    const t = setTimeout(() => dispatch({ type: 'assist', seq }), ASSIST_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.status, state.seq, state.assisted]);

  // sound
  useEffect(() => {
    if (state.feedback && settings.sound) beep(state.feedback.kind === 'good');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.feedback?.id]);

  // end of round: save personal best and open the summary
  useEffect(() => {
    if (state.status !== 'finished') return;
    const stats = computeStats(state);
    const store = loadStore();
    const key = bestKey(state.mode, state.roundLen);
    const prevBest = store.best[key]?.score ?? null;
    const newBest = prevBest === null || state.score > prevBest;
    if (newBest) {
      store.best[key] = { score: state.score, avg: stats.avg ?? 0, date: new Date().toISOString() };
      saveStore(store);
    }
    setSummary({
      score: state.score, ...stats, bestStreak: state.bestStreak,
      prevBest, newBest, trouble: troubleChars(state, 4), mode: state.mode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.roundId]);

  useEffect(() => {
    const d = dialogRef.current;
    if (summary && d && !d.open) d.showModal();
  }, [summary]);

  // ---------- derived view values ----------
  const { avg, lpm, acc } = computeStats(state);
  const playing = state.status === 'running' || state.status === 'paused';
  const showGuide = state.status === 'running' && (settings.alwaysGuide || state.assisted);
  const fb = state.feedback;
  const current = state.current;
  const len = state.roundLen;
  const trouble = state.correct >= 10 ? troubleChars(state, 5) : [];

  let letterText = '?';
  if (state.status === 'finished') letterText = '✓';
  else if (playing && current) letterText = displayChar(current);
  const caption = playing && current && state.mode === 'hard' ? CHAR_NAMES[current] : undefined;

  let hint: ReactNode;
  if (state.status === 'idle') hint = <>Press <kbd>Space</kbd> or click <strong>Start</strong> to begin.</>;
  else if (state.status === 'paused') hint = <>Paused. Press <kbd>Space</kbd> to carry on.</>;
  else if (state.status === 'finished') hint = <>Round complete! Press <kbd>Space</kbd> to play again.</>;
  else if (state.wrongKey && current) {
    hint = (
      <>
        That was <kbd>{displayChar(state.wrongKey)}</kbd>. Find <kbd>{displayChar(current)}</kbd>:{' '}
        <GuideText ch={current} />
      </>
    );
  } else if (showGuide && current) hint = <GuideText ch={current} />;
  else hint = ' ';

  return (
    <>
      <header className="top">
        <h1>Type&nbsp;Assist</h1>
        <div className="controls">
          <label>
            Round
            <select
              value={settings.roundLen}
              onChange={e => {
                update({ roundLen: Number(e.target.value) });
                e.target.blur();
              }}
            >
              {ROUND_LENGTHS.map(n => (
                <option key={n} value={n}>{n ? `${n} characters` : 'Endless'}</option>
              ))}
            </select>
          </label>
          {([
            ['showKeyboard', 'Keyboard', undefined],
            ['alwaysGuide', 'Always show guide', 'When off, the key and finger only appear if you get stuck or press the wrong key'],
            ['sound', 'Sound', undefined],
          ] as const).map(([id, label, title]) => (
            <label className="check" key={id} title={title}>
              <input
                type="checkbox"
                checked={settings[id]}
                onChange={e => {
                  update({ [id]: e.target.checked });
                  e.target.blur();
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </header>

      <main>
        <section className="scoreboard" aria-label="Running score">
          <div className="stat stat-score">
            <span className="label">Score</span>
            <span key={state.score} className={`value ${state.score ? 'bump' : ''}`}>{state.score}</span>
          </div>
          <div className="stat"><span className="label">Last</span><span className="value">{secs(state.lastMs)}</span></div>
          <div className="stat"><span className="label">Average</span><span className="value">{secs(avg)}</span></div>
          <div className="stat"><span className="label">Chars / min</span><span className="value">{lpm === null ? '–' : Math.round(lpm)}</span></div>
          <div className="stat"><span className="label">Accuracy</span><span className="value">{acc === null ? '–' : `${Math.round(acc)}%`}</span></div>
          <div className="stat"><span className="label">Streak</span><span className="value">{state.streak}</span></div>
        </section>

        <section className="stage">
          <div className="modes" role="radiogroup" aria-label="Difficulty">
            {MODE_IDS.map(id => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={settings.mode === id}
                className={`mode mode-${id} ${settings.mode === id ? 'active' : ''}`}
                onClick={e => {
                  update({ mode: id });
                  e.currentTarget.blur();
                }}
              >
                <span className="mode-name">{MODES[id].label}</span>
                <span className="mode-blurb">{MODES[id].blurb}</span>
              </button>
            ))}
          </div>

          <div className="progress-row">
            <div className="progress" aria-hidden="true">
              <div className="progress-bar" style={{ width: len ? `${(state.correct / len) * 100}%` : 0 }} />
            </div>
            <span className="progress-text">
              {len ? `${state.correct} / ${len}` : `${state.correct}`} characters
            </span>
          </div>

          <div className={`letter-box ${!playing ? 'idle' : ''} ${state.status === 'paused' ? 'paused' : ''}`}>
            {fb?.kind === 'good' && (
              <div key={`p${fb.id}`} className="popup" aria-hidden="true">
                <span className="pts">+{fb.pts}</span>
                <span className="rating">{rating(fb.ms)}</span>
              </div>
            )}
            {fb && playing && <div key={`r${fb.id}`} className={`ring ${fb.kind}`} aria-hidden="true" />}
            <div
              key={fb?.kind === 'bad' ? `s${fb.id}` : 'steady'}
              className={`letter ${fb?.kind === 'bad' && playing ? 'shake' : ''}`}
              aria-live="assertive"
              aria-atomic="true"
            >
              {letterText}
            </div>
            {caption && <div className="caption">{caption}</div>}
          </div>

          <p className="hint">{hint}</p>

          <div className="buttons">
            <button
              type="button"
              onClick={e => {
                dispatch({ type: 'toggle', now: performance.now(), rand: Math.random() });
                e.currentTarget.blur();
              }}
            >
              {state.status === 'running' ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Start'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={e => {
                dispatch({ type: 'reset' });
                e.currentTarget.blur();
              }}
            >
              Reset
            </button>
          </div>
        </section>

        {settings.showKeyboard && (
          <Keyboard
            chars={MODES[state.mode].chars}
            target={current}
            showTarget={showGuide}
            pulse={state.assisted}
            feedback={fb}
            onTap={ch => dispatch({ type: 'press', ch, now: performance.now(), rand: Math.random() })}
          />
        )}

        <section className="trouble" aria-live="polite">
          {state.correct >= 10 &&
            (trouble.length ? (
              <>Coming up more often to help you practise: <TroubleList items={trouble} /></>
            ) : (
              'No trouble characters right now. Keep it up!'
            ))}
        </section>
      </main>

      <dialog ref={dialogRef} className="summary">
        {summary && (
          <>
            <h2>{summary.newBest && summary.prevBest !== null ? 'New personal best!' : 'Round complete'}</h2>
            <p className="summary-msg">
              {MODES[summary.mode].label} mode · {summaryMessage(summary)}
            </p>
            <div className="summary-grid">
              <div><span className="label">Score</span><span className="value">{summary.score}</span></div>
              <div><span className="label">Average</span><span className="value">{secs(summary.avg)}</span></div>
              <div><span className="label">Chars / min</span><span className="value">{Math.round(summary.lpm ?? 0)}</span></div>
              <div><span className="label">Accuracy</span><span className="value">{Math.round(summary.acc ?? 0)}%</span></div>
              <div><span className="label">Best streak</span><span className="value">{summary.bestStreak}</span></div>
              <div>
                <span className="label">Personal best</span>
                <span className={`value ${summary.newBest ? 'new-best' : ''}`}>
                  {summary.newBest ? summary.score : summary.prevBest}
                </span>
              </div>
            </div>
            <div className="sum-trouble">
              {summary.trouble.length ? (
                <>To practise: <TroubleList items={summary.trouble} /></>
              ) : summary.mode === 'hard' ? (
                'Every character was quick and clean. Impressive!'
              ) : (
                'Every character was quick and clean. Try the next mode up!'
              )}
            </div>
            <div className="buttons">
              <button type="button" onClick={startRound}>Play again</button>
              <button type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
                Close
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
