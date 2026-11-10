// 打倒一隻怪的掉落擲骰（第 146 輪從 engine.rollDrops 抽出來，純函式）：
// - 單機／PvE 引擎：rand＝引擎的掉落亂數，place＝丟到地上（會再抽兩次亂數決定位置）——亂數順序和以前一模一樣（golden hash 不變）。
// - 伺服器 loot.claim（26-security §3.1）：rand＝伺服器自己的亂數，place 只記下來（不用位置）。客戶端只能說「我打倒了誰、在哪一群」，數量與稀有度由這裡決定。
import { ENEMIES } from './data';
import { GEAR_ILVL_MAX } from './gear';
import { stageDef } from './maps/world';
import { TICKS_PER_SEC, type LootId, type StageDefinition } from './types';

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

/** uq＝這件裝備帶獨特效果的機率（%，只有稀有、而且來源有開才給；實際抽在 genGear 的 uniquePct） */
export type LootPlace = (kind: LootId, amount: number, rarity?: 1 | 2 | 3, uq?: number) => void;

/**
 * 獨特效果裝備的來源（P3-a2，D-355；%＝這個來源掉的「稀有」裝備帶獨特效果的機率）。
 * 先只開 Boss（暴怒更高）與隱藏精英，深夜再加；一般精英、小怪不掉。分層細修在 P3-b。
 */
export const UNIQUE_DROP = { boss: 15, fury: 35, hidden: 25, nightPlus: 10 } as const;
export function uniqueDropPct(c: Pick<LootContext, 'stageId' | 'defId' | 'fixedIdx' | 'groupId' | 'night' | 'fury'>): number {
  const base = c.groupId === HIDDEN_GROUP ? UNIQUE_DROP.hidden : isStageBoss(c) ? (c.fury ? UNIQUE_DROP.fury : UNIQUE_DROP.boss) : 0;
  return base ? base + (c.night ? UNIQUE_DROP.nightPlus : 0) : 0;
}

/** 這隻怪會不會掉東西（伺服器拿來擋「這張圖沒有這種怪」之外的空申請） */
export function hasLoot(defId: string): boolean {
  return !!ENEMIES[defId]?.drops;
}

/** 掉落設定算出來的物品等級（還沒套成品上限；genGear 會截在 GEAR_ILVL_MAX） */
function rawDropIlvl(base: number, hpPct: number, furyPlus: number, hidden: boolean, nightPlus: number, affix: boolean): number {
  return base + Math.floor(hpPct / 25) + furyPlus + (hidden ? HIDDEN_ILVL_PLUS : 0) + nightPlus + (affix ? AFFIX_ILVL_PLUS : 0);
}
/** 隱藏精英（D-100）／帶詞綴的精英：物品等級加成 */
export const HIDDEN_ILVL_PLUS = 2;
export const AFFIX_ILVL_PLUS = 1;

/**
 * 這隻怪在這張圖「實際掉到手上」的裝備物品等級範圍（D-340，Wiki 與說明用；和 rollEnemyLoot 同一條算式、再套成品上限）。
 * 範圍來自牠出現的各個區域（區域 HP 加成越高、等級越高）。`capped`＝設定值超過上限、被截掉了。
 * 這個情況下不會掉（沒設裝備、白天沒有這種怪、不是 Boss 卻問暴怒）就回 null。
 */
