// 非同步 PvP 天梯（第 143 輪，V5 先行，24 §6.2、26-security）：
// - pvp.start：伺服器挑對手（模擬玩家）、發種子、照雙方「身上的裝備」算配裝（物品等級壓縮 pvpGear）→ 對局存在角色的劇情旗標。
// - pvp.finish：客戶端只送自己的指令紀錄；伺服器用同一份引擎重跑（對手 Bot 也在伺服器跑）判勝負、改段位分。紀錄不合法整筆拒絕。
// 對局與段位分存在角色列（pvpMatch／pvpRating，SQL 版在 Character.Data 的 JSON 裡；不放 story——migrate.sync 會用舊 key 蓋掉 story），V6 再搬到 game.PvpMatch 資料表。獎勵只有段位稱號，不給數值。
import { GEAR_SLOTS, gearBonus, genGear, isGear, type RtGear } from '../../core/battle/rt/gear';
import { pvpGear } from '../../core/battle/rt/pvp';
import { replayPvp, type PvpMatchSetup, type PvpSide } from '../../core/battle/rt/pvpMatch';
import { WEAPONS } from '../../core/battle/rt/data';
import { DAY_MS, PVP_START_RATING, canChallenge, eloDelta, pvpStreakAfter, simGearPlan, simGearRating, simLeague, taipeiDay } from '../../core/meta/pvpRank';
import { hashSeed } from '../../core/rng';
import { ApiError } from '../../net/protocol';
import type { PvpRecentView, WeaponView } from '../../net/views';
import type { HandlerTable } from '../router';
import { simRoster, type SimPlayer } from '../sim/roster';
import { ownCharacter } from './common';
import { idParam } from './inv';

/** 壓縮物品等級的參考等級（大家都往中間壓） */
const PVP_REF_ILVL = 7;
/** 對局多久沒打完就作廢（超過就不能領；重開一局也會作廢） */
const PVP_MATCH_TTL = 30 * 60 * 1000;

interface StoredMatch extends PvpMatchSetup {
  id: string;
  /** 對手的帳號 id（第 150 輪：戰績「再挑一次」用；舊對局沒有） */
  foeId?: string;
  foeName: string;
  foeRating: number;
  at: number;
}

function sideOf(weapon: WeaponView, gear: RtGear[]): PvpSide {
  const pd = WEAPONS[weapon].player;
  const b = gearBonus(gear.map((g) => pvpGear(g, PVP_REF_ILVL)), pd.hp, pd.atk);
  return { weapon, bonus: { hp: b.hp, atk: b.atk, def: b.def } };
}

/** 模擬玩家的配裝：照「它和你比較低的那個」段位分（D-325，simGearPlan；模擬冒險者的分數擠在 900～1250，只看它的分數的話，掉到 700 的人遇到的還是全身裝）；同種子同分數同結果 */
function simSide(sim: SimPlayer, rating: number): PvpSide {
  const g = simGearPlan(rating);
  return sideOf(sim.weapon, GEAR_SLOTS.slice(0, g.slots).map((slot) => {
    const it = genGear(hashSeed(`${sim.seed}:pvp:${slot}`), g.rarity, g.ilvl, { slot });
    return g.enh ? { ...it, enh: g.enh } : it;
  }));
}
/** 模擬冒險者今天的段位分（D-303：它們每天彼此打幾場，確定性、同一天同結果） */
let leagueCache: { day: number; r: Map<string, number> } | null = null;
function simRatings(now: number): Map<string, number> {
  const day = Math.floor(now / DAY_MS);
  if (leagueCache?.day !== day) leagueCache = { day, r: simLeague(simRoster().map((s) => ({ id: s.accountId, tier: s.tier })), day) };
  return leagueCache.r;
}

const ratingOf = (c: { pvpRating?: number }): number => (Number.isSafeInteger(c.pvpRating) && c.pvpRating! > 0 ? c.pvpRating! : PVP_START_RATING);

/** 天梯顯示前幾名 */
const LADDER_TOP = 10;
/** 戰績留幾場 */
export const PVP_HISTORY = 5;

/** 存著的一場戰績（foeId 只在伺服器裡；畫面拿到的是 revenge 旗標＋foeId） */
type StoredRecent = Omit<PvpRecentView, 'revenge'>;

/** 存著的戰績（壞掉的資料當沒有，不讓一筆壞資料擋住天梯） */
function historyOf(c: { pvpHistory?: string }): StoredRecent[] {
  try {
    const h = JSON.parse(c.pvpHistory ?? '[]') as unknown;
    return Array.isArray(h)
      ? (h as StoredRecent[])
          .filter((r) => r && typeof r.foeName === 'string' && ['victory', 'defeat', 'timeout'].includes(r.outcome))
          .map((r) => ({ outcome: r.outcome, foeName: r.foeName, delta: Number(r.delta) || 0, at: Number(r.at) || 0, ...(typeof r.foeId === 'string' ? { foeId: r.foeId } : {}) }))
          .slice(0, PVP_HISTORY)
      : [];
  } catch {
    return [];
  }
}

