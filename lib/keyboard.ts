// US QWERTY layout, finger assignments and helpers for the on-screen keyboard.

export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp';
export type FingerGroup = 'pinky' | 'ring' | 'middle' | 'index';

export const FINGER_NAMES: Record<Finger, string> = {
  lp: 'left pinky', lr: 'left ring', lm: 'left middle', li: 'left index',
  ri: 'right index', rm: 'right middle', rr: 'right ring', rp: 'right pinky',
};

export const FINGER_GROUP: Record<Finger, FingerGroup> = {
  lp: 'pinky', rp: 'pinky', lr: 'ring', rr: 'ring',
  lm: 'middle', rm: 'middle', li: 'index', ri: 'index',
};

export const isLeftHand = (f: Finger) => f.startsWith('l');

export type SpecialId = 'backspace' | 'tab' | 'caps' | 'enter' | 'shiftL' | 'shiftR';

export type KeyCell =
  | { kind: 'char'; base: string; shift?: string; finger: Finger; w?: number }
  | { kind: 'special'; id: SpecialId; label: string; w: number };

const k = (base: string, shift: string | undefined, finger: Finger, w?: number): KeyCell =>
  ({ kind: 'char', base, shift, finger, w });

const letters = (chars: string, fingers: Finger[]): KeyCell[] =>
  [...chars].map((ch, i) => k(ch, undefined, fingers[i]));

const sp = (id: SpecialId, label: string, w: number): KeyCell => ({ kind: 'special', id, label, w });

// Every row adds up to 15 key-widths so the rows line up like a real keyboard.
export const ROWS: KeyCell[][] = [
  [
    k('`', '~', 'lp'), k('1', '!', 'lp'), k('2', '@', 'lr'), k('3', '#', 'lm'), k('4', '$', 'li'),
    k('5', '%', 'li'), k('6', '^', 'li'), k('7', '&', 'ri'), k('8', '*', 'rm'), k('9', '(', 'rr'),
    k('0', ')', 'rp'), k('-', '_', 'rp'), k('=', '+', 'rp'), sp('backspace', '⌫', 2),
  ],
  [
    sp('tab', 'Tab', 1.5),
    ...letters('qwertyuiop', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp']),
    k('[', '{', 'rp'), k(']', '}', 'rp'), k('\\', '|', 'rp', 1.5),
  ],
  [
    sp('caps', 'Caps', 1.75),
    ...letters('asdfghjkl', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr']),
    k(';', ':', 'rp'), k("'", '"', 'rp'), sp('enter', 'Enter', 2.25),
  ],
  [
    sp('shiftL', 'Shift', 2.25),
    ...letters('zxcvbnm', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri']),
    k(',', '<', 'rm'), k('.', '>', 'rr'), k('/', '?', 'rp'), sp('shiftR', 'Shift', 2.75),
  ],
];

export interface CharInfo {
  /** the unshifted character printed on the key */
  base: string;
  /** whether Shift must be held to type it */
  shift: boolean;
  finger: Finger;
}

export const CHAR_INFO: Record<string, CharInfo> = {};
for (const row of ROWS) {
  for (const cell of row) {
    if (cell.kind !== 'char') continue;
    CHAR_INFO[cell.base] = { base: cell.base, shift: false, finger: cell.finger };
    if (cell.shift) CHAR_INFO[cell.shift] = { base: cell.base, shift: true, finger: cell.finger };
  }
}

/** Shift key to use for a shifted character: the one on the opposite hand. */
export const shiftKeyFor = (finger: Finger): SpecialId => (isLeftHand(finger) ? 'shiftR' : 'shiftL');

/** Spoken names so small or look-alike characters are easy to identify. */
export const CHAR_NAMES: Record<string, string> = {
  '`': 'backtick', '~': 'tilde', '!': 'exclamation mark', '@': 'at sign', '#': 'hash',
  '$': 'dollar sign', '%': 'percent', '^': 'caret', '&': 'ampersand', '*': 'asterisk',
  '(': 'open bracket', ')': 'close bracket', '-': 'hyphen / minus', '_': 'underscore',
  '=': 'equals', '+': 'plus', '[': 'open square bracket', ']': 'close square bracket',
  '{': 'open curly brace', '}': 'close curly brace', '\\': 'backslash', '|': 'vertical bar',
  ';': 'semicolon', ':': 'colon', "'": 'apostrophe', '"': 'double quote', ',': 'comma',
  '.': 'full stop', '<': 'less than', '>': 'greater than', '/': 'forward slash', '?': 'question mark',
  '0': 'number zero', '1': 'number one', o: 'letter O', l: 'letter L', i: 'letter I',
};

const isLetter = (ch: string) => /^[a-z]$/i.test(ch);

/** Letters are matched case-insensitively; everything else must match exactly. */
export const normalizeKey = (key: string) => (isLetter(key) ? key.toLowerCase() : key);

export const displayChar = (ch: string) => (isLetter(ch) ? ch.toUpperCase() : ch);
