// 第 42 輪：相遇／抉擇選完後的大字（28～30px）在 720 寬畫面一行最多約 22 個全形字；
// 以前「婆婆捧著銀霧蘭笑了：……」一行 26 字，360×640 左右兩邊都被切掉。現在一律先 wrapTip。
import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES } from '../src/game/choices';
import { ENCOUNTERS } from '../src/game/encounters';
import { wrapTip } from '../src/game/ui/tipText';

const MAX = 22;
const lines = (t: string) => wrapTip(t).split('\n').map((l) => [...l].length);

describe('選完後的大字不會超出畫面', () => {
  it('路上的相遇：取／助的 after 斷行後每行 ≤ 22 字', () => {
    for (const e of ENCOUNTERS) for (const k of ['take', 'spare'] as const) for (const n of lines(e[k].after)) expect(n, `${e.id}.${k}`).toBeLessThanOrEqual(MAX);
  });
  it('討伐後的抉擇：取／還的 after 斷行後每行 ≤ 22 字', () => {
    for (const c of BOSS_CHOICES) for (const k of ['take', 'spare'] as const) for (const n of lines(c[k].after)) expect(n, `${c.map}.${k}`).toBeLessThanOrEqual(MAX);
  });
});
