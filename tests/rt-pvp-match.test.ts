// 非同步 PvP 對戰的重播驗證（Q7 地基）：本機打的結果＝伺服器重跑的結果；造假的紀錄被拒或改變不了結果。
import { describe, expect, it } from 'vitest';
import { playPvp, replayPvp, type PvpMatchSetup } from '../src/core/battle/rt/pvpMatch';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleCommandBody } from '../src/core/battle/rt/types';

const M = (seed: number, me: PvpMatchSetup['me']['weapon'] = 'sword', foe: PvpMatchSetup['foe']['weapon'] = 'bow'): PvpMatchSetup => ({ seed, me: { weapon: me, bonus: { hp: 40, atk: 6, def: 2 } }, foe: { weapon: foe, bonus: { hp: 40, atk: 6, def: 2 } } });
/** 用 Bot 當「玩家」打一場（指令拿掉 pid＝玩家自己下的） */
const botPlay = (m: PvpMatchSetup) => {
  const bot = new PlayerBot(BOT_PROFILES.normal!, 'me');
  return playPvp(m, (s) => bot.decide(s) as BattleCommandBody[]);
};

describe('非同步 PvP 重播', () => {
  it('本機打的結果和伺服器重跑一模一樣（三種武器組合 × 3 個種子）', () => {
    for (const [a, b] of [['sword', 'bow'], ['bow', 'staff'], ['staff', 'sword']] as const)
      for (let seed = 1; seed <= 3; seed++) {
        const m = M(seed, a, b);
        const local = botPlay(m);
        expect(local.s.outcome).not.toBe('running');
        const r = replayPvp(m, JSON.parse(JSON.stringify(local.inputs)));
        expect(r).not.toBeNull();
        expect(r!.hash).toBe(local.hash);
        expect(r!.s.outcome).toBe(local.s.outcome);
      }
  });

  it('造假的紀錄：亂序、太多指令、不合法的指令、幫對手下指令、結束後多塞 → 整場拒絕', () => {
    const m = M(5);
    const { inputs } = botPlay(m);
    expect(inputs.length).toBeGreaterThan(3);
    const bad: unknown[] = [
      [...inputs].reverse(),
      [{ t: 1, c: [{ type: 'potion' }, { type: 'potion' }, { type: 'potion' }, { type: 'potion' }, { type: 'potion' }] }],
      [{ t: 1, c: [{ type: 'skill', id: 'god_mode' }] }],
      [{ t: 1, c: [{ type: 'move', dx: 1e9, dy: 0 }] }],
      [{ t: 1, c: [{ type: 'stop', pid: 1 }] }],
      [{ t: 1, c: [{ type: 'move', dx: 1, dy: 0, hp: 9999 }] }],
      [...inputs, { t: 999_999, c: [{ type: 'stop' }] }],
      'not an array',
      [{ t: 0, c: [{ type: 'stop' }] }],
    ];
    for (const b of bad) expect(replayPvp(m, b)).toBeNull();
  });

  it('什麼都不做的紀錄也是合法的一場（站著被打），結果由伺服器決定', () => {
    const r = replayPvp(M(2), []);
    expect(r).not.toBeNull();
    expect(r!.s.outcome).toBe('defeat');
  });
});
