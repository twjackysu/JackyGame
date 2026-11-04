import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// D-263：桌機拖搖桿移出畫面才放開，Phaser 只發 pointerupoutside（不發 pointerup）→ 主角會一直走。
describe('即時戰鬥放開指標', () => {
  it('pointerup 與 pointerupoutside 都會放開搖桿', () => {
    const src = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(src).toMatch(/input\.on\('pointerup',[^\n]*onUp/);
    expect(src).toMatch(/input\.on\('pointerupoutside',[^\n]*onUp/);
  });
});