export function dropIlvlRange(st: StageDefinition, defId: string, o: { night?: boolean; fury?: boolean; affix?: boolean; hidden?: boolean } = {}): { min: number; max: number; capped: boolean } | null {
  const gd = st.gearDrops?.[defId];
  if (!gd || (o.night && !st.night)) return null;
  const fixed = st.enemies.filter((e) => e.enemyId === defId).map((e) => e.hpPct ?? 0);
  const groups = (st.spawnGroups ?? []).filter((g) => g.enemyId === defId && (!g.nightOnly || o.night)).map((g) => g.hpPct ?? 0);
  const fury = o.fury ? st.bossZone?.fury : undefined;
  if (o.fury && (!fury || !fixed.length)) return null;
  const riot = st.riot && (st.riot.enemyId === defId || st.riot.eliteId === defId) ? [0] : [];
  const hps = o.hidden ? (st.hiddenElite?.enemyId === defId ? [100] : []) : o.fury ? fixed : [...fixed, ...groups, ...riot];
  if (!hps.length) return null;
  const raws = hps.map((h) => rawDropIlvl(gd.ilvl, h, fury?.ilvlPlus ?? 0, !!o.hidden, o.night ? (st.night?.ilvlPlus ?? 0) : 0, !!o.affix));
  const cap = (n: number): number => Math.max(1, Math.min(GEAR_ILVL_MAX, n));
  return { min: cap(Math.min(...raws)), max: cap(Math.max(...raws)), capped: Math.max(...raws) > GEAR_ILVL_MAX };
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
  const put: LootPlace = (kind, amount, rarity, uq) => {
    if (amount > 0) place(kind, amount, rarity, uq);
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
    const ilvl = rawDropIlvl(gd.ilvl, hpPct, fury?.ilvlPlus ?? 0, hidden, nt?.ilvlPlus ?? 0, !!c.affix);
    const first = !!gd.firstRare && c.firstKill;
    const uq = uniqueDropPct(c);
    for (let k = 0; k < (fury?.count ?? gd.count ?? 1); k++) {
      if (rand() * 100 >= (gd.chance * (100 + bonus)) / 100) continue;
      const w0 = fury?.rarity ?? gd.rarity;
      const w: [number, number, number] = hidden ? [w0[0], w0[1], w0[2] * 2] : w0;
      const t = rand() * (w[0] + w[1] + w[2]);
      const rar = first && k === 0 ? 3 : t < w[0] ? 1 : t < w[0] + w[1] ? 2 : 3;
      put('gear', ilvl, rar, (rar === 3 && uq) || undefined);
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

/** 打倒這隻得多少經驗（D-090：重生點／固定怪的 hpPct 加成也加在經驗上；召喚物不給，由呼叫端擋）。引擎與伺服器共用 */
export function killXp(c: Pick<LootContext, 'stageId' | 'defId' | 'groupId' | 'fixedIdx'>): number {
  const st = stageDef(c.stageId);
  const rule = st?.progression;
  if (!rule) return 0;
  const g = c.groupId ? st.spawnGroups?.find((q) => q.id === c.groupId) : undefined;
  const fixed = c.fixedIdx !== undefined ? st.enemies[c.fixedIdx] : undefined;
  const pct = 100 + (g?.hpPct ?? fixed?.hpPct ?? 0);
  return Math.round(((rule.xp[c.defId] ?? 0) * pct) / 100);
}

/**
 * 一場裡「同一個出生來源」最多能打倒幾隻（第 148 輪，26-security §3.1 數量上限）：伺服器沒跑戰鬥，
 * 但重生規則是地圖資料寫死的，所以能算出「開戰到現在，最快的人類也只可能打倒這麼多」——
 * 擋掉「同一場一直申請 Boss／精英」這種偽造（以前只有全場每分鐘 40 隻的總上限）。
 * - 重生點 g：開場 maxAlive 隻，之後每 respawnTicks 最多補 maxAlive 隻（每死一隻排一次重生）。
 * - 固定怪（有 fixedIdx＝關卡有 bossZone.respawnTicks）：1＋每 respawnTicks 一次；沒有 fixedIdx：地圖上有幾隻就幾隻。
 * - 狼群暴動：最快每 everyTicks[0] 一次、一次最多 count[1] 隻（第一次也要等 everyTicks[0]）。
 * - 隱藏精英：每連續打倒 streak 隻普通怪才出一隻 → floor(其他擊殺÷streak)。
 * elapsedTicks 是伺服器的牆鐘換算（真的遊戲時間只會更少：切到背景、開面板都不算）；呼叫端自己加寬限。
 */
export function killSource(c: Pick<LootContext, 'defId' | 'groupId' | 'fixedIdx'>): string {
  if (c.groupId === RIOT_GROUP) return 'riot';
  if (c.groupId === HIDDEN_GROUP) return 'hidden';
  if (c.groupId !== undefined) return `g:${c.groupId}`;
  if (c.fixedIdx !== undefined) return `f:${c.fixedIdx}`;
  return `e:${c.defId}`;
}

export function killCap(c: Pick<LootContext, 'stageId' | 'defId' | 'groupId' | 'fixedIdx'>, elapsedTicks: number, otherKills: number): number {
  const st = stageDef(c.stageId);
  if (!st) return 0;
  const t = Math.max(0, elapsedTicks);
  const g0 = c.groupId;
  if (g0 === RIOT_GROUP) {
    const r = st.riot;
    if (!r) return 0;
    return Math.floor(t / Math.max(1, r.everyTicks[0])) * r.count[1];
  }
  if (g0 === HIDDEN_GROUP) {
    const h = st.hiddenElite;
    return h ? Math.floor(Math.max(0, otherKills) / Math.max(1, h.streak)) : 0;
  }
  if (g0 !== undefined) {
    const g = st.spawnGroups?.find((x) => x.id === g0);
    if (!g) return 0;
    return g.respawnTicks > 0 ? g.maxAlive * (1 + Math.floor(t / g.respawnTicks)) : g.maxAlive;
  }
  if (c.fixedIdx !== undefined) {
    const rt = st.bossZone?.respawnTicks;
    return rt ? 1 + Math.floor(t / rt) : 1;
  }
  return st.enemies.filter((e) => e.enemyId === c.defId).length;
}

/** 牆鐘毫秒 → tick（伺服器用） */
export const msToTicks = (ms: number): number => Math.floor((Math.max(0, ms) * TICKS_PER_SEC) / 1000);
