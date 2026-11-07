// PvE 掉落由伺服器擲（V5，26-security §3.1、24 §7，第 146 輪 D-307）：
// - battle.start：開一場（角色列存 pveBattle），回 battleId。一個角色同時只有一場，重開就換掉。
// - loot.claim：客戶端只說「這場第幾隻、打倒了誰、在哪一群／第幾個固定怪、暴怒？詞綴？」——
//   伺服器檢查：這場是我的、還沒過期、killSeq 遞增、速度不超過人類上限（每分鐘 40 隻＋開場 10 隻）、這張圖真的有這隻怪在這一群（validKill）、
//   同一個出生來源不超過重生規則算得出的數量（killCap：Boss 每 60 秒一隻、重生點每 respawnTicks 補 maxAlive 隻……，第 148 輪）；
//   通過才用「伺服器的亂數」照同一份規則（core/battle/rt/loot.ts）擲掉落，直接入錢包／行囊（行囊滿了照單機規則自動分解，D-100）；經驗與升級也在這裡算。
// - loot.chest（第 147 輪）：寶箱內容是地圖資料寫死的；白天的每個角色只能開一次（記在地圖進度），夜光的每場一次。沒有位置可查（伺服器沒跑戰鬥），之後抽查重跑。
// 深夜、暴怒、詞綴是客戶端說的（伺服器沒跑這場戰鬥），只能檢查「這張圖有沒有」；之後抽查重跑指令紀錄（26 §3.1）。
import { genGear, isGear, type RtGear } from '../../core/battle/rt/gear';
import { furyOpenBy, stageDef, worldNightOpen, worldStageOpen } from '../../core/battle/rt/maps/world';
import { xpToNext } from '../../core/battle/rt/engine';
import { TICKS_PER_SEC } from '../../core/battle/rt/types';
import { isStageBoss, killCap, killSource, killXp, msToTicks, rollEnemyLoot, validKill, type LootContext } from '../../core/battle/rt/loot';
import { addWithAutoSalvage } from '../../core/meta/bag';
import { bountyKill, cleanBounties } from '../../core/meta/bounty';
import { ApiError } from '../../net/protocol';
import type { BountyDoneView, LootDropView } from '../../net/views';
import type { HandlerTable } from '../router';
import { ownCharacter } from './common';
import { freshView, frontPos, idParam, loadInv } from './inv';

/** 一場最久（超過就要重開；手機一次玩不會超過這麼久） */
export const PVE_BATTLE_TTL = 3 * 60 * 60 * 1000;
/** 人類打怪速度上限：開場可以先打 KILL_BURST 隻，之後每分鐘 KILLS_PER_MIN 隻 */
export const KILLS_PER_MIN = 40;
export const KILL_BURST = 10;
/** 一場最多申請幾次 */
export const MAX_CLAIMS = 3000;
/** 夜光寶箱（D-108：每次進深夜都是滿的）在同一張圖最快多久補滿一次（線上版；出去再進來不能無限開，第 148 輪） */
export const NIGHT_CHEST_REFILL_MS = 5 * 60 * 1000;
/** 數量上限的寬限（battle.start 回來前引擎已經在跑、時鐘誤差）：多算這麼久的重生 */
export const KILL_GRACE_MS = 15_000;

interface StoredBattle {
  id: string;
  stageId: string;
  night: boolean;
  at: number;
  /** 最後一次的 killSeq */
  seq: number;
  claims: number;
  /** 每個出生來源打倒幾隻（killSource → 數量；第 148 輪，數量上限用） */
  kills?: Record<string, number>;
  /** 每張圖最後一次打倒 Boss 的時間（牆鐘 ms）：重開一場也帶過去，Boss 不能靠「出去再進來」比重生規則更快刷（第 148 輪） */
  bossAt?: Record<string, number>;
  /** 打怪速度的權杖桶（開場 KILL_BURST 個、每分鐘補 KILLS_PER_MIN 個）：跨場帶著走，重開一場不會補滿（第 148 輪） */
  rate?: { tokens: number; at: number };
  /** 每個夜光寶箱（圖:寶箱）最後一次打開的時間：跨場帶著走 */
  nightAt?: Record<string, number>;
  /** 這場開過的夜光寶箱（每次進深夜都是滿的，D-108） */
  nightChests?: string[];
}

