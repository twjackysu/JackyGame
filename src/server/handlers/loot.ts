// PvE 掉落由伺服器擲（V5，26-security §3.1、24 §7，第 146 輪 D-307）：
// - battle.start：開一場（角色列存 pveBattle），回 battleId。一個角色同時只有一場，重開就換掉。
// - loot.claim：客戶端只說「這場第幾隻、打倒了誰、在哪一群／第幾個固定怪、暴怒？詞綴？」——
//   伺服器檢查：這場是我的、還沒過期、killSeq 遞增、速度不超過人類上限（每分鐘 40 隻＋開場 10 隻）、這張圖真的有這隻怪在這一群（validKill）；
//   通過才用「伺服器的亂數」照同一份規則（core/battle/rt/loot.ts）擲掉落，直接入錢包／行囊（行囊滿了照單機規則自動分解，D-100）；經驗與升級也在這裡算。
// 深夜、暴怒、詞綴是客戶端說的（伺服器沒跑這場戰鬥），只能檢查「這張圖有沒有」；之後抽查重跑指令紀錄（26 §3.1）。
import { genGear, isGear, type RtGear } from '../../core/battle/rt/gear';
import { stageDef, worldNightOpen, worldStageOpen } from '../../core/battle/rt/maps/world';
import { xpToNext } from '../../core/battle/rt/engine';
import { isStageBoss, killXp, rollEnemyLoot, validKill, type LootContext } from '../../core/battle/rt/loot';
import { addWithAutoSalvage } from '../../core/meta/bag';
import { ApiError } from '../../net/protocol';
import type { LootDropView } from '../../net/views';
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

interface StoredBattle {
  id: string;
  stageId: string;
  night: boolean;
  at: number;
  /** 最後一次的 killSeq */
  seq: number;
  claims: number;
}

function parse(json: string | undefined): StoredBattle | null {
  try {
    return JSON.parse(json ?? 'null') as StoredBattle | null;
  } catch {
    return null;
  }
}

const optStr = (v: unknown, what: string): string | undefined => (v === undefined ? undefined : idParam(v, what));
const optBool = (v: unknown, what: string): boolean => {
  if (v === undefined) return false;
  if (typeof v !== 'boolean') throw new ApiError('bad_request', what);
  return v;
};

export const lootHandlers: Pick<HandlerTable, 'battle.start' | 'loot.claim'> = {
  'battle.start': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const stageId = idParam(p?.stageId, 'stageId');
    const night = optBool(p?.night, 'night');
    const st = stageDef(stageId);
    if (!st?.loot || (night && !st.night)) throw new ApiError('rejected', 'stage');
    // 還沒開放的地圖、還沒解鎖的深夜不能開（跟畫面層 mapOpen／nightUnlocked 同一條規則）
    if (!worldStageOpen(stageId, c.maps) || (night && !worldNightOpen(stageId, c.maps))) throw new ApiError('rejected', 'locked');
    const b: StoredBattle = { id: ctx.ids.next('pve'), stageId, night, at: ctx.clock.now(), seq: 0, claims: 0 };
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
    if (b.claims >= MAX_CLAIMS || b.claims + 1 > KILL_BURST + Math.floor(((now - b.at) * KILLS_PER_MIN) / 60000)) throw new ApiError('rate_limited', 'kills');

    const prog = c.maps[b.stageId] ?? {};
    const lc: LootContext = { stageId: b.stageId, defId: enemyId, night: b.night, fury, affix, firstKill: !(prog.bossKills ?? 0) };
    if (groupId !== undefined) lc.groupId = groupId;
    if (fixedIdx !== undefined) lc.fixedIdx = fixedIdx;
    if (!validKill(lc)) throw new ApiError('rejected', 'kill');

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
    const next = { ...cur, pveBattle: JSON.stringify({ ...b, seq, claims: b.claims + 1 }) };
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
    if (isStageBoss(lc)) {
      const mp = cur.maps[b.stageId] ?? {};
      next.maps = { ...cur.maps, [b.stageId]: { ...mp, bossKills: (mp.bossKills ?? 0) + 1, ...(fury ? { furyKills: (mp.furyKills ?? 0) + 1 } : {}) } };
    }
    await ctx.r.characters.save(next);
    return { drops: rolled, xp, character: await freshView(ctx, c.id) };
  },
};
