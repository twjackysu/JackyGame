// 角色快取（第 147 輪）：晚到的舊回應不能蓋掉新的；沒帶號碼的一律更新；換角色清掉。
import { describe, expect, it } from 'vitest';
import { characterCache } from '../src/client/characterCache';
import type { CharacterView } from '../src/net/views';

const view = (id: string, coin: number): CharacterView =>
  ({ id, slot: 0, name: 'a', weapon: 'sword', level: 1, xp: 0, wallet: { coin, dust: 0, crystal: 0 }, stats: {}, skills: null, variants: null, bounty: null, shop: null, maps: {}, items: [] }) as CharacterView;

describe('characterCache', () => {
  it('回來順序顛倒時保留比較新的請求', () => {
    characterCache.clear();
    const seen: number[] = [];
    const off = characterCache.subscribe((v) => seen.push(v.wallet.coin));
    const a = characterCache.ticket();
    const b = characterCache.ticket();
    characterCache.set(view('c1', 20), b);
    characterCache.set(view('c1', 10), a);
    expect(characterCache.wallet('coin')).toBe(20);
    characterCache.set(view('c1', 5));
    expect(characterCache.wallet('coin')).toBe(5);
    expect(seen).toEqual([20, 5]);
    off();
  });
  it('換了角色就不比號碼；clear 之後是 null', () => {
    const b = characterCache.ticket();
    const a = characterCache.ticket();
    characterCache.set(view('c1', 1), a);
    characterCache.set(view('c2', 2), b);
    expect(characterCache.get()?.id).toBe('c2');
    characterCache.clear();
    expect(characterCache.get()).toBeNull();
    expect(characterCache.wallet('coin')).toBeNull();
  });
});
