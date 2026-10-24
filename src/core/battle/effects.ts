// 效果觸發框架（design/14 階段 2.1；與 design/15 §0.1–0.2 相容）。純邏輯、可序列化、與引擎解耦：
// 引擎（或模擬器）在發生事件時呼叫 `EffectBus.emit(ctx)`，框架找出符合的效果、檢查條件／上限／冷卻，
// 依優先順序交給 `EffectHost.apply` 執行；執行時產生的「衍生事件」排在後面處理（BFS）。
//
// 防無限循環（最重要）：
// 1. 衍生事件（ctx.origin !== 'natural'）預設**不會**再觸發任何效果；效果要明確 `allowDerived: true` 才行。
// 2. 即使 allowDerived，**效果永遠不會被自己產生的事件觸發**（同一件裝備的共鳴不會再觸發同一件裝備的共鳴）。
// 3. 每個效果都必須有觸發上限（action／round／battle），可再加冷卻回合。
// 4. 硬性安全閥：單一事件鏈最多 `MAX_CHAIN_DEPTH` 層、單次 emit 最多 `MAX_TRIGGERS_PER_EMIT` 次觸發，超過就停並記警告。

export const TRIGGER_EVENTS = [
  'OnAttack', 'OnCritical', 'OnBlock', 'OnPerfectBlock', 'OnDodge', 'OnMarkCreated',
  'OnResonance', 'OnEnemyKilled', 'OnBreak', 'OnTurnStart', 'OnDamaged', 'OnAllyDown',
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/** 事件／效果的來源：natural ＝玩家原始操作或敵人正常行動 */
export type EffectOrigin = 'natural' | 'equipment' | 'setBonus' | 'skillTree';

export interface TriggerContext {
  event: TriggerEvent;
  origin: EffectOrigin;
  /** 產生此事件的效果 key（natural 事件沒有） */
  originKey?: string;
  /** 觸發者（我方角色索引；敵方行動時為受影響的我方） */
  hero?: number;
  /** 目標敵人索引 */
  target?: number;
  skill?: string;
  skillTags?: readonly string[];
  isPerfect?: boolean;
  targetMarks?: number;
  /** OnResonance 用：引爆前的燈數 */
  marksBefore?: number;
  targetBroken?: boolean;
  heroHpPct?: number;
  targetHpPct?: number;
  enemyCount?: number;
  damage?: number;
  /** 同一個玩家／敵人行動的編號（action 上限用） */
  actionId: number;
  round: number;
}

/** 條件：只允許白名單欄位＋運算子（不執行任意程式） */
export type CondField = 'hero' | 'target' | 'skill' | 'skillTag' | 'isPerfect' | 'targetMarks' | 'marksBefore' | 'targetBroken' | 'heroHpPct' | 'targetHpPct' | 'enemyCount';
export type Condition =
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { field: CondField; op: 'eq' | 'gte' | 'lte'; value: number | string | boolean };

/** 內建操作（有限；引擎保證一致性，資料只決定何時、對誰、參數） */
export type EffectOp =
  | { op: 'createMark'; count: number; to: 'target' | 'allEnemies' }
  | { op: 'consumeMarks'; to: 'target' }
  | { op: 'modifyDamage'; pct: number }
  | { op: 'modifyResource'; resource: 'sp' | 'ember'; delta: number }
  | { op: 'heal'; pct: number; to: 'self' | 'team' }
  | { op: 'applyStatus'; status: string; rounds: number; to: 'target' | 'self' }
  | { op: 'extraResonance'; scale: number };

export interface TriggerLimit {
  count: number;
  scope: 'action' | 'round' | 'battle';
  /** 計數對象：效果持有者（source）、每個目標各自（target）、全隊共用（team） */
  owner: 'source' | 'target' | 'team';
}

export interface EffectDef {
  id: string;
  trigger: TriggerEvent;
  when?: Condition;
  ops: readonly EffectOp[];
  limit: TriggerLimit;
  cooldownRounds?: number;
  /** 小的先結算；同優先依加入順序 */
  priority?: number;
  /** 可以被其他效果產生的衍生事件觸發（預設 false） */
  allowDerived?: boolean;
}

/** 戰鬥中掛在某位角色身上的一個效果 */
export interface EffectInstance {
  /** 唯一 key，例如 `${裝備 instanceId}:${效果 id}`；自我觸發判定與上限計數都用它 */
  key: string;
  def: EffectDef;
  ownerHero: number;
  origin: Exclude<EffectOrigin, 'natural'>;
}

export interface EffectHost {
  /** 執行一個操作；回傳因此產生的衍生事件（框架會把 origin／originKey 補上） */
  apply(op: EffectOp, eff: EffectInstance, ctx: TriggerContext): Omit<TriggerContext, 'origin' | 'originKey'>[];
}

export const MAX_CHAIN_DEPTH = 8;
export const MAX_TRIGGERS_PER_EMIT = 64;

export function checkCondition(c: Condition | undefined, ctx: TriggerContext): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => checkCondition(x, ctx));
  if ('any' in c) return c.any.some((x) => checkCondition(x, ctx));
  if (c.field === 'skillTag') return c.op === 'eq' && !!ctx.skillTags?.includes(String(c.value));
  const v = ctx[c.field];
  if (v === undefined) return false;
  if (c.op === 'eq') return v === c.value;
  if (typeof v !== 'number' || typeof c.value !== 'number') return false;
  return c.op === 'gte' ? v >= c.value : v <= c.value;
}

