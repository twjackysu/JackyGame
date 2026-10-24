// GameApi 的本機實作：同一個程式裡直接改 GameState，並寫事件紀錄（design/14 階段 1.5）。
// 只依賴注入的埠（狀態存取、EventJournal、Clock）與 core／data 的純邏輯，可整包搬去伺服器。
import type { Clock, EventJournal } from './ports';
import type { ApiResult, BattleRewards, ConsumableId, GameApi } from './gameApi';
import type { GameState, MemberId } from '../core/state/gameState';
import { applyEffects } from '../core/state/gameState';
import { buy, buyPrice, equip, grantDrops, sell, sellPrice, unequip } from '../core/state/equip';
import { resetCost, resetTree } from '../core/state/skillTree';
import { bagCount } from '../core/state/gear';
import { drawSeed } from '../core/rngStreams';
import { chestFlag } from '../core/explore/area';
import { AREAS } from '../data/areas';
import { firstKillFlag, rollDrops } from '../data/drops';
import { BOSS_POINT_KILLS } from '../data/skillTree';
import { ITEM_DEFS, type Slot } from '../data/equipment';
import { RULES_VERSION } from '../data/rules';

const CONSUMABLES: readonly ConsumableId[] = ['potion_s', 'potion_m', 'lamp_oil', 'blast_bottle'];

export class LocalGameApi implements GameApi {
  constructor(
    private state: () => GameState,
    private journal: EventJournal,
    private clock: Clock,
  ) {}

  /** 共用流程：去重 → 執行 → 成功才記事件 */
  private run<T>(operationId: string, type: string, details: Record<string, unknown>, fn: (s: GameState) => Omit<ApiResult<T>, 'operationId' | 'rulesVersion'>): ApiResult<T> {
    if (!operationId) return { ok: false, error: 'invalid', operationId, rulesVersion: RULES_VERSION };
    if (this.journal.has(operationId)) return { ok: true, duplicate: true, operationId, rulesVersion: RULES_VERSION };
    const s = this.state();
    const goldBefore = s.gold;
    const r = fn(s);
    if (r.ok) {
      this.journal.append({
        eventId: `${operationId}:${type}`,
        operationId,
        type,
        timestamp: this.clock.now(),
        rulesVersion: RULES_VERSION,
        details: { ...details, goldDelta: s.gold - goldBefore, ...(r.data !== undefined ? { result: r.data as unknown } : {}) },
      });
    }
    return { ...r, operationId, rulesVersion: RULES_VERSION };
  }

  buy(operationId: string, req: { itemId: string; discountPct?: number }): ApiResult {
    return this.run(operationId, 'buy', { ...req, price: ITEM_DEFS[req.itemId] ? buyPrice(req.itemId, req.discountPct ?? 0) : 0 }, (s) => {
      const def = ITEM_DEFS[req.itemId];
      if (!def || def.price <= 0 || (def.rarity ?? 'common') !== 'common') return { ok: false, error: 'not_for_sale' };
      return buy(s, req.itemId, req.discountPct ?? 0) ? { ok: true } : { ok: false, error: 'not_enough_gold' };
    });
  }

  sell(operationId: string, req: { itemId: string }): ApiResult {
    return this.run(operationId, 'sell', { ...req, price: ITEM_DEFS[req.itemId] ? sellPrice(req.itemId) : 0 }, (s) => {
      if (!ITEM_DEFS[req.itemId] || sellPrice(req.itemId) <= 0) return { ok: false, error: 'not_for_sale' };
      if (bagCount(s, req.itemId) <= 0) return { ok: false, error: 'not_owned' };
      return sell(s, req.itemId) ? { ok: true } : { ok: false, error: 'invalid' };
    });
  }

  equip(operationId: string, req: { member: MemberId; ref: string }): ApiResult {
    return this.run(operationId, 'equip', req, (s) => (equip(s, req.member, req.ref) ? { ok: true } : { ok: false, error: 'cannot_equip' }));
  }

  unequip(operationId: string, req: { member: MemberId; slot: Slot }): ApiResult {
    return this.run(operationId, 'unequip', req, (s) => (unequip(s, req.member, req.slot) ? { ok: true } : { ok: false, error: 'not_owned' }));
  }

  resetTree(operationId: string, req: { member: MemberId; atCamp: boolean }): ApiResult {
    return this.run(operationId, 'resetTree', req, (s) => {
      if (s.gold < resetCost(s, req.member, req.atCamp)) return { ok: false, error: 'not_enough_gold' };
      return resetTree(s, req.member, req.atCamp) ? { ok: true } : { ok: false, error: 'invalid' };
    });
  }

  openChest(operationId: string, req: { areaId: string; entityId: string }): ApiResult<{ text: string }> {
    return this.run(operationId, 'openChest', req, (s) => {
      const e = AREAS[req.areaId]?.entities.find((x) => x.id === req.entityId);
      if (!e || e.kind !== 'chest') return { ok: false, error: 'not_found' };
      const flag = chestFlag(req.areaId, e.id);
      if (s.flags[flag]) return { ok: false, error: 'already_claimed' };
      applyEffects(s, [...(e.loot ?? []), { flag }]);
      return { ok: true, data: { text: e.lootText ?? '找到了東西。' } };
    });
  }

  claimEnemyGold(operationId: string, req: { areaId: string; entityId: string }): ApiResult<{ gold: number }> {
    return this.run(operationId, 'enemyGold', req, (s) => {
      const e = AREAS[req.areaId]?.entities.find((x) => x.id === req.entityId);
      if (!e || e.kind !== 'enemy') return { ok: false, error: 'not_found' };
      const gold = Math.max(0, e.gold ?? 0);
      s.gold += gold;
      return { ok: true, data: { gold } };
    });
  }

  claimBattleRewards(operationId: string, req: { defeated: string[]; consumablesLeft: Partial<Record<ConsumableId, number>> }): ApiResult<BattleRewards> {
    return this.run(operationId, 'battleRewards', { defeated: req.defeated }, (s) => {
      // 消耗品只能變少（戰鬥中用掉），不能憑空變多
      for (const it of CONSUMABLES) {
        const left = req.consumablesLeft[it];
        if (left === undefined) continue;
        const v = Math.max(0, Math.min(left, s.inventory[it] ?? 0));
        if (v === 0) delete s.inventory[it];
        else s.inventory[it] = v;
      }
      const f = s.flags;
      const drops = rollDrops(req.defeated, drawSeed(s.rng, 'loot'), (id) => !!f[firstKillFlag(id)]);
      const newBossPoint = req.defeated.some((id) => (BOSS_POINT_KILLS as readonly string[]).includes(id) && !f[firstKillFlag(id)]);
      grantDrops(s, drops, req.defeated);
      return { ok: true, data: { drops, newBossPoint } };
    });
  }
}
