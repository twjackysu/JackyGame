// GameApi 的本機實作：同一個程式裡直接改 GameState，並寫事件紀錄（design/14 階段 1.5）。
// 只依賴注入的埠（狀態存取、EventJournal、Clock）與 core／data 的純邏輯，可整包搬去伺服器。
import type { Clock, EventJournal } from './ports';
import type { ApiResult, BattleRewards, ConsumableId, EnhanceResult, GameApi } from './gameApi';
import { nextStep, rollEnhance } from './enhancement';
import { rollStoryAffixes, rollStoryMaterials } from './loot';
import { canSalvage, rerollCheck, rollReroll, salvageYield, settleReroll, slotTypeOf, tierOf } from './crafting';
import { wornIds } from '../core/state/gear';
import { randomFromRng } from './ports';
import type { GameState, MemberId } from '../core/state/gameState';
import { applyEffects } from '../core/state/gameState';
import { buy, buyPrice, equip, grantDrops, sell, sellPrice, unequip } from '../core/state/equip';
import { resetCost, resetTree } from '../core/state/skillTree';
import { bagCount } from '../core/state/gear';
import { drawSeed, streamRng } from '../core/rngStreams';
import { chestFlag } from '../core/explore/area';
import { AREAS } from '../data/areas';
import { firstKillFlag, rollDrops } from '../data/drops';
import { BOSS_POINT_KILLS } from '../data/skillTree';
import { ITEM_DEFS } from '../data/equipment';
import type { EquipSlot } from '../data/rules';
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

  enhance(operationId: string, req: { instanceId: string }): ApiResult<EnhanceResult> {
    return this.run(operationId, 'enhance', req, (s) => {
      const inst = s.gear[req.instanceId];
      if (!inst) return { ok: false, error: 'not_owned' };
      const step = nextStep(inst.enhancement);
      if (!step) return { ok: false, error: 'max_level' };
      const { gold, ...mats } = step.cost;
      for (const [m, n] of Object.entries(mats)) if ((s.inventory[m] ?? 0) < (n ?? 0)) return { ok: false, error: 'not_enough_materials' };
      if (s.gold < gold) return { ok: false, error: 'not_enough_gold' };
      s.gold -= gold;
      for (const [m, n] of Object.entries(mats)) {
        const left = (s.inventory[m] ?? 0) - (n ?? 0);
        if (left <= 0) delete s.inventory[m];
        else s.inventory[m] = left;
      }
      const r = rollEnhance(inst, randomFromRng(streamRng(s.rng, 'enhance')))!;
      const { rulesVersion: _rv, ...data } = r;
      void _rv;
      return { ok: true, data };
    });
  }

  reroll(operationId: string, req: { instanceId: string; locks: number[] }) {
    return this.run(operationId, 'reroll', req, (s) => {
      const inst = s.gear[req.instanceId];
      if (!inst) return { ok: false, error: 'not_owned' as const };
      const c = rerollCheck(inst, req.locks);
      if ('error' in c) return { ok: false, error: c.error };
      const { gold, ...mats } = c.cost;
      if (!this.pay(s, gold, mats)) return { ok: false, error: s.gold < gold ? ('not_enough_gold' as const) : ('not_enough_materials' as const) };
      const previous = inst.affixes.map((a) => ({ ...a }));
      const candidate = rollReroll(inst, req.locks, randomFromRng(streamRng(s.rng, 'enhance')));
      return { ok: true, data: { candidate, previous } };
    });
  }

  settleReroll(operationId: string, req: { instanceId: string; accept: boolean }): ApiResult {
    return this.run(operationId, 'settleReroll', req, (s) => {
      const inst = s.gear[req.instanceId];
      if (!inst) return { ok: false, error: 'not_owned' };
      return settleReroll(inst, req.accept) ? { ok: true } : { ok: false, error: 'invalid' };
    });
  }

  salvage(operationId: string, req: { instanceIds: string[]; quick?: boolean }) {
    return this.run(operationId, 'salvage', req, (s) => {
      const worn = wornIds(s);
      const materials: Record<string, number> = {};
      let salvaged = 0;
      for (const id of new Set(req.instanceIds)) {
        const inst = s.gear[id];
        if (!inst || !canSalvage(inst, worn, !!req.quick)) continue;
        for (const [m, n] of Object.entries(salvageYield(inst))) materials[m] = (materials[m] ?? 0) + (n ?? 0);
        delete s.gear[id];
        salvaged++;
      }
      if (salvaged === 0) return { ok: false, error: 'invalid' as const };
      for (const [m, n] of Object.entries(materials)) s.inventory[m] = (s.inventory[m] ?? 0) + n;
      return { ok: true, data: { salvaged, materials } };
    });
  }

  setLock(operationId: string, req: { instanceId: string; locked: boolean }): ApiResult {
    return this.run(operationId, 'setLock', req, (s) => {
      const inst = s.gear[req.instanceId];
      if (!inst) return { ok: false, error: 'not_owned' };
      if (req.locked) inst.locked = true;
      else delete inst.locked;
      return { ok: true };
    });
  }

  /** 新拿到的裝備實例：定下稀有度並擲詞綴（只有掉落／寶箱這種「刷到的」才有詞綴；商店貨是固定的普通品） */
  private rollNewGear(s: GameState, before: ReadonlySet<string>): void {
    const rng = randomFromRng(streamRng(s.rng, 'loot'));
    for (const id of Object.keys(s.gear).sort()) {
      if (before.has(id)) continue;
      const inst = s.gear[id]!;
      const tier = tierOf(inst);
      const slot = slotTypeOf(inst);
      inst.tier = tier;
      if (slot && inst.affixes.length === 0) inst.affixes = rollStoryAffixes(slot, tier, rng);
    }
  }

  /** 扣金幣與材料（全部夠才扣） */
  private pay(s: GameState, gold: number, mats: Record<string, number | undefined>): boolean {
    if (s.gold < gold) return false;
    for (const [m, n] of Object.entries(mats)) if ((s.inventory[m] ?? 0) < (n ?? 0)) return false;
    s.gold -= gold;
    for (const [m, n] of Object.entries(mats)) {
      const left = (s.inventory[m] ?? 0) - (n ?? 0);
      if (left <= 0) delete s.inventory[m];
      else s.inventory[m] = left;
    }
    return true;
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

  equip(operationId: string, req: { member: MemberId; ref: string; slot?: EquipSlot }): ApiResult {
    return this.run(operationId, 'equip', req, (s) => (equip(s, req.member, req.ref, req.slot) ? { ok: true } : { ok: false, error: 'cannot_equip' }));
  }

  unequip(operationId: string, req: { member: MemberId; slot: EquipSlot }): ApiResult {
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
      const before = new Set(Object.keys(s.gear));
      applyEffects(s, [...(e.loot ?? []), { flag }]);
      this.rollNewGear(s, before);
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
      const before = new Set(Object.keys(s.gear));
      grantDrops(s, drops, req.defeated);
      this.rollNewGear(s, before);
      const fresh = Object.values(s.gear).filter((g) => !before.has(g.instanceId));
      const dropAffixes = drops.map((tid) => {
        const k = fresh.findIndex((g) => g.templateId === tid);
        return k < 0 ? [] : fresh.splice(k, 1)[0]!.affixes.map((a) => ({ ...a }));
      });
      // 材料：擲骰在稀有掉落之後，不影響既有掉落序列
      const materials = rollStoryMaterials(req.defeated, randomFromRng(streamRng(s.rng, 'loot')));
      for (const [m, n] of Object.entries(materials)) s.inventory[m] = (s.inventory[m] ?? 0) + n;
      return { ok: true, data: { drops, newBossPoint, materials, dropAffixes } };
    });
  }
}
