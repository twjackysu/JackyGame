import { DATES } from '../src/data/dialogue/dates';
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state/gameState';
import { BONDS, bondMet, bondTier } from '../src/data/bonds';
import { CH1 } from '../src/data/dialogue/ch1';
import { CH2 } from '../src/data/dialogue/ch2';
import { CH3 } from '../src/data/dialogue/ch3';
import { CH4 } from '../src/data/dialogue/ch4';
import { CH5 } from '../src/data/dialogue/ch5';

describe('羈絆', () => {
  it('每個羈絆事件旗標都真的出現在劇本裡', () => {
    const src = JSON.stringify([CH1, CH2, CH3, CH4, CH5, DATES]);
    for (const b of BONDS) for (const e of b.events) expect(src, e.flag).toContain(`"flag":"${e.flag}"`);
  });
  it('階段：好感 25/階，但不超過「完成事件數 + 1」', () => {
    const s = newGame(0);
    const serin = BONDS.find((b) => b.id === 'serin')!;
    expect(bondMet(s, serin)).toBe(false);
    s.affinity.serin = 100;
    expect(bondTier(s, serin)).toBe(1);
    s.flags.bond_serin_1 = true;
    s.flags.bond_serin_2 = true;
    expect(bondTier(s, serin)).toBe(3);
    s.flags.bond_serin_3 = true;
    expect(bondTier(s, serin)).toBe(4);
    expect(bondMet(s, serin)).toBe(true);
  });
});

import { AREAS } from '../src/data/areas';
import { markerOf, present } from '../src/core/explore/area';
describe('約會事件（D-051）', () => {
  it('好感達門檻＋在隊伍中才出現「♥」，做完就消失', () => {
    const s = newGame(0);
    const e = AREAS['greylamp']!.entities.find((x) => x.id === 'date_io')!;
    expect(present(s, e)).toBe(false);
    s.party.push('io');
    s.affinity.io = 29;
    expect(present(s, e)).toBe(false);
    s.affinity.io = 30;
    expect(present(s, e)).toBe(true);
    expect(markerOf(s, 'greylamp', e)).toBe('heart');
    s.flags.date_io = true;
    expect(present(s, e)).toBe(false);
  });
  it('每個約會都有劇本節點', () => {
    for (const a of Object.values(AREAS)) for (const e of a.entities) if (e.date) expect(DATES.nodes[e.talk!.node], e.id).toBeDefined();
  });
});
