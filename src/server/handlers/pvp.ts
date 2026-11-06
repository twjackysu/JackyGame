// 非同步 PvP 天梯（第 143 輪，V5 先行，24 §6.2、26-security）：
// - pvp.start：伺服器挑對手（模擬玩家）、發種子、照雙方「身上的裝備」算配裝（物品等級壓縮 pvpGear）→ 對局存在角色的劇情旗標。
// - pvp.finish：客戶端只送自己的指令紀錄；伺服器用同一份引擎重跑（對手 Bot 也在伺服器跑）判勝負、改段位分。紀錄不合法整筆拒絕。
// 過渡期：對局與段位分存在 story（pvp_match／pvp_rating），V6 再搬到 game.PvpMatch 資料表。獎勵只有段位稱號，不給數值。
import { GEAR_SLOTS, gearBonus, genGear, isGear, type RtGear } from '../../core/battle/rt/gear';
import { pvpGear } from '../../core/battle/rt/pvp';
import { replayPvp, type PvpMatchSetup, type PvpSide } from '../../core/battle/rt/pvpMatch';
import { WEAPONS } from '../../core/battle/rt/data';
import { PVP_START_RATING, eloDelta } from '../../core/meta/pvpRank';
import { hashSeed } from '../../core/rng';
import { ApiError } from '../../net/protocol';
import type { WeaponView } from '../../net/views';
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
  foeName: string;
  foeRating: number;
  at: number;
}

function sideOf(weapon: WeaponView, gear: RtGear[]): PvpSide {
  const pd = WEAPONS[weapon].player;
  const b = gearBonus(gear.map((g) => pvpGear(g, PVP_REF_ILVL)), pd.hp, pd.atk);
  return { weapon, bonus: { hp: b.hp, atk: b.atk, def: b.def } };
}

/** 模擬玩家的配裝：每個部位一件精良，物品等級照程度（同種子同結果） */
function simSide(sim: SimPlayer): PvpSide {
  const ilvl = Math.min(12, sim.tier + 3);
  return sideOf(sim.weapon, GEAR_SLOTS.map((slot) => genGear(hashSeed(`${sim.seed}:pvp:${slot}`), 2, ilvl, { slot })));
}
const simRating = (sim: SimPlayer): number => PVP_START_RATING - 100 + sim.tier * 30;

const ratingOf = (story: Record<string, string>): number => {
  const n = Number(story.pvp_rating);
  return Number.isSafeInteger(n) && n > 0 ? n : PVP_START_RATING;
};

export const pvpHandlers: Pick<HandlerTable, 'pvp.start' | 'pvp.finish'> = {
  'pvp.start': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const items = await ctx.r.items.listByOwner(c.id);
    const gear = items.filter((i) => i.location.startsWith('equip:') && isGear(i.gear)).map((i) => i.gear as unknown as RtGear);
    const rating = ratingOf(c.story);
    // 對手：段位分最接近的 5 個模擬玩家裡隨機一個
    const near = simRoster()
      .map((s) => ({ s, d: Math.abs(simRating(s) - rating) }))
      .sort((a, b) => a.d - b.d || (a.s.accountId < b.s.accountId ? -1 : 1))
      .slice(0, 5);
    const foe = near[Math.floor(ctx.rng() * near.length)]!.s;
    const m: StoredMatch = { id: ctx.ids.next('pvp'), seed: Math.floor(ctx.rng() * 4294967296) >>> 0, me: sideOf(c.weapon, gear), foe: simSide(foe), foeName: foe.name, foeRating: simRating(foe), at: ctx.clock.now() };
    await ctx.r.characters.save({ ...c, story: { ...c.story, pvp_match: JSON.stringify(m) } });
    return { matchId: m.id, seed: m.seed, me: m.me as never, foe: m.foe as never, foeName: m.foeName, foeRating: m.foeRating, rating };
  },

  'pvp.finish': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const mid = idParam(p?.matchId, 'matchId');
    if (!Array.isArray(p?.inputs)) throw new ApiError('bad_request', 'inputs');
    let m: StoredMatch | null = null;
    try {
      m = JSON.parse(c.story.pvp_match ?? 'null') as StoredMatch | null;
    } catch {
      m = null;
    }
    if (!m || m.id !== mid || ctx.clock.now() - m.at > PVP_MATCH_TTL) throw new ApiError('not_found', 'match');
    const r = replayPvp(m, p.inputs);
    if (!r || r.s.outcome === 'running') throw new ApiError('rejected', 'inputs');
    const outcome = r.s.outcome as 'victory' | 'defeat' | 'timeout';
    const before = ratingOf(c.story);
    const delta = eloDelta(before, m.foeRating, outcome);
    const rating = Math.max(1, before + delta);
    const { pvp_match: _done, ...story } = c.story;
    await ctx.r.characters.save({ ...c, story: { ...story, pvp_rating: String(rating) } });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'pvp.finish', detail: JSON.stringify({ match: m.id, foe: m.foeName, outcome, before, rating, hash: r.hash, ticks: r.s.tick }), at: ctx.clock.now() });
    return { outcome, rating, delta };
  },
};
