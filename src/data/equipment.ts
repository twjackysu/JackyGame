// 道具與裝備資料表（11-open-world §2.4）。圖示：public/art/item_*.webp（沒有圖就用程式圖示）。
import type { BaseStats } from '../core/battle/formulas';
import { MATERIALS } from './materials';
import { GEAR_SLOTS, type EquipSlot, type GearSlot } from './rules';
import type { MemberId } from '../core/state/gameState';
import type { Perk } from '../core/battle/engine';

/** 稀有度（§2.4b）：普通＝商店買得到；稀有（藍）＝只能掉落或寶箱；神級（金）＝只能掉落，帶特效 */
export type Rarity = 'common' | 'rare' | 'legendary';
export const RARITY_NAME: Record<Rarity, string> = { common: '普通', rare: '稀有', legendary: '神級' };
export const RARITY_COLOR: Record<Rarity, number> = { common: 0xffffff, rare: 0x6fb8ff, legendary: 0xffc84a };
export const RARITY_CSS: Record<Rarity, string> = { common: '#ffffff', rare: '#7cc0ff', legendary: '#ffd05a' };
export const PERK_INFO: Record<Perk, { name: string; desc: string }> = {
  lampStart: { name: '先燃', desc: '戰鬥開始時，每個敵人掛上 1 盞燈印。' },
  spRegen: { name: '湧泉', desc: '自己的回合開始時，SP 額外 +1。' },
  lastStand: { name: '不滅', desc: '每場戰鬥第一次受到致命傷時，以 1 HP 撐住。' },
  widePerfect: { name: '明眸', desc: '全隊的時機判定窗口 +15%。' },
  swift: { name: '疾影', desc: '每回合都最先行動。' },
};

/** 裝備模板的部位類型（D-053：頭飾、星燼核心目前還沒有模板） */
export type Slot = GearSlot;
export const SLOTS: readonly Slot[] = GEAR_SLOTS;
export const SLOT_NAME: Record<Slot, string> = { weapon: '武器', armor: '防具', head: '頭飾', charm: '飾品', core: '星燼核心' };
/** 角色身上的 6 個欄位（飾品 2 格） */
export type { EquipSlot } from './rules';
export const EQUIP_SLOT_NAME: Record<EquipSlot, string> = { weapon: '武器', armor: '防具', head: '頭飾', charm1: '飾品 1', charm2: '飾品 2', core: '星燼核心' };

export interface ItemDef {
  id: string;
  name: string;
  /** 'use' = 戰鬥道具、'gear' = 裝備、'key' = 重要物品（不能賣）、'mat' = 強化／重鑄材料（不能買賣） */
  kind: 'use' | 'gear' | 'key' | 'gift' | 'mat';
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
  /** 沒寫 = common */
  rarity?: Rarity;
  /** 神級特效 */
  perk?: Perk;
  /** 收藏頁提示：從哪裡掉落 */
  source?: string;
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
  { id: 'mist_pendant', name: '霧之墜飾', kind: 'gear', slot: 'charm', price: 0, bonus: { def: 2, spd: 1, hp: 15 }, desc: '倒木下撿到的墜飾，霧氣在裡面流動。', icon: 'item_amulet_1', tint: 0xa8e8ff, rarity: 'rare', source: '霧角森林的倒木' },

