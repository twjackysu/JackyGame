// D-346／D-350：第 3 欄（技能 id 仍是 `charge`）在冒險地圖換成不位移的遠距／控場招——三把武器 × 原招／變化／變化二共九招；
// 競技場（`s.pvp`）沿用原本的位移招。這裡鎖住：每一招都不會把人帶走、打得到射程內的怪、帶著說明寫的狀態；競技場拿到的是有位移的舊定義。
import { describe, expect, it } from 'vitest';
import { ARENA_CHARGE, WEAPONS } from '../src/core/battle/rt/data';
import { addPlayer, createBattle, skillDef, step } from '../src/core/battle/rt/engine';
import { u } from '../src/core/battle/rt/types';

const CASES = [
  ['sword', [], '破空劍氣', 'slow'],
  ['sword', ['charge'], '流星劍氣', 'slow'],
  ['sword', ['charge:b'], '影襲', 'weak'],
  ['bow', [], '縛足箭', 'slow'],
  ['bow', ['charge'], '霜箭', 'freeze'],
  ['bow', ['charge:b'], '蝕毒箭', 'poison'],
  ['staff', [], '落雷', 'slow'],
  ['staff', ['charge'], '寒霜結界', 'freeze'],
  ['staff', ['charge:b'], '暗影束', 'weak'],
] as const;

describe('第 3 欄換招（D-346）', () => {
  for (const [weapon, variants, name, status] of CASES)
    it(`${weapon}｜${name}：不位移、打得到、帶「${status}」`, () => {
      const s = createBattle({ stageId: 'forest_entry', seed: 5, weapon: weapon === 'sword' ? undefined : weapon, skillVariants: [...variants] });
      const sk = skillDef(s, 'charge')!;
      expect(sk.name).toBe(name);
      expect(sk.dash).toBeUndefined();
      expect(sk.moveFactor).toBeGreaterThan(0); // 可以邊放邊走（D-347）
      const p = s.units[0]!;
      const w = s.units.find((x) => x.side === 'enemy')!;
      // 怪放在面向（北）的射程內：近的招貼著放、遠的招放在射程八成的地方
      const d = Math.max(u(1.2), Math.round(((sk.useRange ?? u(2)) * 8) / 10));
      w.x = w.homeX = p.x;
      w.y = w.homeY = p.y - d;
      w.mode = 'combat';
      w.hp = w.maxHp = 100000;
      s.units.filter((x) => x.side === 'enemy' && x !== w).forEach((x) => { x.x = 0; x.y = 0; });
      p.nextAttackTick = s.tick + 999; // 只看這一招；不指定目標＝主角不會自己走過去（開場面向北，怪在正北）
      p.speedPerTick = 0; // 近戰會自己走向怪（走路不算）；招式本身的位移（dash）不吃這個速度
      const [x0, y0] = [p.x, p.y];
      const seen = new Set<string>();
      step(s, [{ type: 'skill', id: 'charge' }]);
      for (let i = 0; i < sk.castTicks + 4; i++) {
        w.x = w.homeX; w.y = w.homeY; w.action = null; // 釘住，不讓牠走過來
        step(s, []);
        for (const st of w.statuses) seen.add(st.id);
      }
      expect(Math.abs(p.x - x0) + Math.abs(p.y - y0)).toBeLessThan(u(0.5));
      const hits = s.events.filter((e) => e.type === 'damage' && e.dst === w.id && e.src === p.id && e.origin === 'skill');
      expect(hits.length).toBe(sk.hits.length);
      expect([...seen]).toContain(status);
    });

  it('競技場沿用位移招（D-350）：九招都有位移、名字是原本的；冒險地圖的九招都沒有位移', () => {
    for (const weapon of ['sword', 'bow', 'staff'] as const) {
      const W = WEAPONS[weapon];
      for (const [i, v] of [[], ['charge'], ['charge:b']].entries()) {
        const a = createBattle({ stageId: 'pvp_arena', seed: 1, weapon: weapon === 'sword' ? undefined : weapon, skillVariants: v });
        addPlayer(a, { team: 1, dy: -900 });
        const sk = skillDef(a, 'charge')!;
        expect(sk).toBe(ARENA_CHARGE[weapon][i]);
        expect(sk.dash).toBeDefined();
        const pve = [W.skills.charge, W.variants.charge, W.variantsB.charge][i]!;
        expect(pve.dash).toBeUndefined();
        expect(pve.name).not.toBe(sk.name);
      }
      // 對手（第二個玩家）也一樣
      const b = createBattle({ stageId: 'pvp_arena', seed: 1 });
      const foe = addPlayer(b, { weapon, team: 1, dy: -900 });
      expect(skillDef(b, 'charge', foe)).toBe(ARENA_CHARGE[weapon][0]);
    }
  });
});
