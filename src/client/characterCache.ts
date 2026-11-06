// 角色快取（第 147 輪，NEXT #2「畫面改讀伺服器的角色」第一步）：伺服器回來的 CharacterView 放這裡，畫面層讀它。
// 線上版：onlineActive（account.get＋character.list）、loot.claim、每個 legacyOp 的結果都會更新它——
// HUD 的等級／金幣／粉塵改讀快取，伺服器擲的掉落才看得到（D-307 之後本機算的數字和伺服器不一樣）。
// 離線版目前不用（畫面照舊讀舊 key；之後舊 key 退場時，離線版的來源是 migrate.sync 的結果，兩版走同一條）。
// 純資料、沒有 Phaser／DOM；舊的回應晚到不能蓋掉新的（用 rev 遞增判斷，同一個角色才比）。
import type { CharacterView, CurrencyId } from '../net/views';

type Listener = (v: CharacterView) => void;

let current: CharacterView | null = null;
let rev = 0;
const listeners = new Set<Listener>();

export const characterCache = {
  /** 目前角色（還沒拿到就是 null） */
  get(): CharacterView | null {
    return current;
  },
  /** 開始一個請求時拿號碼，回來時帶著它 set；比最後一次 set 的號碼舊就丟掉（例如兩個 loot.claim 回來順序顛倒） */
  ticket(): number {
    return ++rev;
  },
  set(v: CharacterView, ticket?: number): void {
    if (ticket !== undefined && current && current.id === v.id && ticket < lastSet) return;
    if (ticket !== undefined) lastSet = ticket;
    current = v;
    for (const l of listeners) l(v);
  },
  /** 換角色／登出 */
  clear(): void {
    current = null;
    lastSet = 0;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  wallet(c: CurrencyId): number | null {
    return current ? (current.wallet[c] ?? 0) : null;
  },
};

let lastSet = 0;
