import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../src/data/cards';
import { hasEmblem } from '../src/game/art/cardEmblems';

describe('燼牌紋章', () => {
  it('每張牌都有專屬紋章', () => {
    expect(CARD_LIST.filter((c) => !hasEmblem(c.id)).map((c) => c.id)).toEqual([]);
  });
});
