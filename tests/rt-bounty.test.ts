// 營地懸賞（D-109）：純資料函式。
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/battle/rt/data';
import { BOUNTY_POOL, BOUNTY_SLOTS, bountyKill, bountyTargetsOf, cleanBounties, makeBounty } from '../src/game/rtBounty';

describe('營地懸賞（D-109）', () => {
  it('同編號同結果；池子裡的目標都是存在的敵人；數量在範圍內', () => {
    for (const p of BOUNTY_POOL) expect(ENEMIES[p.target]).toBeDefined();
    for (let n = 0; n < 200; n++) {
      const a = makeBounty(n);
      expect(makeBounty(n)).toEqual(a);
      const p = BOUNTY_POOL.find((q) => q.target === a.target)!;
      expect(a.need).toBeGreaterThanOrEqual(p.need[0]);
      expect(a.need).toBeLessThanOrEqual(p.need[1]);
    }
  });

  it('沒有存檔 → 三張不重複的目標；壞資料丟掉後補滿', () => {
    const st = cleanBounties(undefined);
    expect(st.list.length).toBe(BOUNTY_SLOTS);
    expect(new Set(st.list.map((b) => b.target)).size).toBe(BOUNTY_SLOTS);
    const bad = cleanBounties({ list: [{ n: 'x' }, { ...st.list[0], target: 'dragon' }, st.list[1]], next: -3, done: 'a' });
    expect(bad.list.length).toBe(BOUNTY_SLOTS);
    expect(bad.list[0]).toEqual(st.list[1]);
    expect(bad.done).toBe(0);
    expect(bad.next).toBeGreaterThan(st.list[1]!.n);
  });

  it('打倒對應的怪 +1；完成就移除、補新的、done +1；不相關的怪不動', () => {
    let st = cleanBounties({ list: [{ n: 0, target: 'wolf', need: 2, got: 0, reward: { dust: 6, crystal: 0 } }], next: 1, done: 0 });
    expect(bountyKill(st, 'dragon').st).toBe(st);
    let r = bountyKill(st, 'wolf');
    expect(r.completed).toEqual([]);
    st = r.st;
    expect(st.list.find((b) => b.n === 0)!.got).toBe(1);
    r = bountyKill(st, 'wolf');
    expect(r.completed.length).toBe(1);
    expect(r.completed[0]!.reward.dust).toBe(6);
    expect(r.st.done).toBe(1);
    expect(r.st.list.length).toBe(BOUNTY_SLOTS);
    expect(r.st.list.some((b) => b.n === 0)).toBe(false);
  });

  it('每張大地圖打得到哪些懸賞目標（第 28 輪：打不到的在 HUD 標「別張地圖」）', () => {
    const ember = bountyTargetsOf(['slag_slime', 'ember_wolf', 'ember_shroom', 'obsidian_alpha', 'ember_colossus']);
    expect(ember.has('wolf')).toBe(true);
    expect(ember.has('wolf_king')).toBe(true);
    expect(ember.has('thorn_mother')).toBe(false);
    // 每個懸賞目標至少有一張地圖打得到
    const all = bountyTargetsOf(Object.keys(ENEMIES));
    for (const p of BOUNTY_POOL) expect(all.has(p.target)).toBe(true);
  });
});

describe('懸賞板只寫這張圖的怪名（第 43 輪）', () => {
  it('bountyIdsHere 依別名找出這張圖算數的怪、不重複', async () => {
    const { bountyIdsHere } = await import('../src/game/rtBounty');
    expect(bountyIdsHere('wolf', ['ember_wolf', 'ember_shroom', 'ember_wolf', 'ember_colossus'])).toEqual(['ember_wolf']);
    expect(bountyIdsHere('wolf_king', ['ember_wolf', 'ember_colossus'])).toEqual(['ember_colossus']);
    expect(bountyIdsHere('wolf', ['wolf', 'thorn_shooter'])).toEqual(['wolf']);
    expect(bountyIdsHere('thorn_mother', ['ember_wolf'])).toEqual([]);
  });

  it('新存檔的第一張懸賞是最簡單的野狼（第 44 輪）', () => {
    const st = cleanBounties(undefined);
    expect(st.list[0]).toMatchObject({ n: 0, target: 'wolf', need: 12, got: 0 });
    expect(new Set(st.list.map((b) => b.target)).size).toBe(st.list.length);
  });
});
