// 後端可移植層的「埠」：權威邏輯只依賴這些介面，不依賴瀏覽器。
// 本機（離線）版由 src/game 或 src/main.ts 提供實作；連線版在伺服器提供實作。
import type { Rng } from '../core/rng';

/** 隨機來源。離線與測試用可重現的種子版；連線版必須換成伺服器端的安全隨機。 */
export interface RandomProvider {
  /** [0, 1) 的浮點數 */
  nextFloat(): number;
  /** [min, max] 的整數（含兩端） */
  nextInt(min: number, max: number): number;
}

/** 用既有的種子亂數（core/rng.ts）包成 RandomProvider。 */
export function randomFromRng(rng: Rng): RandomProvider {
  return {
    nextFloat: () => rng(),
    nextInt: (min, max) => min + Math.floor(rng() * (max - min + 1)),
  };
}

/** 時間來源（毫秒時間戳）。不要在 src/server 直接呼叫 Date.now()。 */
export interface Clock {
  now(): number;
}

/** 玩家資產變動的事件紀錄（輕量版，不是完整 event sourcing）。 */
export interface JournalEvent {
  eventId: string;
  /** 重複送出同一個操作時用來去重 */
  operationId: string;
  type: string;
  timestamp: number;
  /** 當時使用的規則版本，之後才能解釋舊紀錄 */
  rulesVersion: number;
  details: Record<string, unknown>;
}

export interface EventJournal {
  append(event: JournalEvent): void;
  /** 此 operationId 是否已處理過 */
  has(operationId: string): boolean;
}

/** 存檔存取。離線版寫瀏覽器儲存，連線版寫資料庫。 */
export interface Repository<T> {
  load(): T | null;
  /** 必須是原子的：失敗時不能留下寫了一半的資料 */
  save(data: T): void;
}
