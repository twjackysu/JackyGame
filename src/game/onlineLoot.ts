// 線上版的 PvE 掉落回報（第 146 輪，D-307）：離線版什麼都不做（建置時整段被拿掉）。
// 線上版：進場 battle.start、每打倒一隻會掉東西的怪就 loot.claim——掉落由伺服器擲、直接入伺服器的角色。
// 過渡期：畫面上的掉落與本機存檔照舊（之後畫面改讀伺服器的角色，舊 key 才退場）；回報失敗（速度上限、斷線）只記 console，不影響遊戲。
import { hasLoot } from '../core/battle/rt/loot';
import type { Unit } from '../core/battle/rt/types';
import type { BountyDoneView, CharacterView, LootDropView, WeaponView } from '../net/views';
import type { GameClient } from '../client/GameClient';
import { bootServer } from '../client/boot';
import { onlineActive } from '../client/onlineClient';
import { characterCache } from '../client/characterCache';
import { mirrorToLegacy } from '../client/legacyMirror';

let battle: Promise<{ characterId: string; battleId: string } | null> = Promise.resolve(null);
let seq = 0;
/** 每次 loot.claim 回來（懸賞進度／完成，第 147 輪）；換場景時 start 換掉 */
let onClaim: OnSynced | null = null;
/** 伺服器的角色更新了（懸賞完成、掉落）；場景重讀行囊 */
export type OnSynced = (done: BountyDoneView[], enemyId: string, drops: LootDropView[]) => void;
let chain: Promise<unknown> = Promise.resolve();
/** 除錯：回報了幾隻、拿到幾筆掉落、最後的錯誤 */
export const onlineLootStatus = { claims: 0, drops: 0, chests: 0, error: null as string | null };

/** 伺服器的角色回來：更新快取＋舊 key 的行囊／錢包（第 147 輪：還沒改讀快取的畫面照舊讀舊 key），再通知場景 */
function synced(v: CharacterView, ticket: number, done: BountyDoneView[] = [], enemyId = '', drops: LootDropView[] = []): void {
  characterCache.set(v, ticket);
  if (characterCache.get() !== v) return; // 比較舊的回應：不寫
  try {
    mirrorToLegacy(localStorage, v, ['items', 'wallet']);
  } catch {
    /* 沒有 localStorage（測試） */
  }
  onClaim?.(done, enemyId, drops);
}

function story(op: (client: GameClient, characterId: string) => Promise<{ character: CharacterView }>, weapon: WeaponView): void {
  chain = chain.then(async () => {
    try {
      const { client } = await bootServer();
      const me = await onlineActive(client, weapon);
      const ticket = characterCache.ticket();
      const r = await op(client, me.id);
      synced(r.character, ticket);
    } catch (e) {
      onlineLootStatus.error = e instanceof Error ? e.message : String(e);
      console.warn('[story]', onlineLootStatus.error);
    }
  });
}

export const onlineLoot = {
  start(stageId: string, night: boolean, weapon: WeaponView, claimed?: OnSynced): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    seq = 0;
    onClaim = claimed ?? null;
    battle = (async () => {
      try {
        const { client } = await bootServer();
        const me = await onlineActive(client, weapon);
        // 進場先把伺服器的行囊／錢包換進舊 key（本機之前留下的不算數）
        synced(me, characterCache.ticket());
        const { battleId } = await client.call('battle.start', { characterId: me.id, stageId, night });
        return { characterId: me.id, battleId };
      } catch (e) {
        onlineLootStatus.error = e instanceof Error ? e.message : String(e);
        return null;
      }
    })();
  },

  /** 開了寶箱（第 147 輪）：內容由伺服器照地圖資料給 */
  chest(chestId: string): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    const b = battle;
    chain = chain.then(async () => {
      const cur = await b;
      if (!cur) return;
      try {
        const { client } = await bootServer();
        const ticket = characterCache.ticket();
        const r = await client.call('loot.chest', { ...cur, chestId });
        synced(r.character, ticket);
        onlineLootStatus.chests++;
      } catch (e) {
        onlineLootStatus.error = e instanceof Error ? e.message : String(e);
        console.warn('[loot.chest]', onlineLootStatus.error);
      }
    });
  },

  /** 路上的相遇（第 147 輪）：選擇與回禮由伺服器記帳、發獎勵（不用等這場的 battle.start） */
  meet(encounterId: string, pick: 'take' | 'spare', weapon: WeaponView): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    story((client, characterId) => client.call('story.meet', { characterId, encounterId, pick }), weapon);
  },
  thanks(encounterId: string, weapon: WeaponView): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    story((client, characterId) => client.call('story.thanks', { characterId, encounterId }), weapon);
  },

  kill(u: Unit): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    if (u.side !== 'enemy' || u.summonedBy || !hasLoot(u.defId)) return;
    const killSeq = ++seq;
    const kill = { enemyId: u.defId, ...(u.groupId ? { groupId: u.groupId } : {}), ...(u.fixedIdx !== undefined ? { fixedIdx: u.fixedIdx } : {}), ...(u.fury ? { fury: true } : {}), ...(u.affix ? { affix: true } : {}) };
    const b = battle;
    chain = chain.then(async () => {
      const cur = await b;
      if (!cur) return;
      try {
        const { client } = await bootServer();
        const ticket = characterCache.ticket();
        const r = await client.call('loot.claim', { ...cur, killSeq, ...kill });
        synced(r.character, ticket, r.bounty, kill.enemyId, r.drops);
        onlineLootStatus.claims++;
        onlineLootStatus.drops += r.drops.length;
      } catch (e) {
        onlineLootStatus.error = e instanceof Error ? e.message : String(e);
        console.warn('[loot.claim]', onlineLootStatus.error);
      }
    });
  },
};
