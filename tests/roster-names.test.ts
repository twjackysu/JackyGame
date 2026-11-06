// 改名的名字池（第 147 輪）：按一下換下一個、跳過別的角色在用的
import { describe, expect, it } from 'vitest';
import { NAME_POOL, nextName } from '../src/game/rosterNames';

describe('nextName', () => {
  it('下一個、繞回開頭、跳過在用的', () => {
    expect(nextName(NAME_POOL[0]!, [])).toBe(NAME_POOL[1]);
    expect(nextName(NAME_POOL[NAME_POOL.length - 1]!, [])).toBe(NAME_POOL[0]);
    expect(nextName(NAME_POOL[0]!, [NAME_POOL[1]!])).toBe(NAME_POOL[2]);
    expect(nextName('旅人', [])).toBe(NAME_POOL[0]);
  });
});