/** 可序列化的計數狀態（存進戰鬥狀態即可重現） */
export interface EffectBusState {
  counts: Record<string, number>;
  lastRound: Record<string, number>;
  warnings: string[];
  /** 累計觸發次數（統計／測試用） */
  fired: Record<string, number>;
}

export function newEffectBusState(): EffectBusState {
  return { counts: {}, lastRound: {}, warnings: [], fired: {} };
}

export class EffectBus {
  constructor(
    private effects: readonly EffectInstance[],
    private host: EffectHost,
    public state: EffectBusState = newEffectBusState(),
  ) {}

  private limitKey(eff: EffectInstance, ctx: TriggerContext): string {
    const l = eff.def.limit;
    const bucket = l.scope === 'action' ? `a${ctx.actionId}` : l.scope === 'round' ? `r${ctx.round}` : 'b';
    const owner = l.owner === 'source' ? `h${eff.ownerHero}` : l.owner === 'target' ? `t${ctx.target ?? -1}` : 'team';
    return `${eff.key}|${bucket}|${owner}`;
  }

  /** 這個效果會不會被此事件觸發（不改狀態） */
  canTrigger(eff: EffectInstance, ctx: TriggerContext): boolean {
    if (eff.def.trigger !== ctx.event) return false;
    if (ctx.origin !== 'natural') {
      if (!eff.def.allowDerived) return false;
      if (ctx.originKey === eff.key) return false; // 永不自我觸發
    }
    if ((this.state.counts[this.limitKey(eff, ctx)] ?? 0) >= eff.def.limit.count) return false;
    const cd = eff.def.cooldownRounds ?? 0;
    const last = this.state.lastRound[eff.key];
    if (cd > 0 && last !== undefined && ctx.round - last < cd) return false;
    return checkCondition(eff.def.when, ctx);
  }

  /** 送出一個事件；回傳本次一共觸發了幾次效果 */
  emit(first: TriggerContext): number {
    const queue: { ctx: TriggerContext; depth: number }[] = [{ ctx: first, depth: 0 }];
    let fired = 0;
    while (queue.length) {
      const { ctx, depth } = queue.shift()!;
      if (depth > MAX_CHAIN_DEPTH) {
        this.state.warnings.push(`chain depth > ${MAX_CHAIN_DEPTH} at ${ctx.event}`);
        continue;
      }
      const matches = this.effects
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => this.canTrigger(e, ctx))
        .sort((a, b) => (a.e.def.priority ?? 0) - (b.e.def.priority ?? 0) || a.i - b.i);
      for (const { e } of matches) {
        if (!this.canTrigger(e, ctx)) continue; // 同一事件中前面的效果可能已用掉共用上限
        if (fired >= MAX_TRIGGERS_PER_EMIT) {
          this.state.warnings.push(`> ${MAX_TRIGGERS_PER_EMIT} triggers in one emit`);
          return fired;
        }
        const k = this.limitKey(e, ctx);
        this.state.counts[k] = (this.state.counts[k] ?? 0) + 1;
        this.state.lastRound[e.key] = ctx.round;
        this.state.fired[e.key] = (this.state.fired[e.key] ?? 0) + 1;
        fired++;
        for (const op of e.def.ops) {
          for (const d of this.host.apply(op, e, ctx)) queue.push({ ctx: { ...d, origin: e.origin, originKey: e.key }, depth: depth + 1 });
        }
      }
    }
    return fired;
  }
}
