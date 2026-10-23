// 遊戲進行中的全域狀態（單例）：GameState + 自動存檔 + 目前劇本位置。
import { SaveStore, detectStorage } from '../core/save/save';
import { newGame, type GameState } from '../core/state/gameState';
import type { DialogueScript } from '../core/dialogue/runner';
import { CH0 } from '../data/dialogue/ch0';
import { CH1 } from '../data/dialogue/ch1';
import { CH2 } from '../data/dialogue/ch2';
import { CH3 } from '../data/dialogue/ch3';
import { CH4 } from '../data/dialogue/ch4';
import { CH5 } from '../data/dialogue/ch5';

export const SCRIPTS: Record<string, DialogueScript> = { ch0: CH0, ch1: CH1, ch2: CH2, ch3: CH3, ch4: CH4, ch5: CH5 };

const storage = detectStorage();
const store = new SaveStore(storage.kv);

let current: GameState | null = null;
let sessionStart = performance.now();

export const session = {
  get state(): GameState {
    if (!current) current = newGame();
    return current;
  },
  get persistent(): boolean {
    return storage.persistent;
  },
  hasSave(): boolean {
    return store.hasSave();
  },
  newGame(): GameState {
    current = newGame();
    sessionStart = performance.now();
    return current;
  },
  load(): GameState | null {
    current = store.load();
    sessionStart = performance.now();
    return current;
  },
  /** 自動存檔（劇本節點切換、戰鬥結束、切到背景時呼叫） */
  save(): boolean {
    if (!current) return false;
    const t = performance.now();
    current.playTimeMs += t - sessionStart;
    sessionStart = t;
    return store.save(current);
  },
  /** 劇本位置存在 flags 裡（存檔即包含） */
  setScriptPos(script: string, node: string): void {
    const s = session.state;
    s.flags['__script'] = script;
    s.flags['__node'] = node;
  },
  scriptPos(): { script: string; node: string } | null {
    const s = session.state;
    const script = s.flags['__script'];
    const node = s.flags['__node'];
    return typeof script === 'string' && typeof node === 'string' ? { script, node } : null;
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') session.save();
  });
}

/** 玩家可替同伴改名（目前只有伊歐）：預設名 → 存在 flags 的鍵 */
export const RENAMEABLE: Record<string, { def: string; flag: string; options: string[] }> = {
  io: { def: '伊歐', flag: 'name_io', options: ['伊歐', '露希', '霜鈴', '小星'] },
};

/** 把文字中的預設名替換成玩家取的名字 */
export function withNames(text: string): string {
  if (!current) return text;
  let out = text;
  for (const r of Object.values(RENAMEABLE)) {
    const v = current.flags[r.flag];
    if (typeof v === 'string' && v && v !== r.def) out = out.split(r.def).join(v);
  }
  return out;
}
