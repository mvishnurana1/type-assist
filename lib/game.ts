// Pure game logic: modes, scoring, adaptive character picking and a reducer.
import { CHAR_INFO } from './keyboard';

export type ModeId = 'easy' | 'medium' | 'hard';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~';

export interface ModeDef {
  label: string;
  blurb: string;
  chars: string;
  /** score multiplier, so harder modes are worth more */
  multiplier: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  easy: { label: 'Easy', blurb: 'Home row letters', chars: 'asdfghjkl', multiplier: 1 },
  medium: { label: 'Medium', blurb: 'All 26 letters', chars: LETTERS, multiplier: 1.5 },
  hard: { label: 'Hard', blurb: 'Letters, numbers & symbols', chars: LETTERS + DIGITS + SYMBOLS, multiplier: 2 },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];
export const ROUND_LENGTHS = [25, 50, 100, 0] as const; // 0 = endless
export const ASSIST_DELAY_MS = 2500;
const SHIFT_GRACE_MS = 400; // extra time allowed for characters that need Shift

export interface LetterStat { n: number; total: number; misses: number }

export interface Feedback {
  id: number;
  kind: 'good' | 'bad';
  ch: string;
  pts: number;
  ms: number;
}

export type Status = 'idle' | 'running' | 'paused' | 'finished';

export interface GameState {
  status: Status;
  mode: ModeId;
  roundLen: number;
  roundId: number;
  current: string | null;
  prev: string | null;
  /** increments every time a new character is shown */
  seq: number;
  shownAt: number;
  missesThisLetter: number;
  assisted: boolean;
  wrongKey: string | null;
  score: number;
  correct: number;
  presses: number;
  streak: number;
  bestStreak: number;
  activeMs: number;
  times: number[];
  perLetter: Record<string, LetterStat>;
  lastMs: number | null;
  feedback: Feedback | null;
  eventId: number;
}