function parse(json: string | undefined): StoredBattle | null {
  try {
    return JSON.parse(json ?? 'null') as StoredBattle | null;
  } catch {
    return null;
  }
}

/** 打怪速度權杖桶現在有幾個（舊資料沒有 rate：照以前「開戰時滿的」算） */
function rateNow(b: StoredBattle, now: number): { tokens: number; at: number } {
  const r = b.rate ?? { tokens: KILL_BURST, at: b.at };
  return { tokens: Math.min(KILL_BURST, r.tokens + (Math.max(0, now - r.at) * KILLS_PER_MIN) / 60000), at: now };
}

/** 過了補滿時間的夜光寶箱紀錄丟掉（角色列不會一直變大） */
function pruneNight(m: Record<string, number> | undefined, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, t] of Object.entries(m ?? {})) if (now - t < NIGHT_CHEST_REFILL_MS) out[k] = t;
  return out;
}

const optStr = (v: unknown, what: string): string | undefined => (v === undefined ? undefined : idParam(v, what));
const optBool = (v: unknown, what: string): boolean => {
  if (v === undefined) return false;
  if (typeof v !== 'boolean') throw new ApiError('bad_request', what);
  return v;
};

export const lootHandlers: Pick<HandlerTable, 'battle.start' | 'loot.claim' | 'loot.chest'> = {
  'battle.start': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const stageId = idParam(p?.stageId, 'stageId');
    const night = optBool(p?.night, 'night');
    const st = stageDef(stageId);
    if (!st?.loot || (night && !st.night)) throw new ApiError('rejected', 'stage');
    // 還沒開放的地圖、還沒解鎖的深夜不能開（跟畫面層 mapOpen／nightUnlocked 同一條規則）
    if (!worldStageOpen(stageId, c.maps) || (night && !worldNightOpen(stageId, c.maps))) throw new ApiError('rejected', 'locked');
    const prev = parse(c.pveBattle);
    const b: StoredBattle = { id: ctx.ids.next('pve'), stageId, night, at: ctx.clock.now(), seq: 0, claims: 0, ...(prev?.bossAt ? { bossAt: prev.bossAt } : {}), ...(prev ? { rate: rateNow(prev, ctx.clock.now()) } : {}), ...(prev?.nightAt ? { nightAt: prev.nightAt } : {}) };
    await ctx.r.characters.save({ ...c, pveBattle: JSON.stringify(b) });
    return { battleId: b.id };
  },

  'loot.claim': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const c = inv.c;
    const bid = idParam(p?.battleId, 'battleId');
    const seq = p?.killSeq;
    if (!Number.isSafeInteger(seq) || seq < 1) throw new ApiError('bad_request', 'killSeq');
    const enemyId = idParam(p?.enemyId, 'enemyId');
    const groupId = optStr(p?.groupId, 'groupId');
    const fixedIdx = p?.fixedIdx;
    if (fixedIdx !== undefined && (!Number.isSafeInteger(fixedIdx) || fixedIdx < 0 || fixedIdx > 999)) throw new ApiError('bad_request', 'fixedIdx');
    const fury = optBool(p?.fury, 'fury');
    const affix = optBool(p?.affix, 'affix');

    const b = parse(c.pveBattle);
    const now = ctx.clock.now();
    if (!b || b.id !== bid || now - b.at > PVE_BATTLE_TTL) throw new ApiError('not_found', 'battle');
    if (seq <= b.seq) throw new ApiError('conflict', 'killSeq');
    const rate = rateNow(b, now);
    if (b.claims >= MAX_CLAIMS || rate.tokens < 1) throw new ApiError('rate_limited', 'kills');

    const prog = c.maps[b.stageId] ?? {};
    const lc: LootContext = { stageId: b.stageId, defId: enemyId, night: b.night, fury, affix, firstKill: !(prog.bossKills ?? 0) };
    if (groupId !== undefined) lc.groupId = groupId;
    if (fixedIdx !== undefined) lc.fixedIdx = fixedIdx;
    if (!validKill(lc)) throw new ApiError('rejected', 'kill');
    // 暴怒版要先解鎖（跟畫面層 furyUnlocked 同規則）
    if (fury && !furyOpenBy(prog.bossKills ?? 0, c.level)) throw new ApiError('rejected', 'fury locked');
    // 同一個出生來源的數量上限（重生規則是地圖資料，core/battle/rt/loot.ts killCap）：擋「同一場一直申請 Boss」
    const src = killSource(lc);
    const kills = b.kills ?? {};
    const others = b.claims - (kills.hidden ?? 0);
    if ((kills[src] ?? 0) + 1 > killCap(lc, msToTicks(now - b.at + KILL_GRACE_MS), others)) throw new ApiError('rejected', 'spawn');
    const boss = isStageBoss(lc);
    const bossRt = stageDef(b.stageId)?.bossZone?.respawnTicks ?? 0;
    const lastBoss = b.bossAt?.[b.stageId];
    if (boss && bossRt && lastBoss !== undefined && now - lastBoss + KILL_GRACE_MS < (bossRt * 1000) / TICKS_PER_SEC) throw new ApiError('rejected', 'boss cooldown');

    const rolled: LootDropView[] = [];
    rollEnemyLoot(lc, ctx.rng, (kind, amount, rarity) => rolled.push(rarity ? { kind, amount, rarity } : { kind, amount }));

    // 入帳：金幣／粉塵／結晶進錢包；裝備用伺服器的種子產生數值、放進行囊；藥水是戰鬥中的消耗品，伺服器不記
    let st = inv.st;
    let pos = frontPos(inv);
    let dust = 0;
    for (const d of rolled) {
      if (d.kind === 'gold') await ctx.r.wallets.apply(c.id, 'coin', d.amount, 'loot', b.id);
      else if (d.kind === 'dust') dust += d.amount;
      else if (d.kind === 'crystal') await ctx.r.wallets.apply(c.id, 'crystal', d.amount, 'loot', b.id);
      else if (d.kind === 'gear') {
        const g = genGear(Math.floor(ctx.rng() * 4294967296) >>> 0, d.rarity ?? 1, d.amount, { night: b.night, region: b.stageId });
        const r = addWithAutoSalvage(st, g);
        if (!r) {
          d.full = true;
          continue;
        }
        st = r.st;
        if (r.salvaged) {
          d.salvaged = r.dust;
          dust += r.dust;
          if (r.salvaged.uid !== g.uid) {
            const old = inv.bag.find((x) => isGear(x.gear) && (x.gear as unknown as RtGear).uid === r.salvaged!.uid);
            if (old) await ctx.r.items.delete(old.id);
          }
        }
        if (!r.salvaged || r.salvaged.uid !== g.uid) {
          const id = ctx.ids.next('itm');
          await ctx.r.items.save({ id, ownerId: c.id, location: 'bag', pos: pos--, bound: false, gear: g as unknown as Record<string, unknown>, createdAt: now, version: 0 });
          d.itemId = id;
        }
      }
    }
    if (dust > 0) await ctx.r.wallets.apply(c.id, 'dust', dust, 'loot', b.id);

    // 這場的進度；打倒 Boss 記在地圖進度（伺服器記，firstRare 保底只有第一次）
    const cur = (await ctx.r.characters.get(c.id))!;
    const next = { ...cur, pveBattle: JSON.stringify({ ...b, seq, claims: b.claims + 1, rate: { tokens: rate.tokens - 1, at: now }, kills: { ...kills, [src]: (kills[src] ?? 0) + 1 }, ...(boss ? { bossAt: { ...b.bossAt, [b.stageId]: now } } : {}) }) };
    // 經驗與升級也由伺服器算（26-security：經驗是敏感邏輯）；規則和引擎同一份（killXp、xpToNext）
    const xp = killXp(lc);
    const maxLevel = stageDef(b.stageId)?.progression?.maxLevel ?? 1;
    if (xp > 0) {
      let level = Math.max(1, cur.level);
      let x = cur.xp + xp;
      while (level < maxLevel && x >= xpToNext(level)) {
        x -= xpToNext(level);
        level++;
      }
      next.level = level;
      next.xp = x;
    }
    // 懸賞（第 147 輪）：計數與獎勵也由伺服器做（規則 core/meta/bounty.ts，和單機同一份）
    const bst = cleanBounties(cur.bounty);
    const bk = bountyKill(bst, enemyId);
    const bounty: BountyDoneView[] = bk.completed.map((x) => ({ target: x.target, need: x.need, reward: { ...x.reward } }));
    if (bk.st !== bst) {
      next.bounty = bk.st;
      for (const x of bk.completed) {
        if (x.reward.dust) await ctx.r.wallets.apply(c.id, 'dust', x.reward.dust, 'bounty', b.id);
        if (x.reward.crystal) await ctx.r.wallets.apply(c.id, 'crystal', x.reward.crystal, 'bounty', b.id);
      }
    }
    if (boss) {
      const mp = cur.maps[b.stageId] ?? {};
      next.maps = { ...cur.maps, [b.stageId]: { ...mp, bossKills: (mp.bossKills ?? 0) + 1, ...(fury ? { furyKills: (mp.furyKills ?? 0) + 1 } : {}) } };
    }
    await ctx.r.characters.save(next);
    return { drops: rolled, xp, bounty, character: await freshView(ctx, c.id) };
  },
  'loot.chest': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const bid = idParam(p?.battleId, 'battleId');
    const chestId = idParam(p?.chestId, 'chestId');
    const b = parse(c.pveBattle);
    const now = ctx.clock.now();
    if (!b || b.id !== bid || now - b.at > PVE_BATTLE_TTL) throw new ApiError('not_found', 'battle');
    const chest = stageDef(b.stageId)?.chests?.find((x) => x.id === chestId);
    // 這張圖沒有這個寶箱；夜光寶箱只有深夜打得開
    if (!chest || (chest.nightOnly && !b.night)) throw new ApiError('rejected', 'chest');
    const mp = c.maps[b.stageId] ?? {};
    const opened = chest.nightOnly ? (b.nightChests ?? []) : (mp.chests ?? []);
    if (opened.includes(chestId)) throw new ApiError('conflict', 'opened');
    const nk = `${b.stageId}:${chestId}`;
    const lastNight = chest.nightOnly ? b.nightAt?.[nk] : undefined;
    if (lastNight !== undefined && now - lastNight < NIGHT_CHEST_REFILL_MS) throw new ApiError('conflict', 'refilling');
    // 內容是地圖資料寫死的（不擲骰；藥水是戰鬥中的消耗品，伺服器不記）
    const got = { coin: chest.loot.gold ?? 0, dust: chest.loot.dust ?? 0, crystal: chest.loot.crystal ?? 0 };
    if (got.coin) await ctx.r.wallets.apply(c.id, 'coin', got.coin, 'chest', `${b.stageId}:${chestId}`);
    if (got.dust) await ctx.r.wallets.apply(c.id, 'dust', got.dust, 'chest', `${b.stageId}:${chestId}`);
    if (got.crystal) await ctx.r.wallets.apply(c.id, 'crystal', got.crystal, 'chest', `${b.stageId}:${chestId}`);
    const cur = (await ctx.r.characters.get(c.id))!;
    if (chest.nightOnly) await ctx.r.characters.save({ ...cur, pveBattle: JSON.stringify({ ...b, nightChests: [...opened, chestId], nightAt: { ...pruneNight(b.nightAt, now), [nk]: now } }) });
    else await ctx.r.characters.save({ ...cur, maps: { ...cur.maps, [b.stageId]: { ...(cur.maps[b.stageId] ?? {}), chests: [...opened, chestId] } } });
    return { ...got, character: await freshView(ctx, c.id) };
  },
};