  // ── 稀有（只能掉落；price 只用來算賣價，不上架——有測試） ──
  // 第 1 章
  { id: 'wolf_fang_charm', name: '霧狼牙墜', kind: 'gear', slot: 'charm', rarity: 'rare', price: 220, bonus: { atk: 5, spd: 1 }, desc: '霧狼最尖的那顆牙，穿上皮繩。', icon: 'item_charm_1', tint: 0xcfe6ff, source: '霧狼' },
  { id: 'shroom_cloak', name: '菇傘斗篷', kind: 'gear', slot: 'armor', rarity: 'rare', price: 240, bonus: { def: 5, hp: 35 }, desc: '用荊棘菇的傘蓋鞣成的斗篷，雨打不濕。', icon: 'item_armor_cloth', tint: 0xd89a7a, source: '刺蕈、蝕化野豬' },
  { id: 'wolfking_pelt', name: '狼王披風', kind: 'gear', slot: 'armor', rarity: 'rare', price: 320, bonus: { def: 7, hp: 45, spd: 1 }, desc: '銀灰色的毛皮，還留著狼王的體溫。', icon: 'item_armor_leather', tint: 0xc8d0e8, source: '霧角狼王（首殺必掉）' },
  // 第 2 章
  { id: 'wraith_lamp', name: '幽燈', kind: 'gear', slot: 'weapon', for: W_LIAN, rarity: 'rare', price: 380, bonus: { atk: 11, spd: 1 }, desc: '礦燈幽魂留下的燈，火是藍色的，卻很溫暖。', icon: 'item_lantern_2', tint: 0x9fd0ff, source: '礦燈幽魂' },
  { id: 'beetle_guard', name: '晶殼護甲', kind: 'gear', slot: 'armor', for: ['serin', 'rourke'], rarity: 'rare', price: 420, bonus: { def: 10, hp: 45 }, desc: '岩甲蟲的殼裡長著礦晶，硬得驚人。', icon: 'item_armor_plate', tint: 0xa8e0d0, source: '岩甲蟲' },
  { id: 'bell_chime', name: '鐘喉風鈴', kind: 'gear', slot: 'charm', rarity: 'rare', price: 360, bonus: { def: 3, hp: 30, spd: 1 }, desc: '鐘喉蠕蟲體內的小鐘，一搖就讓人冷靜。', icon: 'item_amulet_1', tint: 0xffe0a0, source: '鐘喉蠕蟲（首殺必掉）' },
  // 第 3 章
  { id: 'rune_collar', name: '符文頸環', kind: 'gear', slot: 'charm', rarity: 'rare', price: 400, bonus: { atk: 6, def: 2 }, desc: '研究院符文獵犬的項圈，刻著看不懂的咒文。', icon: 'item_ring_1', tint: 0xc0a0ff, source: '符文獵犬' },
  { id: 'guard_halberd', name: '衛兵長戟', kind: 'gear', slot: 'weapon', for: W_ROURKE, rarity: 'rare', price: 440, bonus: { atk: 12, def: 5 }, desc: '研究院衛兵的制式長戟，比外面賣的還好。', icon: 'item_halberd_1', tint: 0xe0e0ff, source: '研究院衛兵' },
  { id: 'rourke_scarf', name: '傭兵的舊圍巾', kind: 'gear', slot: 'charm', rarity: 'rare', price: 420, bonus: { atk: 3, def: 3, hp: 30, spd: 1 }, desc: '洛克輸了之後扔給你的。「別弄丟了。」', icon: 'item_gift_ribbon', tint: 0xd06a5a, source: '洛克（第三戰首殺必掉）' },
  // 第 4 章
  { id: 'proto_staff', name: '原型晶核杖', kind: 'gear', slot: 'weapon', for: W_CASTER, rarity: 'rare', price: 520, bonus: { atk: 13, spd: 1 }, desc: '從原型兵器裡拆出來的晶核，嗡嗡作響。', icon: 'item_staff_1', tint: 0xb0a0ff, source: '蝕化兵器原型' },
  { id: 'golem_plate', name: '星岩板甲', kind: 'gear', slot: 'armor', for: ['serin', 'rourke'], rarity: 'rare', price: 600, bonus: { def: 15, hp: 60, spd: -1 }, desc: '星燼魔像的外殼，敲起來會發出星光。', icon: 'item_armor_plate', tint: 0xffe6a0, source: '星燼魔像' },
  { id: 'scholar_robe', name: '院長長袍', kind: 'gear', slot: 'armor', for: ['lian', 'io', 'liora'], rarity: 'rare', price: 560, bonus: { def: 10, hp: 50, spd: 1 }, desc: '瓦爾德蘭的長袍。袖口縫著一盞小小的燈。', icon: 'item_armor_cloth', tint: 0x6a5aa0, source: '瓦爾德蘭（首殺必掉）' },
  // 終章
  { id: 'rift_blade', name: '裂谷星刃', kind: 'gear', slot: 'weapon', for: W_SERIN, rarity: 'rare', price: 680, bonus: { atk: 20, spd: 1 }, desc: '星屑凝成的刀刃，揮動時拖出一道光。', icon: 'item_sword_2', tint: 0xff9ad0, source: '裂谷墜影' },
  { id: 'star_ring', name: '墜星戒', kind: 'gear', slot: 'charm', rarity: 'rare', price: 600, bonus: { atk: 6, spd: 2 }, desc: '戒台上嵌著一粒還在發光的星屑。', icon: 'item_ring_1', tint: 0xffb0e0, source: '裂谷墜影' },
  { id: 'starfall_halberd', name: '墜星戟', kind: 'gear', slot: 'weapon', for: W_ROURKE, rarity: 'rare', price: 700, bonus: { atk: 16, def: 6 }, desc: '蝕星者外殼的碎片，被洛克硬是綁上了戟柄。', icon: 'item_halberd_1', tint: 0xff8ab0, source: '蝕星者（首殺必掉）' },

