import { describe, expect, it } from 'vitest';
import { BTN_COUNT, JOY_INDEX, SCALES, buttonPos, buttonR, defaultControls, fireRowLayout, setLeftHand } from '../src/game/rtControls';
import { TALL } from '../src/game/screen';

// 第 43 輪：營火捷徑（燼牌／行囊・強化／行商）不能蓋在技能鍵或搖桿上（左手模式、大按鈕都一樣）
const ITEMS = [{ w: 90, x: 88 }, { w: 190, x: 265 }, { w: 100, x: 485 }];
const H = 56;

function overlaps(c: ReturnType<typeof defaultControls>, xs: number[], y: number): string[] {
  const bad: string[] = [];
  xs.forEach((x, k) => {
    const w = ITEMS[k]!.w;
    for (let i = 0; i <= JOY_INDEX; i++) {
      if (i >= BTN_COUNT && i !== JOY_INDEX) continue;
      const p = buttonPos(c, i);
      const r = i === JOY_INDEX ? Math.round(90 * c.scale) : buttonR(c, i);
      const nx = Math.max(x - w / 2, Math.min(p.x, x + w / 2));
      const ny = Math.max(y - H / 2, Math.min(p.y, y + H / 2));
      if (Math.hypot(nx - p.x, ny - p.y) < r) bad.push(`${k}↔${i}`);
    }
  });
  return bad;
}

describe('營火捷徑排版', () => {
  for (const left of [false, true]) {
    for (const sc of SCALES) {
      it(`${left ? '左手' : '右手'}・按鈕 ×${sc}：不重疊、不超出畫面、由左到右`, () => {
        const c = { ...setLeftHand(defaultControls(), left), scale: sc };
        const { xs, y } = fireRowLayout(c, ITEMS, 960 + TALL, H);
        expect(overlaps(c, xs, y)).toEqual([]);
        xs.forEach((x, k) => {
          expect(x - ITEMS[k]!.w / 2).toBeGreaterThanOrEqual(8);
          expect(x + ITEMS[k]!.w / 2).toBeLessThanOrEqual(712);
          if (k) expect(x - ITEMS[k]!.w / 2).toBeGreaterThanOrEqual(xs[k - 1]! + ITEMS[k - 1]!.w / 2);
        });
        expect(y).toBeGreaterThan(960 + TALL - 160);
      });
    }
  }
});
