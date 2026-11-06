// 過渡期（D-285）：畫面層的一個動作 → 把「動作前」的舊 key 同步上去（migrate.sync）→ 呼叫伺服器 → 結果寫回舊 key。
// 畫面層照舊先用同一份 core/meta 規則立刻存檔與顯示（玩家看到的不變、伺服器壞掉也不影響單機）；伺服器說了算：
// 排隊的最後一個動作做完時，把伺服器的結果寫回舊 key，和畫面層算的不一樣就 console.warn（開發時抓規則分歧）。
// 快照一定要在畫面層存檔「之前」拿（captureLegacy），不然 sync 會先帶上新狀態、伺服器再做一次＝做兩次。
import type { CharacterView } from '../net/views';
import type { GameClient } from './GameClient';
import { bootServer, legacySnapshot } from './boot';
import { mirrorRecord, MIRROR_KEY, type MirrorField } from './legacyMirror';

let chain: Promise<unknown> = Promise.resolve();
let pending = 0;
/** 除錯：最後一次的錯誤／分歧（截圖腳本與 Playwright 檢查用） */
export const opStatus = { done: 0, error: null as string | null, diverged: 0 };

/** 動作前的舊存檔快照（畫面層不能直接碰 localStorage，D-281） */
export function captureLegacy(): Record<string, string> {
  try {
    return legacySnapshot(localStorage);
  } catch {
    return {};
  }
}

/**
 * before：動作前的快照；fields：要寫回的欄位；op：拿 client 與同步後的角色呼叫伺服器；viewOf：從結果拿出角色。
 * authoritative：畫面層沒有先算（強化擲骰只能伺服器做）→ 一律寫回、不算分歧。
 */
export function legacyOp<T>(
  before: Record<string, string>,
  fields: readonly MirrorField[],
  op: (client: GameClient, me: CharacterView) => Promise<T>,
  viewOf: (t: T) => CharacterView,
  authoritative = false,
): Promise<T | null> {
  pending++;
  const run = chain.then(async () => {
    try {
      const { client } = await bootServer();
      const me = await client.call('migrate.sync', { snapshot: before });
      const t = await op(client, me);
      const v = viewOf(t);
      if (pending === 1 || authoritative) {
        const cur = localStorage.getItem(MIRROR_KEY) ?? '{}';
        const rec = JSON.parse(cur) as Record<string, unknown>;
        const next = JSON.stringify(mirrorRecord(rec, v, fields));
        if (next !== JSON.stringify(rec)) {
          if (!authoritative) {
            opStatus.diverged++;
            const nx = JSON.parse(next) as Record<string, unknown>;
            const keys = Object.keys(nx).filter((k) => JSON.stringify(nx[k]) !== JSON.stringify(rec[k]));
            console.warn('[legacyOp] 伺服器結果和畫面層不同，以伺服器為準', keys.map((k) => `${k}: ${JSON.stringify(rec[k])} → ${JSON.stringify(nx[k])}`).join('；').slice(0, 600));
          }
          localStorage.setItem(MIRROR_KEY, next);
        }
      }
      opStatus.done++;
      opStatus.error = null;
      return t;
    } catch (e) {
      opStatus.error = e instanceof Error ? e.message : String(e);
      console.warn('[legacyOp]', opStatus.error);
      return null;
    } finally {
      pending--;
    }
  });
  chain = run;
  return run;
}

/** 排在面板動作同一條佇列後面執行（換角色等，D-302）；錯誤照樣丟給呼叫的人 */
export function legacySerial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}
