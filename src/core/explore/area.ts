// 可走區域的資料格式與實體狀態判斷（純邏輯）。資料在 src/data/areas/*.ts。
import { check, type Condition, type Effect, type GameState } from '../state/gameState';
import type { Pt, Rect } from './grid';

export interface Building extends Rect {
  /** 屋頂顏色（CSS） */
  roof: string;
  wall: string;
  /** 招牌文字（畫在門上方） */
  sign?: string;
  /** 窗戶亮燈 */
  lit?: boolean;
}

export type EntityKind = 'npc' | 'door' | 'sign' | 'chest' | 'gate';

export interface AreaEntity {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  /** 顯示名稱（頭上名牌／互動提示） */
  name?: string;
  /** 外觀：npc 的衣服顏色（CSS），或 hero id（'serin' 等）用手繪 Q 版圖 */
  look?: { body: string; hair: string; hero?: string };
  /** 互動 → 跑劇本節點 */
  talk?: { script: string; node: string };
  /** talk 的開放條件（不符合時只說 lines） */
  requires?: Condition;
  /** 主線完成旗標：開放且未完成 → 頭上「！」 */
  done?: string;
  /** 支線：開放且未完成 → 頭上「？」（藍） */
  side?: boolean;
  /** 商店：頭上「$」 */
  shop?: boolean;
  /** 閒聊台詞（沒有 talk、或 talk 未開放時隨機說一句） */
  lines?: string[];
  /** 寶箱內容（開過記在 flags[`chest_<area>_<id>`]） */
  loot?: Effect[];
  /** 寶箱獎勵說明文字 */
  lootText?: string;
  /** 劇本結束後要去哪：預設回到探索；'map' = 回世界地圖 */
  after?: 'map';
  /** 只在條件成立時出現 */
  when?: Condition;
  /** NPC 小範圍閒晃（格數） */
  wander?: number;
}

export interface AreaDef {
  id: string;
  /** 對應的章節（世界地圖 region） */
  region: string;
  name: string;
  rows: readonly string[];
  buildings: readonly Building[];
  entities: readonly AreaEntity[];
  spawns: Record<string, Pt>;
  /** 夜晚：畫面加暗＋提燈光圈 */
  night?: boolean;
}

export type Marker = 'main' | 'side' | 'shop' | 'chat' | 'none';

export function chestFlag(area: string, id: string): string {
  return `chest_${area}_${id}`;
}

/** 實體目前是否存在於地圖上 */
export function present(s: GameState, e: AreaEntity): boolean {
  return !e.when || check(s, e.when);
}

/** talk 是否可以觸發 */
export function talkOpen(s: GameState, e: AreaEntity): boolean {
  return !!e.talk && (!e.requires || check(s, e.requires));
}

/** 頭上標記：主線「！」＞支線「？」＞商店「$」＞閒聊「…」 */
export function markerOf(s: GameState, area: string, e: AreaEntity): Marker {
  if (e.kind === 'chest') return 'none';
  const open = talkOpen(s, e);
  if (open && e.done && !s.flags[e.done]) return e.side ? 'side' : 'main';
  if (open && e.shop) return 'shop';
  if (open || (e.lines && e.lines.length > 0)) return e.kind === 'npc' ? 'chat' : 'none';
  void area;
  return 'none';
}

/** 地圖上第一個「！」實體（目標列與機器人用）；依資料順序。 */
export function nextObjective(s: GameState, a: AreaDef): AreaEntity | undefined {
  return a.entities.find((e) => present(s, e) && markerOf(s, a.id, e) === 'main');
}

/** 互動結果（場景照這個呈現） */
export type Interaction =
  | { kind: 'script'; script: string; node: string; after?: 'map' }
  | { kind: 'say'; text: string }
  | { kind: 'loot'; effects: Effect[]; text: string; flag: string }
  | { kind: 'empty' };

/** 決定互動要做什麼（不改狀態；寶箱的旗標由場景套用 effects 時寫入）。pick = 選閒聊台詞用的 0..1 亂數 */
export function interact(s: GameState, area: string, e: AreaEntity, pick = 0): Interaction {
  if (e.kind === 'chest') {
    const flag = chestFlag(area, e.id);
    if (s.flags[flag]) return { kind: 'empty' };
    return { kind: 'loot', effects: [...(e.loot ?? []), { flag }], text: e.lootText ?? '找到了東西。', flag };
  }
  if (talkOpen(s, e)) return { kind: 'script', script: e.talk!.script, node: e.talk!.node, after: e.after };
  const lines = e.lines ?? [];
  if (lines.length === 0) return { kind: 'empty' };
  return { kind: 'say', text: lines[Math.min(lines.length - 1, Math.floor(pick * lines.length))]! };
}
