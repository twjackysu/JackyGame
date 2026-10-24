// 道具與裝備資料表（11-open-world §2.4）。圖示：public/art/item_*.webp（沒有圖就用程式圖示）。
import type { BaseStats } from '../core/battle/formulas';
import type { MemberId } from '../core/state/gameState';

export type Slot = 'weapon' | 'armor' | 'charm';
export const SLOTS: readonly Slot[] = ['weapon', 'armor', 'charm'];
export const SLOT_NAME: Record<Slot, string> = { weapon: '武器', armor: '防具', charm: '飾品' };

export interface ItemDef {
  id: string;
  name: string;
  /** 'use' = 戰鬥道具、'gear' = 裝備、'key' = 重要物品（不能賣） */
  kind: 'use' | 'gear' | 'key' | 'gift';
  /** 參考價（商店買價）；賣價 = 50%。0 = 非賣品 */
  price: number;
  desc: string;
  /** 圖示 key（public/art/<icon>.webp）；tint 用來區分同圖不同階 */
  icon?: string;
  tint?: number;
  slot?: Slot;
  bonus?: Partial<BaseStats>;
  /** 限定誰能裝（沒寫 = 全員） */
  for?: readonly MemberId[];
}

const W_LIAN = ['lian'] as const;
const W_SERIN = ['serin'] as const;
const W_ROURKE = ['rourke'] as const;
const W_CASTER = ['io', 'liora'] as const;

const LIST: ItemDef[] = [
  // ── 戰鬥道具 ──
  { id: 'potion_s', name: '小回復藥', kind: 'use', price: 30, desc: '戰鬥中回復 60 HP。', icon: 'item_potion_s' },
  { id: 'potion_m', name: '回復藥', kind: 'use', price: 80, desc: '戰鬥中回復 160 HP。', icon: 'item_potion_m' },
  { id: 'lamp_oil', name: '燈油', kind: 'use', price: 40, desc: '戰鬥中回復 2 SP。', icon: 'item_lamp_oil' },
  { id: 'blast_bottle', name: '爆燈瓶', kind: 'use', price: 70, desc: '莉歐拉的發明：對全體敵人造成火屬性傷害。', icon: 'item_blast_bottle' },

  // ── 武器 ──
  { id: 'old_lantern', name: '舊提燈', kind: 'gear', slot: 'weapon', for: W_LIAN, price: 0, bonus: { atk: 2 }, desc: '被撿到那天就在身邊的提燈。傳承任務的鑰匙。', icon: 'item_lantern_1', tint: 0xc8b090 },
  { id: 'lantern_tin', name: '錫製提燈', kind: 'gear', slot: 'weapon', for: W_LIAN, price: 60, bonus: { atk: 4 }, desc: '燈罩擦得發亮，揮起來很順手。', icon: 'item_lantern_1' },
  { id: 'lantern_brass', name: '黃銅掌燈', kind: 'gear', slot: 'weapon', for: W_LIAN, price: 180, bonus: { atk: 8, spd: 1 }, desc: '掌燈人公會的制式提燈。', icon: 'item_lantern_2' },
  { id: 'lantern_star', name: '星燼提燈', kind: 'gear', slot: 'weapon', for: W_LIAN, price: 480, bonus: { atk: 14, hp: 20 }, desc: '燈芯裡封著一粒星燼，微微發燙。', icon: 'item_lantern_2', tint: 0xffe08a },
  { id: 'sword_iron', name: '鐵劍', kind: 'gear', slot: 'weapon', for: W_SERIN, price: 70, bonus: { atk: 5 }, desc: '平凡、可靠、好保養。', icon: 'item_sword_1' },
  { id: 'sword_knight', name: '騎士長劍', kind: 'gear', slot: 'weapon', for: W_SERIN, price: 220, bonus: { atk: 10 }, desc: '劍格刻著騎士團的燈紋。', icon: 'item_sword_2' },
  { id: 'sword_dawn', name: '破曉之劍', kind: 'gear', slot: 'weapon', for: W_SERIN, price: 520, bonus: { atk: 16, spd: 1 }, desc: '劍身在黑暗裡會映出晨光。', icon: 'item_sword_2', tint: 0xffd0a0 },
  { id: 'halberd_oak', name: '橡木戟', kind: 'gear', slot: 'weapon', for: W_ROURKE, price: 70, bonus: { atk: 4, def: 2 }, desc: '傭兵愛用，壞了也不心疼。', icon: 'item_halberd_1' },
  { id: 'halberd_steel', name: '鋼刃戟', kind: 'gear', slot: 'weapon', for: W_ROURKE, price: 240, bonus: { atk: 9, def: 4 }, desc: '重。但洛克說「剛好」。', icon: 'item_halberd_1', tint: 0xb8d0ff },
  { id: 'staff_willow', name: '柳木杖', kind: 'gear', slot: 'weapon', for: W_CASTER, price: 60, bonus: { atk: 3, hp: 10 }, desc: '杖頭纏著祈福的布條。', icon: 'item_staff_1' },
  { id: 'staff_crystal', name: '霧晶杖', kind: 'gear', slot: 'weapon', for: W_CASTER, price: 230, bonus: { atk: 8, spd: 1 }, desc: '霧之湖底的晶石，會回應歌聲。', icon: 'item_staff_1', tint: 0x9fe0ff },

  // ── 防具 ──
  { id: 'armor_cloth', name: '旅人布衣', kind: 'gear', slot: 'armor', price: 40, bonus: { def: 2, hp: 10 }, desc: '耐髒、耐洗、耐走。', icon: 'item_armor_cloth' },
  { id: 'armor_leather', name: '硬皮甲', kind: 'gear', slot: 'armor', price: 130, bonus: { def: 5, hp: 20 }, desc: '獵人小屋的手工皮甲。', icon: 'item_armor_leather' },
  { id: 'armor_mist', name: '霧織長袍', kind: 'gear', slot: 'armor', for: ['lian', 'io', 'liora'], price: 300, bonus: { def: 6, hp: 35, spd: 1 }, desc: '輕得像霧，卻擋得住爪子。', icon: 'item_armor_cloth', tint: 0xb0d8ff },
  { id: 'armor_plate', name: '守燈鎧', kind: 'gear', slot: 'armor', for: ['serin', 'rourke'], price: 360, bonus: { def: 11, hp: 45, spd: -1 }, desc: '厚重的板甲。站在前排的人穿的。', icon: 'item_armor_plate' },

  // ── 飾品 ──
  { id: 'charm_ember', name: '餘燼護符', kind: 'gear', slot: 'charm', price: 100, bonus: { atk: 3 }, desc: '握著會覺得手心溫溫的。', icon: 'item_charm_1' },
  { id: 'ring_swift', name: '迅風戒', kind: 'gear', slot: 'charm', price: 150, bonus: { spd: 2 }, desc: '戴上後腳步變輕——出手順序會提前。', icon: 'item_ring_1' },
  { id: 'amulet_guard', name: '守護項鍊', kind: 'gear', slot: 'charm', price: 170, bonus: { def: 3, hp: 25 }, desc: '母親留給孩子的那種項鍊。', icon: 'item_amulet_1' },
  { id: 'mist_pendant', name: '霧之墜飾', kind: 'gear', slot: 'charm', price: 0, bonus: { def: 2, spd: 1, hp: 15 }, desc: '倒木下撿到的墜飾，霧氣在裡面流動。', icon: 'item_amulet_1', tint: 0xa8e8ff },

  // ── 禮物（營火送給同伴，喜好見 src/data/dialogue/camp.ts） ──
  { id: 'gift_flower', name: '野花束', kind: 'gift', price: 20, desc: '路邊採的小花，紮成一束。', icon: 'item_gift_flower' },
  { id: 'gift_book', name: '舊書', kind: 'gift', price: 45, desc: '書頁泛黃的騎士故事集。', icon: 'item_gift_book' },
  { id: 'gift_gear', name: '精巧齒輪', kind: 'gift', price: 50, desc: '咬合得剛剛好的黃銅齒輪。', icon: 'item_gift_gear' },
  { id: 'gift_ribbon', name: '緞帶', kind: 'gift', price: 30, desc: '星空色的緞帶。', icon: 'item_gift_ribbon' },
  { id: 'gift_wine', name: '陳年葡萄汁', kind: 'gift', price: 40, desc: '老兵最愛的那種，瓶子很有年代感。', icon: 'item_gift_wine' },

  // ── 重要物品 ──
  { id: 'lamp_wick', name: '燈芯', kind: 'key', price: 0, desc: '古燈塔需要的燈芯。', icon: 'item_key' },
  { id: 'ember_card_pack', name: '燼牌補充包', kind: 'key', price: 0, desc: '酒館老闆給的燼牌。', icon: 'item_card_pack' },
];

