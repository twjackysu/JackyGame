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

describe('桌機 Esc（D-266）', () => {
  it('Esc 走返回鍵；操作設定等新按鍵時讓給面板', () => {
    const src = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(src).toMatch(/keydown-ESC[\s\S]{0,120}keyWait[\s\S]{0,40}pressBack\(\)/);
    expect(readFileSync('src/game/ui/rtControlsPanel.ts', 'utf8')).toMatch(/setData\('keyWait'/);
  });
});