export type Action =
  | { type: 'configure'; mode: ModeId; roundLen: number }
  | { type: 'reset' }
  | { type: 'start'; now: number; rand: number }
  | { type: 'toggle'; now: number; rand: number }
  | { type: 'pause' }
  | { type: 'resume'; now: number }
  | { type: 'assist'; seq: number }
  | { type: 'press'; ch: string; now: number; rand: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function initialState(mode: ModeId, roundLen: number): GameState {
  return {
    status: 'idle', mode, roundLen, roundId: 0,
    current: null, prev: null, seq: 0, shownAt: 0, missesThisLetter: 0, assisted: false, wrongKey: null,
    score: 0, correct: 0, presses: 0, streak: 0, bestStreak: 0, activeMs: 0, times: [], perLetter: {},
    lastMs: null, feedback: null, eventId: 0,
  };
}

/**
 * Points for one correct character: up to 100 for speed (full marks at ≤0.3 s,
 * a floor of 10 at about 2.7 s), halved if you missed first, plus a streak bonus,
 * all multiplied by the mode's multiplier.
 */
export function pointsFor(ms: number, ch: string, firstTry: boolean, streak: number, mode: ModeId) {
  const grace = CHAR_INFO[ch]?.shift ? SHIFT_GRACE_MS : 0;
  const speed = clamp(Math.round(100 - (ms - grace - 300) / 27), 10, 100);
  return Math.round((speed * (firstTry ? 1 : 0.5) + Math.min(streak, 20) * 2) * MODES[mode].multiplier);
}

export function rating(ms: number) {
  if (ms < 500) return 'Lightning!';
  if (ms < 800) return 'Fast!';
  if (ms < 1200) return 'Nice';
  if (ms < 2000) return 'Good';
  return 'Got it';
}

/** Characters you're slower on, or miss more, come up more often. */
function pickChar(state: GameState, rand: number): string {
  const all = [...MODES[state.mode].chars];
  const pool = all.length > 1 ? all.filter(c => c !== state.current) : all;
  const overall = state.times.length ? mean(state.times) : null;
  const weights = pool.map(c => {
    const s = state.perLetter[c];
    if (!s || !s.n) return 2; // unseen characters get extra exposure
    let w = 1;
    if (overall) w += Math.max(-0.5, s.total / s.n / overall - 1) * 1.5;
    w += (s.misses / s.n) * 2;
    return clamp(w, 0.5, 4);
  });
  let r = rand * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function showNext(state: GameState, now: number, rand: number): GameState {
  return {
    ...state,
    prev: state.current,
    current: pickChar(state, rand),
    seq: state.seq + 1,
    shownAt: now,
    missesThisLetter: 0,
    assisted: false,
    wrongKey: null,
  };
}

function start(state: GameState, now: number, rand: number): GameState {
  const fresh = initialState(state.mode, state.roundLen);
  return showNext(
    { ...fresh, status: 'running', roundId: state.roundId + 1, eventId: state.eventId, seq: state.seq },
    now,
    rand,
  );
}

function resume(state: GameState, now: number): GameState {
  if (state.status !== 'paused') return state;
  // restart the clock for the current character
  return { ...state, status: 'running', shownAt: now, assisted: false };
}

function press(state: GameState, ch: string, now: number, rand: number): GameState {
  if (state.status === 'paused') return resume(state, now);
  if (state.status !== 'running' || !state.current) return state;

  const presses = state.presses + 1;
  const eventId = state.eventId + 1;

  if (ch !== state.current) {
    return {
      ...state, presses, eventId,
      missesThisLetter: state.missesThisLetter + 1,
      streak: 0,
      assisted: true,
      wrongKey: ch,
      feedback: { id: eventId, kind: 'bad', ch, pts: 0, ms: 0 },
    };
  }

  const ms = now - state.shownAt;
  const firstTry = state.missesThisLetter === 0;
  const prevStat = state.perLetter[ch] ?? { n: 0, total: 0, misses: 0 };
  const streak = firstTry ? state.streak + 1 : 0;
  const pts = pointsFor(ms, ch, firstTry, streak, state.mode);

  const updated: GameState = {
    ...state,
    presses,
    eventId,
    perLetter: {
      ...state.perLetter,
      [ch]: { n: prevStat.n + 1, total: prevStat.total + ms, misses: prevStat.misses + state.missesThisLetter },
    },
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    correct: state.correct + 1,
    activeMs: state.activeMs + ms,
    times: [...state.times, ms],
    score: state.score + pts,
    lastMs: ms,
    feedback: { id: eventId, kind: 'good', ch, pts, ms },
  };

  if (state.roundLen && updated.correct >= state.roundLen) {
    return { ...updated, status: 'finished', wrongKey: null, assisted: false };
  }
  return showNext(updated, now, rand);
}

export function gameReducer(state: GameState, action: Action): GameState {
  const keep = { roundId: state.roundId, eventId: state.eventId, seq: state.seq };
  switch (action.type) {
    case 'configure':
      return { ...initialState(action.mode, action.roundLen), ...keep };
    case 'reset':
      return { ...initialState(state.mode, state.roundLen), ...keep };
    case 'start':
      return start(state, action.now, action.rand);
    case 'toggle':
      if (state.status === 'running') return { ...state, status: 'paused' };
      if (state.status === 'paused') return resume(state, action.now);
      return start(state, action.now, action.rand);
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return resume(state, action.now);
    case 'assist':
      return state.status === 'running' && action.seq === state.seq ? { ...state, assisted: true } : state;
    case 'press':
      return press(state, action.ch, action.now, action.rand);
  }
}

export interface Stats { avg: number | null; lpm: number | null; acc: number | null }

export function computeStats(state: GameState): Stats {
  return {
    avg: state.times.length ? mean(state.times) : null,
    lpm: state.activeMs > 0 ? state.correct / (state.activeMs / 60000) : null,
    acc: state.presses ? (state.correct / state.presses) * 100 : null,
  };
}

export interface TroubleChar { ch: string; avg: number; misses: number }

export function troubleChars(state: GameState, limit: number): TroubleChar[] {
  const overall = state.times.length ? mean(state.times) : 0;
  return Object.entries(state.perLetter)
    .map(([ch, s]) => ({ ch, avg: s.total / s.n, misses: s.misses, badness: s.total / s.n + (s.misses / s.n) * 600 }))
    .filter(x => x.avg > overall * 1.1 || x.misses > 0)
    .sort((a, b) => b.badness - a.badness)
    .slice(0, limit)
    .map(({ ch, avg, misses }) => ({ ch, avg, misses }));
}
