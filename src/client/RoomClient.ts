// 即時 PvP 的客戶端（第 147 輪）：見 src/server/realtime/BattleRoom.ts 的說明。只用 core 引擎＋訊息格式，不碰伺服器程式。
import { stateHash, step } from '../core/battle/rt/engine';
import { PVP_MAX_CMDS_PER_TICK, startPvp, type PvpMatchSetup } from '../core/battle/rt/pvpMatch';
import type { BattleCommand, BattleCommandBody, BattleState } from '../core/battle/rt/types';
import { RT_MAX_INPUTS_PER_MSG, type RtClientMsg, type RtFrame, type RtInputMsg, type RtServerMsg } from '../net/realtime';

/**
 * 客戶端這一邊：自己跑一份引擎，**只照伺服器的 frame 前進**（不預測；手感用的本地預測之後畫面接的時候再加）。
 * 送出的指令保留到伺服器 ack 為止，每次都整批重送（掉包補償）；frame 缺號就要求 resend。
 */
export class RoomClient {
  readonly s: BattleState;
  private unacked: RtInputMsg['inputs'] = [];
  private seq = 0;
  private early = new Map<number, RtFrame>();
  /** 伺服器附的 hash 和自己算的不一樣的次數（應該永遠是 0） */
  desync = 0;
  lastHash = '';

  constructor(
    setup: PvpMatchSetup,
    private readonly send: (msg: RtClientMsg) => void,
  ) {
    this.s = startPvp(setup).s;
  }

  /** 玩家的操作：排在 delay 個 tick 之後生效（輸入延遲換取雙方一致） */
  act(c: BattleCommandBody[], delay = 3): void {
    if (c.length) this.unacked.push({ seq: ++this.seq, t: this.s.tick + delay, c: c.slice(0, PVP_MAX_CMDS_PER_TICK) as unknown as RtInputMsg['inputs'][number]['c'] });
  }

  /** 把還沒確認的送出去（每個 tick 叫一次） */
  flush(): void {
    if (this.unacked.length) this.send({ type: 'input', inputs: this.unacked.slice(0, RT_MAX_INPUTS_PER_MSG) });
  }

  receive(f: RtServerMsg): void {
    if (f.type !== 'frame') return;
    this.unacked = this.unacked.filter((x) => x.seq > f.ack);
    if (f.t <= this.s.tick) return;
    this.early.set(f.t, f);
    if (f.t > this.s.tick + 1 && !this.early.has(this.s.tick + 1)) this.send({ type: 'resend', from: this.s.tick + 1 });
    for (let n = this.early.get(this.s.tick + 1); n; n = this.early.get(this.s.tick + 1)) {
      this.early.delete(n.t);
      step(this.s, n.c as unknown as BattleCommand[]); // 伺服器檢查過、照它的順序跑
      if (n.hash) {
        this.lastHash = stateHash(this.s);
        if (this.lastHash !== n.hash) this.desync++;
      }
    }
  }
}
