// 拍賣所賣出通知的字（第 149 輪，src/game/marketNews.ts）
import { describe, expect, it } from 'vitest';
import { soldNewsText } from '../src/game/marketNews';
import { sellerGets } from '../src/core/meta/market';
import { genGear } from '../src/core/battle/rt/gear';
import { gearTitleW } from '../src/game/weapon';
import type { ListingView } from '../src/net/views';

const lv = (seed: number, price: number): ListingView => ({ id: `l${seed}`, sellerName: '我', mine: true, price, status: 'sold', gear: genGear(seed, 2, 5) as unknown as Record<string, unknown>, createdAt: 0, expiresAt: 1 });

describe('拍賣所賣出通知', () => {
  it('沒有＝null；一兩件寫名字、三件以上寫「等 N 件」；金額是扣手續費後實拿', () => {
    expect(soldNewsText([], true)).toBeNull();
    const a = lv(1, 300);
    const name = gearTitleW(a.gear as never, 'sword');
    expect(soldNewsText([a], true, 'sword')).toBe(`你不在的時候賣出 1 件・+${sellerGets(300)} 金\n${name}`);
    const three = [a, lv(2, 400), lv(3, 500)];
    const t = soldNewsText(three, false, 'sword')!;
    expect(t.split('\n')[0]).toBe(`剛剛有人買走 3 件・+${sellerGets(300) + sellerGets(400) + sellerGets(500)} 金`);
    expect(t.split('\n')).toHaveLength(4);
    expect(t.endsWith('…等 3 件')).toBe(true);
  });
});
