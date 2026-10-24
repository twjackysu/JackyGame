// 存讀檔（版本化 + migration + 備份）。見 docs/design/06-tech-architecture.md §3.5。
import { SAVE_VERSION, newGame, type GameState } from '../state/gameState';
import { migrateGearV1 } from '../state/gear';
import { hashSeed } from '../rng';
import { newRngState } from '../rngStreams';

/** 最小 Storage 介面（localStorage 相容），方便測試注入。 */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTO_KEY = 'jackygame.save.v1.auto';
export const BAK_KEY = AUTO_KEY + '.bak';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] 把 version n 升到 n+1。 */
const migrations: Record<number, Migration> = {
  // v1 → v2：裝備實例化（design/14 階段 1.2）
  1: (raw) => {
    if (!raw.rng || typeof raw.rng !== 'object') raw.rng = newRngState(hashSeed(`migrate:${String(raw.createdAt ?? 0)}`));
    if (!raw.inventory || typeof raw.inventory !== 'object') raw.inventory = {};
    if (!raw.members || typeof raw.members !== 'object') raw.members = {};
    migrateGearV1(raw as unknown as GameState);
    return raw;
  },
};

/** 舊版存檔升級前的原始內容存在這裡（升級失敗或之後出問題時可以救回） */
export const preMigrationKey = (version: number): string => `${AUTO_KEY}.pre-v${version + 1}`;

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(text: string): GameState | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') return null;
  let v = raw.version as number;
  if (v > SAVE_VERSION) return null; // 新版存檔，舊版遊戲讀不了
  while (v < SAVE_VERSION) {
    const m = migrations[v];
    if (!m) return null;
    try {
      raw = m(raw);
    } catch {
      return null; // 升級失敗：呼叫端保留原存檔
    }
    v++;
    raw.version = v;
  }
  // 以新遊戲為底補齊缺漏欄位（未來加欄位時舊檔不會壞）
  const base = newGame(0) as unknown as Record<string, unknown>;
  return { ...base, ...raw } as unknown as GameState;
}

/** 記憶體 KV：localStorage 不可用（隱私模式）時的退路。 */
export class MemoryKV implements KV {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

export function detectStorage(): { kv: KV; persistent: boolean } {
  try {
    const ls = globalThis.localStorage;
    const probe = '__jg_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { kv: ls, persistent: true };
  } catch {
    return { kv: new MemoryKV(), persistent: false };
  }
}

export class SaveStore {
  constructor(private kv: KV) {}

  save(s: GameState): boolean {
    try {
      const prev = this.kv.getItem(AUTO_KEY);
      if (prev) this.kv.setItem(BAK_KEY, prev);
      this.kv.setItem(AUTO_KEY, serialize(s));
      return true;
    } catch {
      return false; // 空間不足等：不讓遊戲崩潰
    }
  }

  /** 讀主檔；壞掉就讀備份。 */
  load(): GameState | null {
    for (const key of [AUTO_KEY, BAK_KEY]) {
      const t = this.kv.getItem(key);
      if (!t) continue;
      this.keepPreMigration(t);
      const s = deserialize(t);
      if (s) return s;
    }
    return null;
  }

  /** 舊版本存檔：第一次讀到時把原文另存一份（只存一次，不覆蓋） */
  private keepPreMigration(text: string): void {
    try {
      const v = (JSON.parse(text) as { version?: unknown }).version;
      if (typeof v !== 'number' || v >= SAVE_VERSION) return;
      const k = preMigrationKey(v);
      if (!this.kv.getItem(k)) this.kv.setItem(k, text);
    } catch {
      /* 壞檔或空間不足：不影響讀檔 */
    }
  }

  hasSave(): boolean {
    return this.load() !== null;
  }

  clear(): void {
    this.kv.removeItem(AUTO_KEY);
    this.kv.removeItem(BAK_KEY);
  }
}
