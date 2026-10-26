import { describe, expect, it } from 'vitest';
import { TIP_LINE_MAX, wrapTip } from '../src/game/ui/tipText';

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
});