export const ITEM_DEFS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

export function itemDef(id: string): ItemDef {
  return ITEM_DEFS[id] ?? { id, name: id, kind: 'key', price: 0, desc: '' };
}

export interface ShopDef {
  name: string;
  /** 店主招呼 */
  greet: string;
  stock: readonly string[];
}

export const SHOPS: Record<string, ShopDef> = {
  ch1_general: {
    name: '托比的雜貨店',
    greet: '要點什麼？看上眼的就拿去。',
    stock: ['potion_s', 'lamp_oil', 'blast_bottle', 'lantern_tin', 'sword_iron', 'halberd_oak', 'staff_willow', 'armor_cloth', 'armor_leather', 'charm_ember', 'ring_swift', 'gift_flower', 'gift_ribbon', 'gift_wine'],
  },
  ch2_camp: {
    name: '礦工營地的補給站',
    greet: '礦坑裡用得到的，這裡都有。',
    stock: ['potion_s', 'potion_m', 'lamp_oil', 'blast_bottle', 'lantern_brass', 'sword_knight', 'halberd_steel', 'staff_crystal', 'armor_leather', 'amulet_guard', 'ring_swift', 'gift_gear', 'gift_book', 'gift_wine'],
  },
  capital: {
    name: '王都商店街',
    greet: '王都的貨，品質保證。',
    stock: ['potion_s', 'potion_m', 'lamp_oil', 'blast_bottle', 'lantern_brass', 'lantern_star', 'sword_knight', 'sword_dawn', 'halberd_steel', 'staff_crystal', 'armor_mist', 'armor_plate', 'amulet_guard', 'ring_swift', 'gift_flower', 'gift_book', 'gift_gear', 'gift_ribbon'],
  },
};
