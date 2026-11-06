// 線上版的 PvE 掉落回報（第 146 輪，D-307）：離線版什麼都不做（建置時整段被拿掉）。
// 線上版：進場 battle.start、每打倒一隻會掉東西的怪就 loot.claim——掉落由伺服器擲、直接入伺服器的角色。
// 過渡期：畫面上的掉落與本機存檔照舊（之後畫面改讀伺服器的角色，舊 key 才退場）；回報失敗（速度上限、斷線）只記 console，不影響遊戲。
import { hasLoot } from '../core/battle/rt/loot';
import type { Unit } from '../core/battle/rt/types';
import type { WeaponView } from '../net/views';
import { bootServer } from '../client/boot';
import { onlineActive } from '../client/onlineClient';
import { characterCache } from '../client/characterCache';

let battle: Promise<{ characterId: string; battleId: string } | null> = Promise.resolve(null);
let seq = 0;
let chain: Promise<unknown> = Promise.resolve();
/** 除錯：回報了幾隻、拿到幾筆掉落、最後的錯誤 */
export const onlineLootStatus = { claims: 0, drops: 0, error: null as string | null };

export const onlineLoot = {
  start(stageId: string, night: boolean, weapon: WeaponView): void {
    if (!import.meta.env.VITE_SERVER_URL) return;
    seq = 0;
    battle = (async () => {
      try {
        const { client } = await bootServer();
        const me = await onlineActive(client, weapon);
        const { battleId } = await client.call('battle.start', { characterId: me.id, stageId, night });
        return { characterId: me.id, battleId };
      } catch (e) {
        onlineLootStatus.error = e instanceof Error ? e.message : String(e);
        return null;
      }
    })();
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
        characterCache.set(r.character, ticket);
        onlineLootStatus.claims++;
        onlineLootStatus.drops += r.drops.length;
      } catch (e) {
        onlineLootStatus.error = e instanceof Error ? e.message : String(e);
        console.warn('[loot.claim]', onlineLootStatus.error);
      }
    });
  },
};
