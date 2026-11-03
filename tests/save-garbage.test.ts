import { describe, expect, it } from 'vitest';
import { cleanChoices } from '../src/game/choices';
import { cleanEncounters } from '../src/game/encounters';
import { defaultControls, fitHeight, sanitize } from '../src/game/rtControls';

// 第 113 輪：其他存檔鍵塞錯型別也要退回預設（D-260 的延伸，D-261）
const JUNK: unknown[] = [null, undefined, 42, 'x', [1, 2], true, { a: 1 }];

describe('壞存檔：抉擇／相遇／操作設定（D-261）', () => {
  it('抉擇、相遇遇到垃圾回空物件', () => {
    for (const v of JUNK) {
      expect(cleanChoices(v)).toEqual({});
      expect(cleanEncounters(v)).toEqual({});
    }
    expect(cleanChoices({ mistwood: 5 })).toEqual({});
  });
  it('操作設定遇到垃圾回預設', () => {
    for (const v of JUNK) expect(sanitize(fitHeight(v, 1558))).toEqual(defaultControls());
  });
  it('操作設定的位置是 Infinity（JSON 1e999）也夾回畫面內', () => {
    const raw = JSON.parse('{"pos":{"0":{"x":1e999,"y":-1e999}},"h":1e999,"scale":"big","keys":[1,2],"leftHand":"yes","order":"x"}') as unknown;
    const c = sanitize(fitHeight(raw, 1558));
    const p = c.pos[0]!;
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(c.scale).toBe(1);
    expect(c.leftHand).toBe(false);
    expect(c.order).toEqual(defaultControls().order);
  });
});
