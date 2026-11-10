// 競技場有沒有帶到養成（第 156 輪，D-338；Jacky 11/10：「PVP 好像沒有套用到我們裝備和等級技能等效果」）。
// 同一個對手、同一個種子、同一個 Bot 操作：「12 級＋裝備＋點了技能」要比「1 級裸裝」打得痛、撐得久，而且用的是玩家選的打法。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { playerOf, skillDef } from '../../src/core/battle/rt/engine';
import { playPvp, replayPvp, startPvp, type PvpSide } from '../../src/core/battle/rt/pvpMatch';
import { PVP, pvpLevelBonus } from '../../src/core/battle/rt/pvp';
import { WEAPONS } from '../../src/core/battle/rt/data';
import { stageDef } from '../../src/core/battle/rt/maps/world';
import { BOT_PROFILES, PlayerBot } from '../../src/core/battle/rt/sim';
import type { BattleCommandBody } from '../../src/core/battle/rt/types';
import { simLevel, simSkillRanks } from '../../src/core/meta/pvpRank';
import { SKILL_TREE } from '../../src/core/meta/skills';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

const auth = { resolve: async (t?: string) => t ?? 'anon' };
/** 同武器（長弓）的 1 級裸裝角色 */
/** 樣本存檔（12 級、重斬 3、旋風斬 5＋變化）再把「旋風斬傷害 +12%」的戒指戴上 */
const home = JSON.parse(LEGACY_SAMPLE.jg_rt_mistwood!) as { bag: { uid?: string }[]; equip: Record<string, unknown> };
const STRONG: Record<string, string> = { ...LEGACY_SAMPLE, jg_rt_mistwood: JSON.stringify({ ...home, equip: { weapon: home.equip.weapon, ring: home.bag.find((g) => g.uid === 'g3') }, bag: [] }) };
const NAKED: Record<string, string> = { jg_rt_mistwood: JSON.stringify({ level: 1 }), jg_weapon: 'bow' };

/** 用同一個 Bot 打一場，回傳打出去／吃到的總傷害與放過的招 */
function fight(me: PvpSide, foe: PvpSide, seed: number) {
  const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
  const r = playPvp({ seed, me, foe }, (s) => bot.decide(s) as BattleCommandBody[]);
  const [a, b] = [playerOf(r.s), playerOf(r.s, 1)];
  let dealt = 0;
  let taken = 0;
  for (const e of r.s.events) if (e.type === 'damage') e.dst === b.id ? (dealt += e.amount) : e.dst === a.id ? (taken += e.amount) : 0;
  const casts = r.s.events.filter((e) => e.type === 'cast' && e.id === a.id).map((e) => (e as { skill: string }).skill);
  return { r, dealt, taken, casts, ticks: r.s.tick, dps: dealt / r.s.tick, maxHp: a.maxHp, atk: a.atk };
}

