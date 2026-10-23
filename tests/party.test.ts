import { describe, expect, it } from 'vitest';
import { swapPartyMembers, type MemberId } from '../src/core/state/gameState';

const P: MemberId[] = ['lian', 'io', 'serin', 'liora'];
describe('swapPartyMembers', () => {
  it('上場與待命交換', () => {
    expect(swapPartyMembers(P, 1, 3)).toEqual(['lian', 'liora', 'serin', 'io']);
  });
  it('連恩可以換位置但不能下場', () => {
    expect(swapPartyMembers(P, 0, 2)).toEqual(['serin', 'io', 'lian', 'liora']);
    expect(swapPartyMembers(P, 0, 3)).toBeNull();
  });
  it('非法索引回傳 null，不改原陣列', () => {
    expect(swapPartyMembers(P, 1, 1)).toBeNull();
    expect(swapPartyMembers(P, 1, 9)).toBeNull();
    expect(P).toEqual(['lian', 'io', 'serin', 'liora']);
  });
});