export const pvpHandlers: Pick<HandlerTable, 'pvp.start' | 'pvp.finish' | 'pvp.ladder'> = {
  'pvp.ladder': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const rating = ratingOf(c);
    const sr = simRatings(ctx.clock.now());
    const simRating = (s: SimPlayer) => sr.get(s.accountId)!;
    // 同分時自己排前面（剛打贏追平的人看得到自己往上爬）；模擬玩家依帳號 id 固定順序
    const all = [{ name: c.name, weapon: c.weapon, rating, me: true }, ...simRoster().map((s) => ({ name: s.name, weapon: s.weapon, rating: simRating(s), me: false, id: s.accountId }))]
      .map((r, i) => ({ ...r, i }))
      .sort((a, b) => b.rating - a.rating || a.i - b.i)
      .map(({ i: _i, ...r }, k) => ({ ...r, pos: k + 1 }));
    const mine = all.find((r) => r.me)!;
    const rows = all.slice(0, LADDER_TOP);
    if (mine.pos > LADDER_TOP) rows.push(mine);
    // 復仇（第 150 輪，D-323）：輸掉的場次、對手還在、分差在指名範圍內 → 可以「再挑一次」（pvp.start 會再檢查一次）
    const recent = historyOf(c).map((r) => {
      const foe = r.foeId ? simRoster().find((s) => s.accountId === r.foeId) : undefined;
      return { ...r, revenge: r.outcome === 'defeat' && !!foe && canChallenge(rating, simRating(foe)) };
    });
    return { rows, recent, rating, pos: mine.pos, total: all.length, streak: pvpStreakAfter({ streak: c.pvpStreak }, 'timeout', 0).streak }; // 平手＝不變：拿來把壞資料修成安全值
  },


  'pvp.start': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const items = await ctx.r.items.listByOwner(c.id);
    const gear = items.filter((i) => i.location.startsWith('equip:') && isGear(i.gear)).map((i) => i.gear as unknown as RtGear);
    const rating = ratingOf(c);
    const sr = simRatings(ctx.clock.now());
    const simRating = (s: SimPlayer) => sr.get(s.accountId)!;
    let foe: SimPlayer;
    if (p?.foeId !== undefined) {
      // 指名挑戰（D-319）：對手要存在、段位分差在範圍內（分數照伺服器今天的，不信客戶端）
      const fid = idParam(p.foeId, 'foeId');
      const want = simRoster().find((s) => s.accountId === fid);
      if (!want) throw new ApiError('not_found', 'foe');
      if (!canChallenge(rating, simRating(want))) throw new ApiError('rejected', 'range');
      foe = want;
    } else {
      // 對手：段位分最接近的 5 個模擬玩家裡隨機一個
      const near = simRoster()
        .map((s) => ({ s, d: Math.abs(simRating(s) - rating) }))
        .sort((a, b) => a.d - b.d || (a.s.accountId < b.s.accountId ? -1 : 1))
        .slice(0, 5);
      foe = near[Math.floor(ctx.rng() * near.length)]!.s;
    }
    const m: StoredMatch = { id: ctx.ids.next('pvp'), seed: Math.floor(ctx.rng() * 4294967296) >>> 0, me: sideOf(c.weapon, gear), foe: simSide(foe, simGearRating(rating, simRating(foe))), foeId: foe.accountId, foeName: foe.name, foeRating: simRating(foe), at: ctx.clock.now() };
    await ctx.r.characters.save({ ...c, pvpMatch: JSON.stringify(m) });
    return { matchId: m.id, seed: m.seed, me: m.me as never, foe: m.foe as never, foeId: foe.accountId, foeName: m.foeName, foeRating: m.foeRating, rating };
  },

  'pvp.finish': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const mid = idParam(p?.matchId, 'matchId');
    if (!Array.isArray(p?.inputs)) throw new ApiError('bad_request', 'inputs');
    let m: StoredMatch | null = null;
    try {
      m = JSON.parse(c.pvpMatch ?? 'null') as StoredMatch | null;
    } catch {
      m = null;
    }
    if (!m || m.id !== mid || ctx.clock.now() - m.at > PVP_MATCH_TTL) throw new ApiError('not_found', 'match');
    const r = replayPvp(m, p.inputs);
    if (!r || r.s.outcome === 'running') throw new ApiError('rejected', 'inputs');
    const outcome = r.s.outcome as 'victory' | 'defeat' | 'timeout';
    const before = ratingOf(c);
    const delta = eloDelta(before, m.foeRating, outcome);
    const rating = Math.max(1, before + delta);
    const { pvpMatch: _done, ...rest } = c;
    const pvpHistory = JSON.stringify([{ outcome, foeName: m.foeName, ...(m.foeId ? { foeId: m.foeId } : {}), delta: rating - before, at: ctx.clock.now() }, ...historyOf(c)].slice(0, PVP_HISTORY));
    // 連勝／今日首勝（D-324）：只給外觀；日子用伺服器的時間（台北）
    const st = pvpStreakAfter({ streak: c.pvpStreak, winDay: c.pvpWinDay }, outcome, taipeiDay(ctx.clock.now()));
    await ctx.r.characters.save({ ...rest, pvpRating: rating, pvpHistory, pvpStreak: st.streak, ...(st.winDay !== undefined ? { pvpWinDay: st.winDay } : {}) });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'pvp.finish', detail: JSON.stringify({ match: m.id, foe: m.foeName, outcome, before, rating, hash: r.hash, ticks: r.s.tick }), at: ctx.clock.now() });
    return { outcome, rating, delta, streak: st.streak, firstWin: st.firstWin };
  },
};
