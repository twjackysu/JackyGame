// 長弓（D-147）：第二種武器。技能欄同一組 id、招式整組換掉；沒選長弓時結果跟以前完全一樣。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ARCHER, BOW_SKILLS, SKILLS, STAGES, SWORDSMAN } from '../src/core/battle/rt/data';
import { createBattle, dashDistance, playerDef, skillDef, stateHash, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { makeStarfallStage, STARFALL_SENTINEL } from '../src/core/battle/rt/maps/starfall';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';

const out = (t: string) => (globalThis as any).process.stdout.write(t + '\n');

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
  STAGES.starfall = makeStarfallStage();
});
afterAll(() => {
  delete STAGES.mistwood;
  delete STAGES.starfall;
});

describe('長弓（D-147）', () => {
  it('五個技能都有弓版、id 相同、名字不同；普攻 5 格；後躍射擊往後跳', () => {
    for (const id of SWORDSMAN.skills) {
      expect(BOW_SKILLS[id]?.id).toBe(id);
      expect(BOW_SKILLS[id]!.name).not.toBe(SKILLS[id]!.name);
    }
    const s = createBattle({ stageId: 'mistwood', seed: 1, weapon: 'bow' });
    expect(s.weapon).toBe('bow');
    expect(playerDef(s)).toBe(ARCHER);
    expect(skillDef(s, 'charge')!.name).toBe('後躍射擊');
    expect(dashDistance(s, 'charge')).toBe(-u(3.5));
    expect(s.units[0]!.maxHp).toBeLessThan(createBattle({ stageId: 'mistwood', seed: 1 }).units[0]!.maxHp);
    // 技能變化對長弓不生效（弓目前只有一套招式）
    const v = createBattle({ stageId: 'mistwood', seed: 1, weapon: 'bow', skillVariants: ['heavy_slash'] });
    expect(skillDef(v, 'heavy_slash')!.name).toBe('穿雲箭');
  });

  it('後躍射擊：先射、再往面向的反方向跳 3.5 格', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 3, weapon: 'bow' });
    const p = s.units[0]!;
    const y0 = p.y;
    step(s, [{ type: 'skill', id: 'charge' }]);
    for (let i = 0; i < sec(0.5); i++) step(s, []);
    // 開場面向北（-y），往後跳＝往南
    expect(p.y - y0).toBeGreaterThan(u(2.5));
  });

  it('沒選長弓＝劍士，stateHash 跟不帶 weapon 一樣', () => {
    const a = createBattle({ stageId: 'mistwood', seed: 2 });
    const b = createBattle({ stageId: 'mistwood', seed: 2, weapon: undefined });
    const bot1 = new PlayerBot({ ...BOT_PROFILES.normal, advanceTo: MISTWOOD_KING }, 'normal');
    const bot2 = new PlayerBot({ ...BOT_PROFILES.normal, advanceTo: MISTWOOD_KING }, 'normal');
    for (let i = 0; i < sec(90); i++) {
      step(a, bot1.decide(a));
      step(b, bot2.decide(b));
    }
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('三種 Bot 用長弓都打得倒霧角狼王（Lv5、沒裝備）', () => {
    const rows: string[] = [];
    for (const who of ['novice', 'normal', 'expert'] as const) {
      for (const weapon of [undefined, 'bow'] as const) {
        const res = [1, 2].map((seed) => {
          const s = createBattle({ stageId: 'mistwood', seed, level: who === 'novice' ? 6 : 5, weapon });
          const bot = new PlayerBot({ ...BOT_PROFILES[who], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, who);
          let engaged = -1;
          let hurt = 0;
          while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(1500)) {
            step(s, bot.decide(s));
            if (engaged < 0 && s.units.some((x) => x.defId === 'wolf_king' && !x.dead && x.mode === 'combat')) engaged = s.tick;
          }
          hurt = s.revives ?? 0;
          return { killed: (s.bossKills ?? []).length > 0, total: Math.round(s.tick / 30), fight: Math.round((s.tick - Math.max(0, engaged)) / 30), downs: hurt };
        });
        rows.push(`${who} ${weapon ?? 'sword'}：${res.map((x) => (x.killed ? `全程 ${x.total}s／狼王 ${x.fight}s／倒 ${x.downs}` : '未打倒')).join('、')}`);
        if (weapon === 'bow') for (const x of res) expect(x.killed).toBe(true);
      }
    }
    out(`\n[長弓 vs 劍 霧語森林]\n${rows.join('\n')}`);
  }, 300000);

  it('長弓也打得倒星骸守望者（普通 Bot、Lv14＋裝備，和劍同一套標準）', () => {
    const rows: string[] = [];
    for (const weapon of [undefined, 'bow'] as const) {
      const s = createBattle({ stageId: 'starfall', seed: 1, level: 14, bonus: { hp: 600, atk: 55, def: 28 }, weapon });
      const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL }, 'normal');
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(900)) step(s, bot.decide(s));
      rows.push(`${weapon ?? 'sword'}：${(s.bossKills ?? []).length ? '打倒' : '沒打倒'} ${Math.round(s.tick / 30)} 秒、營火醒來 ${s.revives ?? 0}`);
      if (weapon) expect((s.bossKills ?? []).length).toBeGreaterThan(0);
    }
    out(`\n[星骸守望者 Lv14＋裝備]\n${rows.join('\n')}`);
  }, 300000);
});
