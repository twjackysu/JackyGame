import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LANE_FAR, LANE_LAYERS, LANE_SEGS, RING_INNER_EDGE, SECTOR_BANDS, SECTOR_SIDE, areaLook, laneBand, ringBands } from '../src/game/fx/areaLook';
import { telegraphLook } from '../src/game/fx/telegraphLook';

describe('玩家技能範圍的長相（第 182 輪，D-378）', () => {
  it('三把武器各有自己的顏色；火／冰／毒／緩速蓋過武器色', () => {
    const w = (['sword', 'bow', 'staff'] as const).map((x) => areaLook(x).fill);
    expect(new Set(w).size).toBe(3);
    for (const st of ['burn', 'freeze', 'poison', 'slow']) {
      expect(areaLook('sword', st).fill).toBe(areaLook('staff', st).fill);
      expect(w).not.toContain(areaLook('sword', st).fill);
    }
    expect(areaLook('bow', 'break').fill).toBe(areaLook('bow').fill); // 沒有專屬色的狀態用武器色
  });

  it('不會和敵人預告的危險色撞色', () => {
    const danger = (['phys', 'status', 'meteor'] as const).flatMap((k) => { const l = telegraphLook(k, false, 0.5, 0); return [l.fill, l.edge]; });
    for (const wp of ['sword', 'bow', 'staff'] as const) {
      for (const st of [undefined, 'burn', 'freeze', 'poison', 'slow']) {
        const l = areaLook(wp, st);
        expect(danger).not.toContain(l.fill);
        expect(danger).not.toContain(l.edge);
      }
    }
  });

  it('直線：靠主角最亮、越遠越淡，但末端仍看得到（射程是玩法資訊）', () => {
    expect(laneBand(0)).toBe(1);
    for (let i = 1; i < LANE_SEGS; i++) expect(laneBand(i)).toBeLessThan(laneBand(i - 1));
    expect(laneBand(LANE_SEGS - 1)).toBeCloseTo(LANE_FAR, 5);
    expect(LANE_FAR).toBeGreaterThanOrEqual(0.25);
    expect(laneBand(0, 1)).toBe(1);
  });

  it('直線橫向：最外層是完整寬度（範圍不縮水），越往中間越窄越實；疊起來不會變成一片實心', () => {
    expect(LANE_LAYERS[0]!.w).toBe(1);
    for (let i = 1; i < LANE_LAYERS.length; i++) expect(LANE_LAYERS[i]!.w).toBeLessThan(LANE_LAYERS[i - 1]!.w);
    const peak = LANE_LAYERS.reduce((a, l) => a + l.a, 0) * areaLook('sword').fillA;
    expect(peak).toBeLessThan(0.35);
  });

  it('扇形：一圈一圈接起來蓋滿整個半徑、越外面越實；半徑邊比外弧淡很多', () => {
    expect(SECTOR_BANDS[0]!.r0).toBe(0);
    expect(SECTOR_BANDS[SECTOR_BANDS.length - 1]!.r1).toBe(1);
    for (let i = 1; i < SECTOR_BANDS.length; i++) {
      expect(SECTOR_BANDS[i]!.r0).toBe(SECTOR_BANDS[i - 1]!.r1);
      expect(SECTOR_BANDS[i]!.a).toBeGreaterThan(SECTOR_BANDS[i - 1]!.a);
    }
    expect(SECTOR_SIDE).toBeLessThan(0.5);
  });

  it('戰鬥場景的直線／扇形走這一套，不再是平藍＋封閉外框', () => {
    const src = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(src).toContain('this.softLane(g, shp');
    expect(src).toContain('this.softSector(g, shp');
    expect(src).toContain('this.softLane(g, hs'); // 瞄準中的直線
  });
  it('第 183 輪：環一圈一圈接起來蓋滿內外半徑之間、外半比內半實；內圈邊線比外圈淡', () => {
    const b = ringBands(200, 450);
    expect(b[0]!.r0).toBe(200);
    expect(b[b.length - 1]!.r1).toBe(450);
    for (let i = 1; i < b.length; i++) {
      expect(b[i]!.r0).toBe(b[i - 1]!.r1);
      expect(b[i]!.a).toBeGreaterThan(b[i - 1]!.a);
    }
    expect(RING_INNER_EDGE).toBeLessThan(1);
  });
  it('第 183 輪：圓與環也走這一套（不再是不分武器的灰藍平圓盤）', () => {
    const src = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(src).toContain('this.softRound(g, shp');
    expect(src).not.toContain(': 0x7dc8ff,'); // 以前的預設平藍
  });
});
