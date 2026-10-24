import { describe, expect, it } from 'vitest';
import { applyEffects, newGame, newGamePlus } from '../src/core/state/gameState';

describe('二週目 newGamePlus', () => {
  it('保留等級、金錢、收藏與結局紀錄，劇情旗標歸零', () => {
    const p = newGame(0);
    p.members.lian!.level = 18;
    p.gold = 900;
    p.cards = { n_starcrown: 1 };
    Object.assign(p.flags, { ch5_complete: true, ending: 'dream', tip_map: true, __script: 'map', io_named: true });
    const s = newGamePlus(p, 1);
    expect(s.members.lian!.level).toBe(18);
    expect(s.gold).toBe(900);
    expect(s.cards).toEqual({ n_starcrown: 1 });
    expect(s.flags).toEqual({ ng_plus: 1, tip_map: true, ending_seen_dream: true });
    expect(s.location.region).toBe('ch0');
    // 同伴加入沿用連恩等級
    applyEffects(s, [{ join: 'io' }]);
    expect(s.members.io!.level).toBe(18);
    // 收藏不與前一份共用參照
    s.cards.x = 1;
    expect(p.cards.x).toBeUndefined();
  });
  it('三週目累加', () => {
    const p = newGame(0);
    p.flags.ng_plus = 1;
    expect(newGamePlus(p).flags.ng_plus).toBe(2);
  });
});
