// RF-01（第 156 輪，D-339）：施放到一半換打法／換技能修正，這一招要照原本的打完，下一次施放才用新的。
// 以前 updatePlayer 每個 tick 重新取「現在選的打法」的命中表，但動作的結束時間是施放當下那一招的——
// 重斬（0.3 秒）出手後馬上切成施放比較久的變化，命中的 tick 還沒到動作就結束了，整招沒有傷害。
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/core/battle/rt/data';
import { chosenVariants, createBattle, playerOf, setSkillMods, setSkillVariants, skillDef, step } from '../src/core/battle/rt/engine';
import type { BattleCommand, BattleState } from '../src/core/battle/rt/types';
import { SKILL_TREE } from '../src/core/meta/skills';
import { variantB } from '../src/core/battle/rt/data';

type W = 'sword' | 'bow' | 'staff';
const mk = (weapon: W, variants: string[] = []): BattleState => createBattle({ stageId: 'forest_entry', seed: 42, weapon: weapon === 'sword' ? undefined : weapon, skillVariants: variants });
/** 這段時間內玩家每個技能打出的傷害（tick、技能、數值） */
const dmg = (s: BattleState, from = 0) => s.events.filter((e) => e.type === 'damage' && e.src === playerOf(s).id && e.tick > from).map((e) => (e.type === 'damage' ? `${e.tick}:${e.skill}:${e.amount}` : ''));
/** 走到最近的狼旁邊（讓招式打得到），回傳就位後的狀態 */
function approach(s: BattleState, range: number): void {
  for (let i = 0; i < 400; i++) {
    const p = playerOf(s);
    const w = s.units.filter((u) => u.side === 'enemy' && !u.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]!;
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d <= range) return;
    step(s, [{ type: 'target', id: w.id }, { type: 'move', dx: Math.round(((w.x - p.x) / d) * 1000), dy: Math.round(((w.y - p.y) / d) * 1000) }]);
  }
}
/** 放一招，中途（第 at 個 tick 後）做 change，跑到動作結束；回傳這一招的傷害紀錄 */
function castWith(s: BattleState, id: string, change?: (s: BattleState) => void, at = 1): string[] {
  const t0 = s.tick;
  step(s, [{ type: 'skill', id } as BattleCommand]);
  expect(playerOf(s).action?.kind, `${id} 有放出來`).toBe('skill');
  for (let i = 0; i < 120 && playerOf(s).action?.kind === 'skill'; i++) {
    if (i === at - 1) change?.(s);
    step(s);
  }
  return dmg(s, t0).filter((x) => x.split(':')[1] === id);
}

describe('施放中換打法（RF-01）', () => {
  it('審查的重現：原重斬出手後切成變化，這一招照樣命中、數值和沒切一樣；下一次才是新招', () => {
    const a = mk('sword');
    approach(a, 150);
    const b = structuredClone(a);
    const plain = castWith(a, 'heavy_slash');
    expect(plain.length).toBeGreaterThan(0);
    const swapped = castWith(b, 'heavy_slash', (s) => setSkillVariants(s, ['heavy_slash']));
    expect(swapped).toEqual(plain);
    // 這一招打完之後（下一個 tick）才換
    step(b);
    expect(skillDef(b, 'heavy_slash')).toBe(WEAPONS.sword.variants.heavy_slash);
    expect(b.skillVariants).toEqual(['heavy_slash']);
  });

  it('三把武器 × 五招 × 切到變化一／變化二／切回原招：這一招的傷害和沒切完全一樣，冷卻也不變', () => {
    for (const w of ['sword', 'bow', 'staff'] as W[])
      for (const t of SKILL_TREE)
        for (const [from, to] of [[[], [t.id]], [[], [variantB(t.id)]], [[t.id], []], [[variantB(t.id)], [t.id]]] as [string[], string[]][]) {
          const a = mk(w, from);
          approach(a, w === 'sword' ? 150 : 420);
          playerOf(a).mp = 999;
          const b = structuredClone(a);
          const plain = castWith(a, t.id);
          const swapped = castWith(b, t.id, (s) => setSkillVariants(s, to));
          const tag = `${w} ${t.id} ${JSON.stringify(from)}→${JSON.stringify(to)}`;
          expect(swapped, tag).toEqual(plain);
          expect(playerOf(b).ready[t.id], tag).toBe(playerOf(a).ready[t.id]);
          expect(chosenVariants(b), tag).toEqual([...to].sort());
          // 打完再跑一個 tick：新的選擇生效
          if (b.outcome !== 'running') continue; // 這一招把狼打光了，戰鬥結束就不再跑
          step(b);
          expect(b.skillVariants ?? [], tag).toEqual([...to].sort());
        }
  });

  it('施放中換技能修正（換裝、退點）：這一招照舊，下一招才吃新的', () => {
    const a = mk('sword');
    approach(a, 150);
    const b = structuredClone(a);
    const plain = castWith(a, 'whirlwind');
    const swapped = castWith(b, 'whirlwind', (s) => setSkillMods(s, { whirlwind: { dmgPct: 100, areaPct: 30 } }), 5);
    expect(plain.length).toBeGreaterThan(1);
    expect(swapped).toEqual(plain);
    step(b);
    expect(b.skillMods).toEqual({ whirlwind: { dmgPct: 100, areaPct: 30 } });
  });

  it('沒有在施放時照舊立刻生效；施放中連改兩次以最後一次為準', () => {
    const s = mk('sword');
    setSkillVariants(s, ['charge']);
    expect(s.skillVariants).toEqual(['charge']);
    approach(s, 150);
    castWith(s, 'heavy_slash', (x) => {
      setSkillVariants(x, ['heavy_slash']);
      setSkillVariants(x, ['heavy_slash:b', 'charge']);
      expect(x.skillVariants).toEqual(['charge']); // 這一招還在放
      expect(chosenVariants(x)).toEqual(['charge', 'heavy_slash:b']);
    });
    step(s);
    expect(s.skillVariants).toEqual(['charge', 'heavy_slash:b']);
  });
});
