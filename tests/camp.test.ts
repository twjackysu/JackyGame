import { describe, expect, it } from 'vitest';
import { DialogueRunner } from '../src/core/dialogue/runner';
import { interact } from '../src/core/explore/area';
import { applyEffects, newGame, type GameState } from '../src/core/state/gameState';
import { CAMP, GIFTS, GIFT_TASTE } from '../src/data/dialogue/camp';
import { ITEM_DEFS } from '../src/data/equipment';
import { AREAS } from '../src/data/areas';

/** 依序選擇（文字比對），回傳看到的選項文字 */
function play(s: GameState, picks: string[]): string[][] {
  const r = new DialogueRunner(CAMP, s, () => 0);
  const seen: string[][] = [];
  for (let i = 0; i < 200; i++) {
    const st = r.next();
    if (st.kind === 'end') return seen;
    if (st.kind === 'choice') {
      seen.push(st.options.map((o) => o.text));
      const want = picks.shift() ?? '起身出發';
      const k = st.options.findIndex((o) => o.text.includes(want));
      r.choose(k >= 0 ? k : st.options.length - 1);
    }
  }
  throw new Error('loop');
}

describe('營火（E5）', () => {
  it('所有跳轉目標存在；禮物都在道具表', () => {
    for (const lines of Object.values(CAMP.nodes)) for (const l of lines) {
      if ('goto' in l) expect(CAMP.nodes, l.goto).toHaveProperty(l.goto);
      if ('choice' in l) for (const o of l.choice) expect(CAMP.nodes, o.next).toHaveProperty(o.next);
    }
    for (const g of GIFTS) expect(ITEM_DEFS[g]?.kind).toBe('gift');
  });
  it('聊天：話題依好感解鎖，每個話題只加一次好感', () => {
    const s = newGame();
    applyEffects(s, [{ join: 'io' }]);
    play(s, ['找人聊聊', '伊歐', '（回到營火邊）', '起身出發']);
    expect(s.affinity.io).toBe(4);
    expect(s.flags.talk_io_1).toBe(true);
    play(s, ['找人聊聊', '伊歐', '（回到營火邊）', '起身出發']);
    expect(s.affinity.io).toBe(4); // 第 2 話題要 20
    s.affinity.io = 20;
    play(s, ['找人聊聊', '伊歐', '（回到營火邊）', '起身出發']);
    expect(s.flags.talk_io_2).toBe(true);
    expect(s.affinity.io).toBe(24);
  });
  it('送禮：沒有禮物不顯示；送了扣道具、依喜好加好感', () => {
    const s = newGame();
    applyEffects(s, [{ join: 'io' }, { join: 'rourke' }]);
    const seen = play(s, []);
    expect(seen[0]!.some((t) => t.includes('送禮物'))).toBe(false);
    s.inventory.gift_flower = 1;
    play(s, ['送禮物', '野花束', '伊歐', '起身出發']);
    expect(s.inventory.gift_flower).toBeUndefined();
    expect(GIFT_TASTE.io.gift_flower).toBe(2);
    expect(s.affinity.io).toBe(8);
  });
  it('營火實體：主線完成前跑主線、之後打開營火選單', () => {
    const a = AREAS['wolfpath']!;
    const fire = a.entities.find((e) => e.id === 'campfire')!;
    const s = newGame();
    s.flags.ch1_legacy = true;
    expect(interact(s, a.id, fire)).toMatchObject({ kind: 'script', script: 'ch1' });
    s.flags.ch1_campfire = true;
    expect(interact(s, a.id, fire)).toMatchObject({ kind: 'script', script: 'camp', node: 'menu' });
    const yard = AREAS['greylamp']!.entities.find((e) => e.id === 'yard_fire')!;
    expect(interact(s, 'greylamp', yard)).toMatchObject({ script: 'camp' });
  });
});
