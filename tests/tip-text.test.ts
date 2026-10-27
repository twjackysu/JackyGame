import { describe, expect, it } from 'vitest';
import { TIP_LINE_MAX, tipMs, wrapTip } from '../src/game/ui/tipText';

describe('提示大字換行（第 37 輪）', () => {
  it('短的不動、長的在標點後斷成兩行，每行不超過一行的寬度', () => {
    expect(wrapTip('紅色範圍填滿就命中——走出去！')).toBe('紅色範圍填滿就命中——走出去！');
    for (const t of ['長弓：站遠一點射！狼貼過來就按「後躍射擊」拉開距離', '法杖：狼貼過來先按「冰霜新星」凍住，再拉開距離放星焰彈', '星光碎片：落星之後地上會留 5 秒，撿起來回 MP 與 HP', '荊棘巡獵者在巡邏——別走進牠的範圍，或正面迎戰', '黃框＝可以格擋！敵人打到前按「格擋反擊」', '沒有標點的一段很長很長很長很長很長很長的文字']) {
      const w = wrapTip(t);
      expect(w.replace('\n', '')).toBe(t);
      const lines = w.split('\n');
      expect(lines.length).toBe(2);
      for (const l of lines) expect([...l].length, l).toBeLessThanOrEqual(TIP_LINE_MAX + 4);
    }
    expect(wrapTip('長弓：站遠一點射！狼貼過來就按「後躍射擊」拉開距離')).toBe('長弓：站遠一點射！\n狼貼過來就按「後躍射擊」拉開距離');
  });
  it('不會斷出只有標點的一行（第 45 輪）；四張圖的 Boss 提示每行都有字', async () => {
    expect(wrapTip('（記得……狼后衝鋒撞到岩壁會暈很久！）')).toBe('（記得……\n狼后衝鋒撞到岩壁會暈很久！）');
    const { WORLD_MAPS } = await import('../src/game/worldMaps');
    for (const m of WORLD_MAPS) for (const l of wrapTip(m.bossTip).split('\n')) expect(l.replace(/[！，：。、…—（）「」？]/g, '').length, m.bossTip).toBeGreaterThanOrEqual(2);
  });
  it('提示停留時間：短的 2.2 秒、長的隨字數加長，最多 4 秒（第 40 輪）', () => {
    expect(tipMs('（記得……牠衝鋒撞到樹或石頭會暈！）')).toBe(2200);
    const long = tipMs('（記得……岩王很慢！紅圈跑出去，黃框的拳頭能格擋！）');
    expect(long).toBeGreaterThan(2200);
    expect(long).toBeLessThanOrEqual(4000);
    expect(tipMs('字'.repeat(100))).toBe(4000);
  });
});
