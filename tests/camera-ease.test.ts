import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Phaser 內部模組沒有型別宣告
import EaseMap from 'phaser/src/math/easing/EaseMap.js';

// 相機 zoomTo/pan 不像 tween 會把 'Cubic.Out' 轉成 'Cubic.easeOut'；查不到就會 this.ease is not a function。
describe('相機緩動名稱', () => {
  it('zoomTo / pan 使用的 ease 都在 Phaser EaseMap 裡', () => {
    const dir = 'src/game/scenes';
    const bad: string[] = [];
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      for (const m of src.matchAll(/\.(?:zoomTo|pan)\([^)]*?'([A-Za-z.]+)'\)/g)) {
        if (!(m[1]! in (EaseMap as Record<string, unknown>))) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
