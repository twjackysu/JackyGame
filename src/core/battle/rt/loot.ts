// 打倒一隻怪的掉落擲骰（第 146 輪從 engine.rollDrops 抽出來，純函式）：
// - 單機／PvE 引擎：rand＝引擎的掉落亂數，place＝丟到地上（會再抽兩次亂數決定位置）——亂數順序和以前一模一樣（golden hash 不變）。
// - 伺服器 loot.claim（26-security §3.1）：rand＝伺服器自己的亂數，place 只記下來（不用位置）。客戶端只能說「我打倒了誰、在哪一群」，數量與稀有度由這裡決定。
import { ENEMIES } from './data';
import { stageDef } from './maps/world';
import type { LootId } from './types';

/** 精英群組 id（引擎與伺服器共用） */
export const HIDDEN_GROUP = 'hidden';
export const RIOT_GROUP = 'riot';

export interface LootContext {
  stageId: string;
  defId: string;
  /** 出生的群組（沒有＝固定怪或 Boss） */
  groupId?: string;
  /** 固定怪在關卡 enemies 的索引 */
  fixedIdx?: number;
  night: boolean;
  /** Boss 暴怒狀態被打倒 */
  fury: boolean;
  /** 有精英詞綴 */
  affix: boolean;
  /** 第一次打倒這隻（gearDrops.firstRare：第一件保底稀有） */
  firstKill: boolean;
}

export type LootPlace = (kind: LootId, amount: number, rarity?: 1 | 2 | 3) => void;

/** 這隻怪會不會掉東西（伺服器拿來擋「這張圖沒有這種怪」之外的空申請） */
export function hasLoot(defId: string): boolean {
  return !!ENEMIES[defId]?.drops;
}

export function rollEnemyLoot(c: LootContext, rand: () => number, place: LootPlace): void {
  const d = ENEMIES[c.defId]?.drops;
  if (!d) return;
  const st = stageDef(c.stageId);
  const nt = c.night ? st?.night : undefined;
  const g0 = c.groupId;
  const bonus = (g0 ? (nt?.lootPct ?? 0) : 0) + (!g0 ? 0 : g0 === RIOT_GROUP ? (st?.riot?.lootPct ?? 0) : g0 === HIDDEN_GROUP ? (st?.hiddenElite?.lootPct ?? 0) : (st?.spawnGroups?.find((g) => g.id === g0)?.lootPct ?? 0));
  const range = (r: [number, number]) => r[0] + Math.floor(rand() * (r[1] - r[0] + 1));
  const more = (n: number) => (bonus ? Math.round((n * (100 + bonus)) / 100) : n);
  const put: LootPlace = (kind, amount, rarity) => {
    if (amount > 0) place(kind, amount, rarity);
  };
  put('gold', more(range(d.gold)));
  for (const i of d.items ?? []) {
    if (rand() * 100 >= i.chance) continue;
    const n = i.count ? range(i.count) : 1;
    put(i.id, i.id === 'dust' ? more(n) : n);
  }
  // 裝備（D-091）：只有設了 gearDrops 的關卡才多抽（舊關卡掉落亂數序列不變）
  const gd = st?.gearDrops?.[c.defId];
  if (gd) {
    const hpPct = g0 ? (st?.spawnGroups?.find((g) => g.id === g0)?.hpPct ?? (g0 === HIDDEN_GROUP ? 100 : 0)) : c.fixedIdx !== undefined ? (st?.enemies[c.fixedIdx]?.hpPct ?? 0) : 0;
    const fury = c.fury ? st?.bossZone?.fury : undefined;
    // 隱藏精英（D-100）：物品等級再 +2、稀有權重 ×2
    const hidden = g0 === HIDDEN_GROUP;
    const ilvl = gd.ilvl + Math.floor(hpPct / 25) + (fury?.ilvlPlus ?? 0) + (hidden ? 2 : 0) + (nt?.ilvlPlus ?? 0) + (c.affix ? 1 : 0);
    const first = !!gd.firstRare && c.firstKill;
    for (let k = 0; k < (fury?.count ?? gd.count ?? 1); k++) {
      if (rand() * 100 >= (gd.chance * (100 + bonus)) / 100) continue;
      const w0 = fury?.rarity ?? gd.rarity;
      const w: [number, number, number] = hidden ? [w0[0], w0[1], w0[2] * 2] : w0;
      const t = rand() * (w[0] + w[1] + w[2]);
      put('gear', ilvl, first && k === 0 ? 3 : t < w[0] ? 1 : t < w[0] + w[1] ? 2 : 3);
    }
  }
}

/**
 * 伺服器檢查「這張圖真的會有這隻怪、在這一群」（26-security §3.1）：群組要存在而且是這種怪；
 * 深夜限定的群組要是深夜；暴怒只有 Boss（固定怪、關卡有 fury）；詞綴只有開了精英詞綴的關卡。
 */
export function validKill(c: LootContext): boolean {
  const st = stageDef(c.stageId);
  if (!st?.loot || !ENEMIES[c.defId]) return false;
  if (c.night && !st.night) return false;
  if (c.affix && !st.eliteAffixes) return false;
  const g = c.groupId;
  if (g !== undefined) {
    if (c.fury || c.fixedIdx !== undefined) return false;
    if (g === RIOT_GROUP) return !!st.riot && (st.riot.enemyId === c.defId || st.riot.eliteId === c.defId);
    if (g === HIDDEN_GROUP) return st.hiddenElite?.enemyId === c.defId;
    const sg = st.spawnGroups?.find((x) => x.id === g);
    return !!sg && sg.enemyId === c.defId && (!sg.nightOnly || c.night);
  }
  if (c.fixedIdx !== undefined) {
    if (!Number.isSafeInteger(c.fixedIdx) || st.enemies[c.fixedIdx]?.enemyId !== c.defId) return false;
    return !c.fury || !!st.bossZone?.fury;
  }
  return !c.fury && st.enemies.some((e) => e.enemyId === c.defId);
}

/** 這隻是不是這張圖的 Boss（固定怪＋關卡有 bossZone） */
export function isStageBoss(c: Pick<LootContext, 'stageId' | 'defId' | 'fixedIdx' | 'groupId'>): boolean {
  const st = stageDef(c.stageId);
  return !!st?.bossZone && c.groupId === undefined && c.fixedIdx !== undefined && st.enemies[c.fixedIdx]?.enemyId === c.defId;
}
