// 即時 PvP（第 147 輪，24 §6.2 #2 的本機驗收）：兩個 RoomClient 透過模擬網路（單程 80ms＝約 3 tick 延遲、2% 掉包）打完一場，
// 雙方的狀態和伺服器一模一樣（hash 相同、沒有 desync），伺服器的結果也能用指令紀錄重跑出來；作弊的指令被拒。
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { stateHash, step, playerOf } from '../src/core/battle/rt/engine';
import { startPvp, type PvpMatchSetup } from '../src/core/battle/rt/pvpMatch';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleCommand, BattleCommandBody } from '../src/core/battle/rt/types';
import { BattleRoom } from '../src/server/realtime/BattleRoom';
import { RoomClient } from '../src/client/RoomClient';
import type { RtClientMsg, RtServerMsg } from '../src/net/realtime';

const setup = (seed: number): PvpMatchSetup => ({ seed, me: { weapon: 'sword', bonus: { hp: 40, atk: 6, def: 2 } }, foe: { weapon: 'bow', bonus: { hp: 40, atk: 6, def: 2 } } });

/** 模擬網路：延遲 delay 個 tick、loss 機率掉包（種子固定） */
function net(delay: number, loss: number, seed: number) {
  const R = mulberry32(seed);
  const q: { at: number; run: () => void }[] = [];
  let now = 0;
  return {
    send(run: () => void) {
      if (R() < loss) return;
      q.push({ at: now + delay, run });
    },
    advance() {
      now++;
      const due = q.filter((x) => x.at <= now);
      for (const x of due) q.splice(q.indexOf(x), 1);
      for (const x of due) x.run();
    },
  };
}

function play(seed: number, loss: number) {
  const m = setup(seed);
  const n = net(3, loss, seed * 7 + 1);
  const clients: RoomClient[] = [];
  const room = new BattleRoom(m, (pid, msg: RtServerMsg) => n.send(() => clients[pid]!.receive(JSON.parse(JSON.stringify(msg)))));
  for (const pid of [0, 1]) clients.push(new RoomClient(m, (msg: RtClientMsg) => n.send(() => room.receive(pid, JSON.parse(JSON.stringify(msg))))));
  // 兩邊都是 Bot 在「玩家的畫面」上決定（看自己那份狀態），送意圖給伺服器
  const bots = [new PlayerBot(BOT_PROFILES.normal!, 'a', 0), new PlayerBot(BOT_PROFILES.normal!, 'b', 1)];
  let guard = 0;
  while (room.s.outcome === 'running' && guard++ < 20000) {
    for (const pid of [0, 1]) {
      const c = clients[pid]!;
      if (c.s.outcome === 'running') c.act(bots[pid]!.decide(c.s).map(({ pid: _p, ...body }) => body as BattleCommandBody));
      c.flush();
    }
    room.tick();
    n.advance();
  }
  // 收尾：讓最後的 frame 都送到（掉的靠 resend）
  for (let i = 0; i < 200; i++) {
    for (const pid of [0, 1]) if (clients[pid]!.s.tick < room.s.tick) n.send(() => room.receive(pid, { type: 'resend', from: clients[pid]!.s.tick + 1 }));
    n.advance();
  }
  return { room, clients };
}

describe('即時 PvP（BattleRoom＋RoomClient）', () => {
  it('80ms 延遲、2% 掉包：雙方狀態和伺服器完全一樣、打得出勝負', () => {
    for (const seed of [1, 2, 3]) {
      const { room, clients } = play(seed, 0.02);
      expect(room.s.outcome).not.toBe('running');
      const h = stateHash(room.s);
      for (const c of clients) {
        expect(c.desync).toBe(0);
        expect(c.s.tick).toBe(room.s.tick);
        expect(stateHash(c.s)).toBe(h);
      }
      expect(room.rejected).toBe(0);
      // 指令紀錄重跑＝同一個結果（稽核／重播用）
      const r = startPvp(room.setup).s;
      for (const f of room.log) step(r, f.c as unknown as BattleCommand[]);
      expect(stateHash(r)).toBe(h);
      // 兩邊真的有在打（雙方都受傷或有人倒下）
      expect(room.log.some((f) => f.c.some((c) => c.pid === 1))).toBe(true);
      expect(room.log.some((f) => f.c.some((c) => !c.pid))).toBe(true);
    }
  });

  it('作弊：下別人的 pid、沒有的技能、形狀不對、排太遠、一次太多都被拒；重送的不會套用兩次', () => {
    const m = setup(9);
    const sent: RtServerMsg[] = [];
    const room = new BattleRoom(m, (_pid, msg) => sent.push(msg));
    const before = playerOf(room.s).hp;
    room.receive(0, { type: 'input', inputs: [{ seq: 1, t: 1, c: [{ type: 'move', dx: 1, dy: 0, pid: 1 } as unknown as BattleCommandBody] }] });
    room.receive(0, { type: 'input', inputs: [{ seq: 2, t: 1, c: [{ type: 'skill', id: 'meteor' } as unknown as BattleCommandBody] }] });
    room.receive(0, { type: 'input', inputs: [{ seq: 3, t: 1, c: [{ type: 'move', dx: 1e9, dy: 0 }] }] });
    room.receive(0, { type: 'input', inputs: [{ seq: 4, t: 999, c: [{ type: 'stop' }] }] });
    room.receive(0, { type: 'input', inputs: [{ seq: 5, t: 1, c: Array.from({ length: 5 }, () => ({ type: 'stop' as const })) }] });
    room.receive(0, { type: 'input', inputs: Array.from({ length: 65 }, (_, i) => ({ seq: 6 + i, t: 1, c: [{ type: 'stop' as const }] })) });
    expect(room.rejected).toBe(6);
    room.receive(0, { type: 'input', inputs: [{ seq: 6, t: 1, c: [{ type: 'move', dx: 1, dy: 0 }] }] });
    room.receive(0, { type: 'input', inputs: [{ seq: 6, t: 1, c: [{ type: 'move', dx: 1, dy: 0 }] }] });
    room.tick();
    expect(sent.filter((x) => x.t === 1).length).toBe(2);
    expect(room.log[0]!.c).toEqual([{ type: 'move', dx: 1, dy: 0 }]);
    expect(playerOf(room.s).hp).toBe(before);
  });
});
