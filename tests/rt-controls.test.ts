import { describe, expect, it } from 'vitest';
import { type RtControls, DEFAULT_KEYS, JOY_INDEX, buttonPos, buttonR, defaultControls, inStickZone, keyName, rebind, sanitize, setLeftHand, swapSlots } from '../src/game/rtControls';
import { EMPTY_SNAP, mergeRun, recordBoss } from '../src/game/rtRecord';

describe('即時戰鬥操作設定（D-088）', () => {
  it('預設位置與舊版相同（右手）', () => {
    const c = defaultControls();
    expect(buttonPos(c, 0)).toEqual({ x: 470, y: 1190 });
    expect(buttonPos(c, JOY_INDEX)).toEqual({ x: 150, y: 1150 });
    expect(buttonR(c, 6)).toBe(40);
    expect(inStickZone(c, 100, 1100)).toBe(true);
    expect(inStickZone(c, 600, 1100)).toBe(false);
  });
  it('左手模式鏡射按鈕與搖桿區；自訂位置也跟著鏡射', () => {
    let c: RtControls = { ...defaultControls(), pos: { 2: { x: 600, y: 900 } } };
    c = setLeftHand(c, true);
    expect(buttonPos(c, 0)).toEqual({ x: 250, y: 1190 });
    expect(buttonPos(c, 2)).toEqual({ x: 120, y: 900 });
    expect(inStickZone(c, 600, 1100)).toBe(true);
    expect(inStickZone(c, 100, 1100)).toBe(false);
    expect(buttonPos(setLeftHand(c, false), 2)).toEqual({ x: 600, y: 900 });
  });
  it('交換技能欄', () => {
    const c = swapSlots(defaultControls(), 0, 3);
    expect(c.order).toEqual(['parry', 'whirlwind', 'charge', 'heavy_slash']);
    expect(swapSlots(c, 1, 9).order).toEqual(c.order);
  });
  it('改鍵：撞到別的動作就互換', () => {
    const c = rebind(defaultControls(), 'dodge', DEFAULT_KEYS.ult);
    expect(c.keys.dodge).toBe(DEFAULT_KEYS.ult);
    expect(c.keys.ult).toBe(DEFAULT_KEYS.dodge);
    expect(new Set(Object.values(c.keys)).size).toBe(Object.keys(c.keys).length);
  });
  it('壞資料回到預設、座標夾在畫面內、重複鍵修掉', () => {
    expect(sanitize(null)).toEqual(defaultControls());
    expect(sanitize({ order: ['a', 'b', 'c', 'd'] }).order).toEqual(defaultControls().order);
    expect(sanitize({ order: ['parry', 'parry', 'charge', 'whirlwind'] }).order).toEqual(defaultControls().order);
    const s = sanitize({ pos: { 1: { x: -50, y: 99999 }, 12: { x: 1, y: 1 } }, scale: 3, keys: { up: 32 } });
    expect(s.pos[1]).toEqual({ x: 40, y: 1240 });
    expect(s.pos[12]).toBeUndefined();
    expect(s.scale).toBe(1);
    expect(s.keys.up).toBe(32);
    expect(s.keys.dodge).toBe(0); // 空白鍵被「往上走」拿走、預設也撞 → 不綁
  });
  it('鍵名', () => {
    expect(keyName(49)).toBe('1');
    expect(keyName(32)).toBe('空白鍵');
    expect(keyName(81)).toBe('Q');
  });
});

describe('大地圖獨立紀錄（D-087）', () => {
  it('增量合併不會重複計算', () => {
    const a = { kills: 5, coin: 30, dust: 4, crystal: 0, chests: ['c1'], sec: 60 };
    const b = { kills: 9, coin: 50, dust: 6, crystal: 1, chests: ['c1', 'c2'], sec: 120 };
    let r = mergeRun({}, EMPTY_SNAP, a);
    r = mergeRun(r, a, b);
    r = mergeRun(r, b, b);
    expect(r).toMatchObject({ kills: 9, coin: 50, dust: 6, crystal: 1, chests: ['c1', 'c2'], playSec: 120 });
  });
  it('Boss 首殺、最快紀錄', () => {
    const a = recordBoss({}, 300, 1);
    expect(a.first).toBe(true);
    expect(a.rec.bestBossSec).toBe(300);
    const b = recordBoss(a.rec, 250, 2);
    expect(b).toMatchObject({ first: false, best: true });
    expect(b.rec).toMatchObject({ bossKills: 2, firstAt: 1, bestBossSec: 250 });
    const c = recordBoss(b.rec, null, 3);
    expect(c.rec.bestBossSec).toBe(250);
    expect(c.best).toBe(false);
  });
});
