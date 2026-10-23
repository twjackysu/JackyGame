import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript } from '../src/core/dialogue/runner';
import { newGame } from '../src/core/state/gameState';

const script: DialogueScript = {
  id: 'test.inn',
  nodes: {
    start: [
      { say: 'rourke', text: 'hello' },
      { say: 'rourke', text: 'only-if-caravan', if: { flag: 'saved_caravan' } },
      {
        choice: [
          { text: 'play', next: 'play' },
          { text: 'know', check: { codex: 'rourke_cheat' }, effects: [{ divergence: 3 }], next: 'expose' },
          { text: 'cha', check: { stat: 'cha', dc: 5 }, next: 'ok', fail: 'nope', failEffects: [{ affinity: 'rourke', delta: -5 }] },
          { text: 'hidden', next: 'ok', if: { flag: 'never' } },
        ],
      },
    ],
    play: [{ event: 'cards', id: 'rourke_official', outcomes: { win: 'won', lose: 'lost' } }],
    won: [{ say: 'rourke', text: 'won', effects: [{ card: 'c_veteran' }] }],
    lost: [{ say: 'rourke', text: 'lost' }],
    expose: [{ effects: [{ flag: 'rourke_cheat_known' }] }, { goto: 'won' }],
    ok: [{ say: 'rourke', text: 'ok' }],
    nope: [{ say: 'rourke', text: 'nope' }],
  },
};

describe('DialogueRunner', () => {
  it('runs say lines, filters by condition, and shows choices', () => {
    const r = new DialogueRunner(script, newGame(0));
    expect(r.next()).toEqual({ kind: 'say', speaker: 'rourke', text: 'hello' });
    const c = r.next();
    expect(c.kind).toBe('choice');
    if (c.kind !== 'choice') return;
    expect(c.options.map((o) => o.text)).toEqual(['play', 'know', 'cha']);
    expect(c.options[1]?.chance).toBe(0); // 沒有筆記
    expect(c.options[2]?.chance).toBeCloseTo(0.38); // 魅 4 vs 5
  });

  it('handles events and resume outcomes', () => {
    const s = newGame(0);
    const r = new DialogueRunner(script, s);
    r.next();
    r.next();
    expect(r.choose(0)).toBeNull();
    expect(r.next()).toEqual({ kind: 'event', event: 'cards', id: 'rourke_official' });
    r.resume('win');
    expect(r.next()).toEqual({ kind: 'say', speaker: 'rourke', text: 'won' });
    expect(s.cards.c_veteran).toBe(1);
    expect(r.next()).toEqual({ kind: 'end' });
  });

  it('codex choice always succeeds and applies divergence', () => {
    const s = newGame(0);
    s.codex.push('rourke_cheat');
    const r = new DialogueRunner(script, s);
    r.next();
    r.next();
    expect(r.choose(1)).toMatchObject({ kind: 'roll', success: true, chance: 1 });
    expect(r.next()).toMatchObject({ kind: 'say', text: 'won' });
    expect(s.divergence).toBe(3);
    expect(s.flags.rourke_cheat_known).toBe(true);
  });

  it('stat check failure goes to fail node with failEffects', () => {
    const s = newGame(0);
    s.affinity.rourke = 10;
    const r = new DialogueRunner(script, s, () => 0.99);
    r.next();
    r.next();
    expect(r.choose(2)).toMatchObject({ kind: 'roll', success: false });
    expect(r.next()).toMatchObject({ text: 'nope' });
    expect(s.affinity.rourke).toBe(5);
  });
});
