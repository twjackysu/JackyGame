// 對話腳本執行器（純邏輯）。腳本格式見 docs/design/06-tech-architecture.md §3.3。
// 場景（DialogueScene）只負責呈現：呼叫 next() / choose()，依回傳的 DialogueStep 播放。
import {
  applyEffects,
  check,
  checkChance,
  type Condition,
  type Effect,
  type GameState,
  type StatKey,
} from '../state/gameState';

export type Speaker = string; // 'lian' | 'lian_inner'（內心吐槽）| 'serin' | 'narration' | NPC id

export interface SayLine {
  say: Speaker;
  text: string; // i18n key 或直接文字
  if?: Condition;
  effects?: Effect[];
}

export type ChoiceCheck =
  | { stat: StatKey; dc: number }
  | { codex: string }; // 擁有攻略筆記條目 → 必定成功（通常搭配偏移值效果）

export interface ChoiceOption {
  text: string;
  next: string; // 成功（或無檢定）時前往的節點
  fail?: string; // 檢定失敗時前往的節點；省略則同 next
  check?: ChoiceCheck;
  effects?: Effect[]; // 選擇後（成功時）套用
  failEffects?: Effect[];
  if?: Condition; // 不符合則不顯示
}

export interface ChoiceLine {
  choice: ChoiceOption[];
}

/** 觸發外部事件（戰鬥、燼牌、商店…），由場景處理後以 resume(outcome) 回到腳本。 */
export interface EventLine {
  event: 'battle' | 'cards' | 'shop' | 'rename' | 'chapterCard' | 'summary' | 'codexBurn';
  id: string;
  outcomes?: Record<string, string>; // outcome → 節點（如 { win: 'won', lose: 'lost' }）
  if?: Condition;
}

export interface JumpLine {
  goto: string;
  if?: Condition;
}

export interface EffectLine {
  effects: Effect[];
  if?: Condition;
}

export type ScriptLine = SayLine | ChoiceLine | EventLine | JumpLine | EffectLine;

export interface DialogueScript {
  id: string;
  start?: string; // 預設 'start'
  nodes: Record<string, ScriptLine[]>;
}

export type ShownOption = {
  index: number;
  text: string;
  check?: ChoiceCheck;
  /** 顯示用成功率（0~1）；筆記選項為 1 */
  chance?: number;
};

export type DialogueStep =
  | { kind: 'say'; speaker: Speaker; text: string }
  | { kind: 'choice'; options: ShownOption[] }
  | { kind: 'event'; event: EventLine['event']; id: string }
  | { kind: 'roll'; success: boolean; chance: number; option: number } // 擲骰結果（場景播放動畫）
  | { kind: 'end' };

export class DialogueRunner {
  private node: string;
  private pc = 0;
  private pendingChoice: ChoiceOption[] | null = null;
  private pendingEvent: EventLine | null = null;
  private pendingJump: string | null = null;

  constructor(
    private script: DialogueScript,
    private state: GameState,
    private rng: () => number = Math.random,
  ) {
    this.node = script.start ?? 'start';
    if (!script.nodes[this.node]) throw new Error(`dialogue ${script.id}: missing node ${this.node}`);
  }

  get currentNode(): string {
    return this.node;
  }

  private goto(node: string): void {
    if (!this.script.nodes[node]) throw new Error(`dialogue ${this.script.id}: missing node ${node}`);
    this.node = node;
    this.pc = 0;
  }

  /** 前進到下一個需要呈現的步驟。 */
  next(): DialogueStep {
    if (this.pendingChoice) throw new Error('awaiting choice');
    if (this.pendingEvent) throw new Error('awaiting event outcome');
    if (this.pendingJump) {
      this.goto(this.pendingJump);
      this.pendingJump = null;
    }
    for (let guard = 0; guard < 10000; guard++) {
      const lines = this.script.nodes[this.node]!;
      if (this.pc >= lines.length) return { kind: 'end' };
      const line = lines[this.pc++]!;
      if ('if' in line && line.if && !check(this.state, line.if)) continue;
      if ('say' in line) {
        applyEffects(this.state, line.effects);
        return { kind: 'say', speaker: line.say, text: line.text };
      }
      if ('choice' in line) {
        const visible = line.choice.filter((o) => !o.if || check(this.state, o.if));
        this.pendingChoice = visible;
        return {
          kind: 'choice',
          options: visible.map((o, index) => ({
            index,
            text: o.text,
            check: o.check,
            chance: o.check ? this.chanceOf(o.check) : undefined,
          })),
        };
      }
      if ('event' in line) {
        this.pendingEvent = line;
        return { kind: 'event', event: line.event, id: line.id };
      }
      if ('goto' in line) {
        this.goto(line.goto);
        continue;
      }
      applyEffects(this.state, line.effects);
    }
    throw new Error(`dialogue ${this.script.id}: infinite loop`);
  }

  chanceOf(c: ChoiceCheck): number {
    if ('codex' in c) return this.state.codex.includes(c.codex) ? 1 : 0;
    return checkChance(this.state.stats[c.stat], c.dc);
  }

  /** 選擇選項。有檢定時回傳 roll 步驟（之後呼叫 next() 繼續）。 */
  choose(index: number): DialogueStep | null {
    const opts = this.pendingChoice;
    if (!opts) throw new Error('no pending choice');
    const o = opts[index];
    if (!o) throw new Error(`invalid choice ${index}`);
    this.pendingChoice = null;
    if (!o.check) {
      applyEffects(this.state, o.effects);
      this.pendingJump = o.next;
      return null;
    }
    const chance = this.chanceOf(o.check);
    const success = chance >= 1 || this.rng() < chance;
    if (success) applyEffects(this.state, o.effects);
    else applyEffects(this.state, o.failEffects);
    this.pendingJump = success ? o.next : (o.fail ?? o.next);
    return { kind: 'roll', success, chance, option: index };
  }

  /** 外部事件結束後回到腳本。 */
  resume(outcome: string): void {
    const ev = this.pendingEvent;
    if (!ev) throw new Error('no pending event');
    this.pendingEvent = null;
    const target = ev.outcomes?.[outcome];
    if (target) this.pendingJump = target;
  }
}
