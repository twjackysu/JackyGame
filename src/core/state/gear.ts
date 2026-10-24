// 裝備實例（design/14 階段 1.2）。純邏輯、可序列化。
// - `ITEM_DEFS` 是**模板**；玩家擁有的每一件裝備都是一個 `EquipmentInstance`，存在 `GameState.gear`（以 instanceId 為鍵）。
// - 消耗品、禮物、重要物品維持 `inventory`（模板 id → 數量）。
// - `members[x].equipment[slot]` 存的是 instanceId。
// 之後的強化、詞綴、祝福值都掛在實例上；目前每件實例都還是 +0、無詞綴，所以 UI 仍以模板分組顯示。
import { ITEM_DEFS } from '../../data/equipment';
import { drawU32 } from '../rngStreams';
import type { GameState } from './gameState';

export type GearOrigin = 'story' | 'shop' | 'drop' | 'migrated' | 'ngplus';

export interface EquipmentInstance {
  /** ULID（26 字元 Crockford Base32；時間取自存檔遊戲時間，亂數取自 'ids' stream） */
  instanceId: string;
  templateId: string;
  enhancement: number;
  affixes: { id: string; value: number }[];
  /** 舊欄位（第 11 輪前段的存檔有），未使用；祝福值看 blessings */
  blessing: number;
  /** 強化失敗累積的星之祝福：目標階段 → 值（綁實例與目標階段，降級不清；src/server/enhancement.ts） */
  blessings?: Partial<Record<number, number>>;
  binding: 'none' | 'bound';
  /** 來源模式：主線（story）／深淵（未來）等；目前只記取得方式 */
  originMode: GearOrigin;
}

export const isGearTemplate = (id: string): boolean => ITEM_DEFS[id]?.kind === 'gear';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID：48 位元時間＋80 位元亂數。亂數由存檔的 'ids' stream 提供，所以同存檔同操作序列結果相同。 */
export function makeUlid(timeMs: number, rand: () => number): string {
  let t = Math.max(0, Math.floor(timeMs));
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32]! + time;
    t = Math.floor(t / 32);
  }
  let r = '';
  // 80 位元 = 16 個 5 位元字元；每個 32 位元亂數取 6 個字元（30 位元）
  let word = 0;
  for (let i = 0; i < 16; i++) {
    if (i % 6 === 0) word = rand();
    r += B32[word & 31]!;
    word >>>= 5;
  }
  return time + r;
}

function newInstanceId(s: GameState): string {
  const t = (s.createdAt || 0) + (s.playTimeMs || 0);
  for (;;) {
    const id = makeUlid(t, () => drawU32(s.rng, 'ids'));
    if (!s.gear[id]) return id;
  }
}

/** 建立一件新實例並放進 `s.gear`（未裝備＝在背包） */
export function createInstance(s: GameState, templateId: string, origin: GearOrigin): EquipmentInstance {
  const inst: EquipmentInstance = { instanceId: newInstanceId(s), templateId, enhancement: 0, affixes: [], blessing: 0, binding: 'none', originMode: origin };
  s.gear[inst.instanceId] = inst;
  return inst;
}

/** 身上穿著的 instanceId 集合 */
export function wornIds(s: GameState): Set<string> {
  const out = new Set<string>();
  for (const m of Object.values(s.members)) for (const id of Object.values(m?.equipment ?? {})) if (id) out.add(id);
  return out;
}

/** 背包裡（沒穿在身上）的某模板實例，依 instanceId 排序 */
export function freeInstances(s: GameState, templateId: string): EquipmentInstance[] {
  const worn = wornIds(s);
  return Object.values(s.gear).filter((g) => g.templateId === templateId && !worn.has(g.instanceId)).sort((a, b) => (a.instanceId < b.instanceId ? -1 : 1));
}

/** 背包中某模板的數量（裝備＝沒穿著的實例數；其他＝inventory 數量） */
export function bagCount(s: GameState, templateId: string): number {
  return isGearTemplate(templateId) ? freeInstances(s, templateId).length : s.inventory[templateId] ?? 0;
}

/** 背包裡有的模板 id（裝備＋道具），保持 inventory 原順序後接裝備 */
export function bagIds(s: GameState): string[] {
  const items = Object.keys(s.inventory).filter((id) => (s.inventory[id] ?? 0) > 0);
  const worn = wornIds(s);
  const gear: string[] = [];
  for (const g of Object.values(s.gear)) if (!worn.has(g.instanceId) && !gear.includes(g.templateId)) gear.push(g.templateId);
  return [...items, ...gear];
}

/** 加入／移除物品（模板 id）。裝備會建立或移除背包裡的實例；移除不會動到身上穿的。 */
export function addItem(s: GameState, templateId: string, n: number, origin: GearOrigin = 'story'): void {
  if (n === 0) return;
  if (isGearTemplate(templateId)) {
    if (n > 0) for (let i = 0; i < n; i++) createInstance(s, templateId, origin);
    else for (const g of freeInstances(s, templateId).slice(0, -n)) delete s.gear[g.instanceId];
    return;
  }
  const v = (s.inventory[templateId] ?? 0) + n;
  if (v <= 0) delete s.inventory[templateId];
  else s.inventory[templateId] = v;
}

/** 實例對應的模板 id（找不到回 undefined） */
export function templateOf(s: GameState, instanceId: string | undefined): string | undefined {
  return instanceId ? s.gear[instanceId]?.templateId : undefined;
}

/** 擁有（背包或身上）任一件此模板 */
export function hasTemplate(s: GameState, templateId: string): boolean {
  if ((s.inventory[templateId] ?? 0) > 0) return true;
  return Object.values(s.gear).some((g) => g.templateId === templateId);
}

/**
 * 存檔 v1 → v2：inventory 裡的裝備與身上的模板 id 換成實例。
 * 直接改傳入的 raw 物件（deserialize 呼叫；失敗會丟例外，由呼叫端保留原存檔）。
 */
export function migrateGearV1(raw: GameState): void {
  if (!raw.gear || typeof raw.gear !== 'object') raw.gear = {};
  const inv = raw.inventory ?? {};
  for (const [id, n] of Object.entries(inv)) {
    if (!isGearTemplate(id)) continue;
    delete inv[id];
    for (let i = 0; i < (n ?? 0); i++) createInstance(raw, id, 'migrated');
  }
  for (const m of Object.values(raw.members ?? {})) {
    if (!m?.equipment) continue;
    for (const [slot, id] of Object.entries(m.equipment)) {
      if (!id) continue;
      if (raw.gear[id]) continue; // 已經是實例
      if (!isGearTemplate(id)) {
        delete (m.equipment as Record<string, string>)[slot];
        continue;
      }
      (m.equipment as Record<string, string>)[slot] = createInstance(raw, id, 'migrated').instanceId;
    }
  }
}