  // ── 神級（金光＋特效，只能掉落） ──
  { id: 'moon_fang', name: '月牙之眼', kind: 'gear', slot: 'charm', rarity: 'legendary', perk: 'swift', price: 600, bonus: { atk: 5, spd: 3 }, desc: '狼王額頭上那枚月牙形的石頭。戴上後，世界好像慢了半拍。', icon: 'item_amulet_1', tint: 0xfff0b0, source: '霧角狼王・霧狼（極低機率）' },
  { id: 'bellsong_mail', name: '鳴鐘鎧', kind: 'gear', slot: 'armor', rarity: 'legendary', perk: 'lastStand', price: 900, bonus: { def: 9, hp: 50 }, desc: '受到重擊時會「噹」地響一聲——然後你還站著。', icon: 'item_armor_plate', tint: 0xffd070, source: '鐘喉蠕蟲・礦燈幽魂（極低機率）' },
  { id: 'veteran_crest', name: '老兵徽記', kind: 'gear', slot: 'charm', rarity: 'legendary', perk: 'spRegen', price: 1000, bonus: { atk: 4, def: 4 }, desc: '某支早已解散的傭兵團徽記。握著它，呼吸會變得很穩。', icon: 'item_charm_1', tint: 0xffc060, source: '洛克・夜巷打手（極低機率）' },
  { id: 'star_lens', name: '星痕單片鏡', kind: 'gear', slot: 'charm', rarity: 'legendary', perk: 'widePerfect', price: 1200, bonus: { atk: 5, spd: 2 }, desc: '研究院最初的觀星鏡片。透過它，連敵人的呼吸都看得見。', icon: 'item_ring_1', tint: 0xfff4c0, source: '瓦爾德蘭・星燼魔像（極低機率）' },
  { id: 'first_lamp', name: '初燈', kind: 'gear', slot: 'weapon', for: W_LIAN, rarity: 'legendary', perk: 'lampStart', price: 1500, bonus: { atk: 22, hp: 30 }, desc: '傳說中第一個掌燈人提的燈。一舉起來，四周的黑暗就自己燒起來。', icon: 'item_lantern_2', tint: 0xffe070, source: '蝕星者・裂谷墜影（極低機率）' },

  // ── 禮物（營火送給同伴，喜好見 src/data/dialogue/camp.ts） ──
  { id: 'gift_flower', name: '野花束', kind: 'gift', price: 20, desc: '路邊採的小花，紮成一束。', icon: 'item_gift_flower' },
  { id: 'gift_book', name: '舊書', kind: 'gift', price: 45, desc: '書頁泛黃的騎士故事集。', icon: 'item_gift_book' },
  { id: 'gift_gear', name: '精巧齒輪', kind: 'gift', price: 50, desc: '咬合得剛剛好的黃銅齒輪。', icon: 'item_gift_gear' },
  { id: 'gift_ribbon', name: '緞帶', kind: 'gift', price: 30, desc: '星空色的緞帶。', icon: 'item_gift_ribbon' },
  { id: 'gift_wine', name: '陳年葡萄汁', kind: 'gift', price: 40, desc: '老兵最愛的那種，瓶子很有年代感。', icon: 'item_gift_wine' },

  // ── 重要物品 ──
  { id: 'lamp_wick', name: '燈芯', kind: 'key', price: 0, desc: '古燈塔需要的燈芯。', icon: 'item_key' },
  { id: 'ember_card_pack', name: '燼牌補充包', kind: 'key', price: 0, desc: '酒館老闆給的燼牌。', icon: 'item_card_pack' },
  // 強化／重鑄材料（src/data/materials.ts；D-053 材料 ≤ 7 種）。price 0 ＝商店不買不收
  ...MATERIALS.map((m): ItemDef => ({ id: m.id, name: m.name, kind: 'mat', price: 0, desc: m.desc })),
];

export const ITEM_DEFS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

export const rarityOf = (id: string): Rarity => ITEM_DEFS[id]?.rarity ?? 'common';

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
