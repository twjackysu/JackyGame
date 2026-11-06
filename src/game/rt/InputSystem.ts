// 輸入系統（Q5 拆 RtBattleScene 第一塊，第 141 輪）：搖桿、鍵盤、點擊累積的指令 → 每個 tick 的 BattleCommand[]。
// 連線版這一層就是「送出去的意圖」：伺服器／BattleRoom 只收這裡產生的指令。
// 點擊的命中判定（按鈕、小地圖、營火、敵人）還在場景（要看畫面上的東西），判定完呼叫 push()。
import Phaser from 'phaser';
import type { BattleCommand } from '../../core/battle/rt/types';
import { ACTIONS, type RtAction, type RtControls } from '../rtControls';

export interface Stick {
  id: number;
  bx: number;
  by: number;
  dx: number;
  dy: number;
}

export class InputSystem {
  /** 這一 tick 之前累積的指令（點按鈕、點地、點敵人…） */
  private pending: BattleCommand[] = [];
  /** 虛擬搖桿（觸控）；dx／dy 是 −1000～1000 的方向 */
  stick: Stick | null = null;
  /** 點營火＝走過去，到了自動休息 */
  restOnArrive = false;
  private keys?: Partial<Record<RtAction, Phaser.Input.Keyboard.Key>>;

  push(c: BattleCommand): void {
    this.pending.push(c);
  }

  /** 重開一場：清掉累積的指令與搖桿 */
  reset(): void {
    this.pending = [];
    this.stick = null;
  }

  /** 桌機快捷鍵（照操作設定綁定；改鍵後重綁） */
  bindKeys(kb: Phaser.Input.Keyboard.KeyboardPlugin | null | undefined, ctl: RtControls): void {
    if (!kb) return;
    for (const k of Object.values(this.keys ?? {})) if (k) kb.removeKey(k);
    const keys: Partial<Record<RtAction, Phaser.Input.Keyboard.Key>> = {};
    for (const a of ACTIONS) if (ctl.keys[a]) keys[a] = kb.addKey(ctl.keys[a]);
    this.keys = keys;
  }

  stickStart(p: { id: number; x: number; y: number }): void {
    this.stick = { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 };
  }

  stickMove(p: { id: number; x: number; y: number; isDown: boolean }): void {
    const s = this.stick;
    if (!s || p.id !== s.id || !p.isDown) return;
    const dx = p.x - s.bx;
    const dy = p.y - s.by;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      s.dx = 0;
      s.dy = 0;
    } else {
      s.dx = Math.round((dx / d) * 1000);
      s.dy = Math.round((dy / d) * 1000);
    }
  }

  stickEnd(p: { id: number }): void {
    if (this.stick && p.id === this.stick.id) this.stick = null;
  }

  /** 這一 tick 的指令：移動（搖桿／鍵盤）放第一個，其他照順序；nearRest＝主角在營火休息範圍內 */
  commands(slotSkill: (i: number) => string, nearRest: () => boolean): BattleCommand[] {
    const out = this.pending;
    this.pending = [];
    let dx = this.stick?.dx ?? 0;
    let dy = this.stick?.dy ?? 0;
    const K = this.keys;
    if (K) {
      const kx = (K.right?.isDown ? 1 : 0) - (K.left?.isDown ? 1 : 0);
      const ky = (K.down?.isDown ? 1 : 0) - (K.up?.isDown ? 1 : 0);
      if (kx || ky) {
        dx = kx * 1000;
        dy = ky * 1000;
      }
      const one = [K.slot1, K.slot2, K.slot3, K.slot4];
      one.forEach((key, i) => {
        if (key && Phaser.Input.Keyboard.JustDown(key)) out.push({ type: 'skill', id: slotSkill(i) });
      });
      if (K.dodge && Phaser.Input.Keyboard.JustDown(K.dodge)) out.push({ type: 'dodge', dx, dy });
      if (K.ult && Phaser.Input.Keyboard.JustDown(K.ult)) out.push({ type: 'skill', id: 'blade_storm' });
      if (K.potion && Phaser.Input.Keyboard.JustDown(K.potion)) out.push({ type: 'potion' });
    }
    if (dx || dy) this.restOnArrive = false;
    if (this.restOnArrive && nearRest()) {
      out.push({ type: 'rest' });
      this.restOnArrive = false;
    }
    out.unshift(dx || dy ? { type: 'move', dx, dy } : { type: 'stop' });
    return out;
  }
}