for (const be of BACKENDS)
  describe(`競技場帶入養成（${be.name}）`, () => {
    it('等級、技能點、打法、裝備特效都進了配裝；和 1 級裸裝打同一個對手有差', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0.3 });
      let n = 0;
      const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}${++n}` });
      const [a, b] = [mk('accA'), mk('accB')];
      const strong = await a.call('pvp.start', { characterId: (await a.call('migrate.legacy', { snapshot: STRONG })).characterId });
      const weak = await b.call('pvp.start', { characterId: (await b.call('migrate.legacy', { snapshot: NAKED })).characterId });

      // 配裝：樣本存檔是 12 級、重斬 3 級、旋風斬 5 級（選了變化）、戒指有「旋風斬傷害 +12%」
      expect(strong.me.level).toBe(12);
      expect(strong.me.skillVariants).toEqual(['whirlwind']);
      expect(strong.me.skillMods?.heavy_slash?.dmgPct).toBe(24);
      expect(strong.me.skillMods?.whirlwind?.dmgPct).toBeGreaterThanOrEqual(15 + 12);
      expect(strong.me.skillMods?.whirlwind?.areaPct).toBe(30);
      expect(weak.me.level).toBe(1);
      expect(weak.me.bonus).toEqual({ hp: 0, atk: 0, def: 0 });
      expect(weak.me.skillVariants).toBeUndefined();
      expect(weak.me.skillMods).toBeUndefined();
      // 等級：12 級＝攻擊 +55%、HP +66%（疊在裝備上）
      expect(strong.me.bonus.atk).toBeGreaterThan(WEAPONS.bow.player.atk * 0.55);
      expect(strong.me.bonus.hp).toBeGreaterThanOrEqual(Math.round(WEAPONS.bow.player.hp * 0.66));
      // 對手（模擬冒險者）也有等級與技能點
      expect(strong.foe.level).toBeGreaterThan(1);
      expect(Object.keys(strong.foe.skillMods ?? {}).length).toBeGreaterThan(0);

      // 場內：用的是玩家選的打法（旋風斬的變化），不是原招
      const st = startPvp({ seed: strong.seed, me: strong.me, foe: strong.foe });
      const p = playerOf(st.s);
      expect(skillDef(st.s, 'whirlwind', p)).toBe(WEAPONS.bow.variants.whirlwind);
      expect(skillDef(startPvp({ seed: weak.seed, me: weak.me, foe: weak.foe }).s, 'whirlwind')).toBe(WEAPONS.bow.skills.whirlwind);

      // 同一個對手、同一個種子：養過的角色每秒打得比較痛、血比較厚
      const foe = strong.foe;
      const [s1, w1] = [fight(strong.me, foe, 777), fight(weak.me, foe, 777)];
      expect(s1.atk).toBeGreaterThan(w1.atk * 1.5);
      expect(s1.maxHp).toBeGreaterThan(w1.maxHp * 1.5);
      expect(s1.dps).toBeGreaterThan(w1.dps * 1.3);
      expect(s1.casts.length).toBeGreaterThan(0);
      // 幾個種子都一樣：打出去的總傷害至少兩倍、撐得比較久（對手是全身 6 件的模擬冒險者，樣本只穿 2 件，不保證贏）
      for (const seed of [11, 22, 33]) {
        const [x, y] = [fight(strong.me, foe, seed), fight(weak.me, foe, seed)];
        expect(x.dealt).toBeGreaterThan(y.dealt * 2);
        expect(x.r.s.outcome === 'victory' || x.ticks > y.ticks).toBe(true);
      }

      // 伺服器重跑照樣一致（勝負仍由伺服器判）
      const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
      const local = playPvp({ seed: strong.seed, me: strong.me, foe: strong.foe }, (s) => bot.decide(s) as BattleCommandBody[]);
      const res = await a.call('pvp.finish', { characterId: (await a.call('character.list', {}))[0]!.id, matchId: strong.matchId, inputs: local.inputs });
      expect(res.outcome).toBe(local.s.outcome);
    });
  });

describe('競技場等級規則', () => {
  it('等級加成和冒險地圖同一組數字；沒有等級欄位的舊對局照舊能重跑', () => {
    for (const id of ['mistwood', 'thornvale', 'emberrift', 'starfall']) {
      const pr = stageDef(id)!.progression!;
      expect([pr.hpPctPerLevel, pr.atkPctPerLevel, pr.maxLevel]).toEqual([PVP.levelHpPct, PVP.levelAtkPct, PVP.maxLevel]);
    }
    const sw = WEAPONS.sword.player;
    expect(pvpLevelBonus('sword', 1, { hp: 10, atk: 3, def: 1 })).toEqual({ hp: 10, atk: 3, def: 1 });
    expect(pvpLevelBonus('sword', 11, { hp: 0, atk: 0, def: 0 })).toEqual({ hp: Math.round(sw.hp * 1.6) - sw.hp, atk: Math.round(sw.atk * 1.5) - sw.atk, def: 0 });
    expect(pvpLevelBonus('sword', 999, { hp: 0, atk: 0, def: 0 })).toEqual(pvpLevelBonus('sword', 20, { hp: 0, atk: 0, def: 0 }));
    expect(pvpLevelBonus('sword', 'x', { hp: 0, atk: 0, def: 0 })).toEqual({ hp: 0, atk: 0, def: 0 });
    // 舊對局（第 155 輪以前存的）：只有 weapon＋bonus，重跑不受影響
    const old = { seed: 5, me: { weapon: 'sword' as const, bonus: { hp: 40, atk: 6, def: 2 } }, foe: { weapon: 'bow' as const, bonus: { hp: 0, atk: 0, def: 0 } } };
    const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
    const r = playPvp(old, (s) => bot.decide(s) as BattleCommandBody[]);
    expect(replayPvp(old, r.inputs)?.hash).toBe(r.hash);
  });
  it('模擬冒險者：分數越高等級越高；技能點＝等級−1、每招最多 5', () => {
    expect(simLevel(700)).toBe(1);
    expect(simLevel(1000)).toBe(6);
    expect(simLevel(1250)).toBe(14);
    expect(simLevel(2000)).toBe(20);
    const ids = SKILL_TREE.map((t) => t.id);
    for (const lv of [1, 6, 14, 20]) {
      const r = simSkillRanks(123, lv, ids);
      expect(Object.values(r).reduce((x, y) => x + y, 0)).toBe(lv - 1);
      expect(Object.values(r).every((v) => v >= 1 && v <= 5)).toBe(true);
      expect(simSkillRanks(123, lv, ids)).toEqual(r);
    }
  });
});
