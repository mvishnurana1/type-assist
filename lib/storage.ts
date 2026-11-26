// Settings and personal bests, kept in the browser's localStorage.
import { MODES, ROUND_LENGTHS, type ModeId } from './game';

export interface Settings {
  mode: ModeId;
  roundLen: number;
  showKeyboard: boolean;
  alwaysGuide: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'easy',
  roundLen: 50,
  showKeyboard: true,
  alwaysGuide: true,
  sound: false,
};

export interface BestRecord { score: number; avg: number; date: string }

export interface Store {
  settings?: Partial<Settings>;
  best: Record<string, BestRecord>;
}

const KEY = 'typeAssist.v2';

export function loadStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return { best: {}, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return { best: {} };
  }
}

export function saveStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

export function loadSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS, ...loadStore().settings };
  if (!(s.mode in MODES)) s.mode = DEFAULT_SETTINGS.mode;
  if (!(ROUND_LENGTHS as readonly number[]).includes(s.roundLen)) s.roundLen = DEFAULT_SETTINGS.roundLen;
  return s;
}

export function saveSettings(settings: Settings) {
  const store = loadStore();
  store.settings = settings;
  saveStore(store);
}

export const bestKey = (mode: ModeId, roundLen: number) => `${mode}-${roundLen}`;
