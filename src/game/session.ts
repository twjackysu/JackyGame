// 遊戲進行中的全域狀態（單例）：GameState + 自動存檔 + 目前劇本位置。
import { SaveStore, detectStorage } from '../core/save/save';
import { newGame, type GameState } from '../core/state/gameState';
import { drawSeed, newRngState, streamRng, type RngStream } from '../core/rngStreams';
import type { Rng } from '../core/rng';
import { KvEventJournal, systemClock } from '../core/save/localPorts';
import { LocalGameApi } from '../server/localGameApi';
import type { GameApi } from '../server/gameApi';
import type { DialogueScript } from '../core/dialogue/runner';
import { CH0 } from '../data/dialogue/ch0';
import { CH1 } from '../data/dialogue/ch1';
import { CH2 } from '../data/dialogue/ch2';
import { CH3 } from '../data/dialogue/ch3';
import { CH4 } from '../data/dialogue/ch4';
import { CH5 } from '../data/dialogue/ch5';
import { DATES } from '../data/dialogue/dates';
import { CAMP } from '../data/dialogue/camp';

export const SCRIPTS: Record<string, DialogueScript> = { ch0: CH0, ch1: CH1, ch2: CH2, ch3: CH3, ch4: CH4, ch5: CH5, camp: CAMP, dates: DATES };

const storage = detectStorage();
const store = new SaveStore(storage.kv);

let current: GameState | null = null;

/** 新存檔的種子：只在建立存檔時取一次真亂數，之後一切由種子決定 */
function freshSeed(): number {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0]!;
  } catch {
    return (Math.random() * 4294967296) >>> 0;
  }
}
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
    current = newGame(Date.now(), freshSeed());
    sessionStart = performance.now();
    return current;
  },
  /** 換成指定的狀態（例：二週目） */
  replace(s: GameState): GameState {
    current = s;
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
  /** 依用途的可重現亂數（存檔內含種子與計數器；design/14 階段 1.1） */
  rng(stream: RngStream): Rng {
    const s = session.state;
    if (!s.rng) s.rng = newRngState(freshSeed());
    return streamRng(s.rng, stream);
  },
  /** 從某個 stream 抽一個種子，給戰鬥引擎／燼牌／掉落表使用 */
  seed(stream: RngStream): number {
    const s = session.state;
    if (!s.rng) s.rng = newRngState(freshSeed());
    return drawSeed(s.rng, stream);
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

/**
 * 改變玩家資產（金幣、裝備、道具）的唯一入口（design/14 階段 1.5）。
 * 場景與 UI 不直接改 inventory／gear／gold；連線版只要把這裡換成 RemoteGameApi。
 */
export const gameApi: GameApi = new LocalGameApi(() => session.state, new KvEventJournal(storage.kv), systemClock);

let opSeq = 0;
/** 產生 operationId（同一次點擊只產生一次；重送同一個 id 不會重複生效） */
export function opId(kind: string): string {
  opSeq = (opSeq + 1) % 1e9;
  return `${kind}-${Date.now().toString(36)}-${opSeq.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

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
