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
    const src = JSON.stringify([CH1, CH2, CH3, CH4, CH5]);
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
