import { describe, expect, it } from 'vitest';
import { TIP_LINE_MAX, tipMs, wrapTip, zoneHintBreak, hintRepeats, skipFirstIntro } from '../src/game/ui/tipText';
import { makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { makeStarfallStage } from '../src/core/battle/rt/maps/starfall';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';

describe('提示大字換行（第 37 輪）', () => {
  it('短的不動、長的在標點後斷成兩行，每行不超過一行的寬度', () => {
    expect(wrapTip('紅色範圍填滿就命中——走出去！')).toBe('紅色範圍填滿就命中——走出去！');
    for (const t of ['長弓：站遠一點射！狼貼過來就走開，拉開距離再射', '法杖：狼貼過來先按「冰霜新星」凍住，再拉開距離放星焰彈', '星光碎片：落星之後地上會留 5 秒，撿起來回 MP 與 HP', '荊棘巡獵者在巡邏——別走進牠的範圍，或正面迎戰', '黃框＝可以格擋！敵人打到前按「格擋反擊」', '沒有標點的一段很長很長很長很長很長很長的文字']) {
      const w = wrapTip(t);
      expect(w.replace('\n', '')).toBe(t);
      const lines = w.split('\n');
      expect(lines.length).toBe(2);
      for (const l of lines) expect([...l].length, l).toBeLessThanOrEqual(TIP_LINE_MAX + 4);
    }
    expect(wrapTip('長弓：站遠一點射！狼貼過來就走開，拉開距離再射')).toBe('長弓：站遠一點射！\n狼貼過來就走開，拉開距離再射');
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

describe('地區說明換行（第 61 輪）', () => {
  it('在最靠近中間的「・」斷開、拿掉那個「・」；沒有「・」回傳 null', () => {
    expect(zoneHintBreak('危險：狼群首領出沒・東邊有荊棘母樹・西側有巡守巡邏')).toBe('危險：狼群首領出沒\n東邊有荊棘母樹・西側有巡守巡邏');
    expect(zoneHintBreak('岔路：西邊近但會噴發、東邊遠但有精英')).toBeNull();
    expect(zoneHintBreak('棘背狼成群・咬傷會中毒')).toBe('棘背狼成群\n咬傷會中毒');
  });
});

describe('地區說明和開場大字重複（D-221）', () => {
  const STAGES = { thornvale: makeThornvaleStage(), starfall: makeStarfallStage(), emberrift: makeEmberriftStage() };
  const zone = (st: keyof typeof STAGES, name: string): string => STAGES[st].zones!.find((z) => z.name === name)!.hint!;
  it('荊棘坡／墜星原和開場說明講同一件事；熔渣坡、營地不算', () => {
    expect(hintRepeats(zone('thornvale', '荊棘坡'), STAGES.thornvale.intro!)).toBe(true);
    expect(hintRepeats(zone('starfall', '墜星原'), STAGES.starfall.intro!)).toBe(true);
    expect(hintRepeats(zone('emberrift', '熔渣坡'), STAGES.emberrift.intro!)).toBe(false);
    expect(hintRepeats(zone('thornvale', '谷口營地'), STAGES.thornvale.intro!)).toBe(false);
  });
  it('短於 5 字的巧合不算', () => {
    expect(hintRepeats('會噴發', '熔岩口會噴發')).toBe(false);
    expect(hintRepeats('', 'abc')).toBe(false);
  });
});

describe('新存檔開場省掉金色大字（第 169 輪，D-366）', () => {
  const base = { firstMap: true, returning: false, hintSeen: false, extra: false };
  it('全新玩家第一次進第一張圖：省掉，操作說明先出', () => {
    expect(skipFirstIntro(base)).toBe(true);
  });
  it('看過操作說明的人、老玩家的「歡迎回到」、其他地圖的危險說明、有附加訊息時照舊', () => {
    expect(skipFirstIntro({ ...base, hintSeen: true })).toBe(false);
    expect(skipFirstIntro({ ...base, returning: true })).toBe(false);
    expect(skipFirstIntro({ ...base, firstMap: false })).toBe(false);
    expect(skipFirstIntro({ ...base, extra: true })).toBe(false);
  });
});

describe('巢穴倒數字（第 175 輪）', () => {
  it('剩幾秒：一位小數、過了就停在 0.0', async () => {
    const { lairCountText } = await import('../src/game/ui/tipText');
    expect(lairCountText(100, 100, 90, 30)).toBe('3.0');
    expect(lairCountText(100, 136, 90, 30)).toBe('1.8');
    expect(lairCountText(100, 190, 90, 30)).toBe('0.0');
    expect(lairCountText(100, 400, 90, 30)).toBe('0.0'); // Boss 正在出招、還沒回家的那幾幀不顯示負數
  });
});

describe('精英快脫戰的預告（第 177 輪）', () => {
  it('離家七成以內不提醒；之後越遠越強，到脫戰距離是 1', async () => {
    const { leashNear } = await import('../src/game/ui/tipText');
    expect(leashNear(0, 1600)).toBe(0);
    expect(leashNear(1100, 1600)).toBe(0);
    const a = leashNear(1300, 1600);
    const b = leashNear(1500, 1600);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(leashNear(1600, 1600)).toBe(1);
    expect(leashNear(2400, 1600)).toBe(1); // 正在出招、還沒回家的那幾幀不超過 1
    expect(leashNear(100, 0)).toBe(0);
  });
});

describe('提示不會寬到貼住畫面兩邊（第 203 輪）', () => {
  it('zh-TW 裡所有 tip 字串換行後，每一行都在 21 個全形字以內', async () => {
    const { wrapTip, tipLineUnits, TIP_LINE_UNITS_MAX } = await import('../src/game/ui/tipText');
    const { default: fs } = await import('node:fs');
    const src = fs.readFileSync('src/i18n/zh-TW.ts', 'utf8');
    const tips = [...src.matchAll(/'((?:[a-zA-Z0-9]+\.)*tip(?:\.[a-zA-Z0-9]+)*)':\s*'([^'\n]+)'/g)].map((m) => [m[1]!, m[2]!.replace(/\\n/g, '\n')] as const);
    expect(tips.length).toBeGreaterThan(3);
    for (const [k, t] of tips) for (const line of wrapTip(t).split('\n')) expect(tipLineUnits(line), `${k}：${line}`).toBeLessThanOrEqual(TIP_LINE_UNITS_MAX);
  });
  it('半形字算半個多一點', async () => {
    const { tipLineUnits } = await import('../src/game/ui/tipText');
    expect(tipLineUnits('閃避')).toBe(2);
    expect(tipLineUnits('MENU')).toBeCloseTo(2.24);
  });
});
