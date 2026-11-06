// 即時 PvP 的伺服器房間（24 §6.2 #2、23 §6 #4，第 147 輪）：**只做協定與本機測試，不部署**（25 §4.3 零額外費用：上線只有非同步天梯）。
// 伺服器權威：房間每 tick 收雙方的指令、照順序跑同一份引擎（core），把「這個 tick 實際套用的指令」廣播給雙方（frame）。
// 客戶端只送意圖（指令＋想在哪個 tick 生效），收到 frame 自己照跑——確定性引擎 → 雙方狀態一定和伺服器一樣；
// 伺服器另外每 SNAP_EVERY tick 附上 stateHash，客戶端對不上就要整段重送（resync）。
// 防作弊：指令形狀與技能白名單（validCmd）、不能下別人的 pid、每 tick 上限、只能排未來 MAX_AHEAD tick 內、太晚到的延到下一 tick。
// 掉包：客戶端每次送出「還沒被確認的所有指令」（帶 seq，伺服器去重）；伺服器的 frame 帶 tick 連號，客戶端缺號就 resend(from)。
import { WEAPONS } from '../../core/battle/rt/data';
import { stateHash, step } from '../../core/battle/rt/engine';
import { PVP_MAX_CMDS_PER_TICK, startPvp, validCmd, type PvpMatchSetup } from '../../core/battle/rt/pvpMatch';
import type { BattleCommand, BattleState } from '../../core/battle/rt/types';
import { RT_MAX_AHEAD, RT_MAX_INPUTS_PER_MSG, RT_SNAP_EVERY, type RtClientMsg, type RtFrame, type RtServerMsg } from '../../net/realtime';

export class BattleRoom {
  readonly s: BattleState;
  /** 每個 tick 實際套用的指令（重送與重跑用） */
  readonly log: RtFrame[] = [];
  private pending = new Map<number, BattleCommand[]>();
  private lastSeq = [0, 0];
  private readonly skills: ReadonlySet<string>[];
  /** 被拒的指令數（測試／稽核） */
  rejected = 0;

  constructor(
    readonly setup: PvpMatchSetup,
    private readonly send: (pid: number, msg: RtServerMsg) => void,
  ) {
    this.s = startPvp(setup).s;
    this.skills = [new Set(Object.keys(WEAPONS[setup.me.weapon].skills)), new Set(Object.keys(WEAPONS[setup.foe.weapon].skills))];
  }

  /** 收到一個玩家的訊息（pid 由連線決定，不是訊息裡寫的） */
  receive(pid: number, raw: unknown): void {
    if (pid !== 0 && pid !== 1) return;
    const m = raw as RtClientMsg;
    if (m?.type === 'resend') {
      if (!Number.isSafeInteger(m.from) || m.from < 1) return;
      for (const f of this.log.slice(m.from - 1)) this.send(pid, { ...f, ack: this.lastSeq[pid]! });
      return;
    }
    if (m?.type !== 'input' || !Array.isArray(m.inputs) || m.inputs.length > RT_MAX_INPUTS_PER_MSG) {
      this.rejected++;
      return;
    }
    for (const x of m.inputs) {
      if (!x || !Number.isSafeInteger(x.seq) || !Number.isSafeInteger(x.t)) {
        this.rejected++;
        continue;
      }
      if (x.seq <= this.lastSeq[pid]!) continue; // 重送的（掉包補償），已經收過
      if (x.seq !== this.lastSeq[pid]! + 1) return; // 跳號：前面的還沒到，等下一包一起
      this.lastSeq[pid] = x.seq;
      if (!Array.isArray(x.c) || x.c.length > PVP_MAX_CMDS_PER_TICK || !x.c.every((c) => validCmd(c, this.skills[pid]!)) || x.t > this.s.tick + RT_MAX_AHEAD) {
        this.rejected++;
        continue;
      }
      // 太晚到（那個 tick 已經跑過）：延到下一個 tick
      const t = Math.max(x.t, this.s.tick + 1);
      const list = this.pending.get(t) ?? [];
      const cmds = x.c.map((c) => (pid ? { ...c, pid } : { ...c }));
      if (list.filter((c) => (c.pid ?? 0) === pid).length + cmds.length > PVP_MAX_CMDS_PER_TICK) {
        this.rejected++;
        continue;
      }
      this.pending.set(t, [...list, ...cmds]);
    }
  }

  /** 跑一個 tick 並廣播；結束了回 false */
  tick(): boolean {
    if (this.s.outcome !== 'running') return false;
    const t = this.s.tick + 1;
    // pid 0 的先、pid 1 的後（順序固定，客戶端照 frame 的順序跑就一樣）
    const raw = this.pending.get(t) ?? [];
    this.pending.delete(t);
    const c = [...raw.filter((x) => !x.pid), ...raw.filter((x) => x.pid === 1)];
    step(this.s, c);
    const f: RtFrame = { type: 'frame', t, c: c as unknown as RtFrame['c'], ack: 0 };
    if (t % RT_SNAP_EVERY === 0 || this.s.outcome !== 'running') {
      f.hash = stateHash(this.s);
      f.outcome = this.s.outcome;
    }
    this.log.push(f);
    for (const pid of [0, 1]) this.send(pid, { ...f, ack: this.lastSeq[pid]! });
    return this.s.outcome === 'running';
  }
}
