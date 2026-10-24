// 角色與敵人資料（09 §1–2）。
import type { BaseStats, Element, Telegraph } from '../core/battle/formulas';

export interface HeroDef {
  id: 'lian' | 'serin' | 'liora' | 'io' | 'rourke';
  name: string;
  base: BaseStats;
  attackElement: Element;
}

export const HEROES: Record<HeroDef['id'], HeroDef> = {
  lian: { id: 'lian', name: '連恩', base: { hp: 90, atk: 14, def: 8, spd: 12 }, attackElement: 'light' },
  serin: { id: 'serin', name: '瑟琳', base: { hp: 110, atk: 18, def: 10, spd: 11 }, attackElement: 'phys' },
  liora: { id: 'liora', name: '莉歐拉', base: { hp: 75, atk: 12, def: 6, spd: 13 }, attackElement: 'fire' },
  io: { id: 'io', name: '伊歐', base: { hp: 70, atk: 9, def: 7, spd: 14 }, attackElement: 'water' },
  rourke: { id: 'rourke', name: '洛克', base: { hp: 140, atk: 13, def: 14, spd: 8 }, attackElement: 'phys' },
};

export interface EnemyAttack {
  id: string;
  name: string;
  telegraph: Telegraph;
  windUpMs: number;
  mul: number;
  hits?: number[]; // 多段：每段相對時間（ms），例：[600, 950]
  aoe?: boolean;
  status?: 'poison' | 'umbra';
  weight: number; // 出招權重
  phase?: 1 | 2; // 限定階段
  drainEmber?: number; // 吸走我方星燼：失敗吸 n、成功吸 ceil(n/2)、完美不吸；每吸 1 點回復 3% 最大 HP
  /** 反燈印：未完美閃避 → 目標被標記，n 回合後引爆（場上同時只會有一個） */
  mark?: number;
  /** 吞噬記憶：防守失敗 → 隨機封印一名目標的一個技能 n 回合 */
  seal?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  breakMax: number;
  weak: Element[];
  resist?: Element[];
  actionsPerRound?: number; // Boss 2
  xp: number;
  attacks: EnemyAttack[];
  /** 特殊被動 */
  traits?: ('wallCrash' | 'howl' | 'fogPhase2' | 'erase' | 'eyeShield' | 'finale')[];
  /** 轉階段字卡（預設：霧起／狂化） */
  phase2?: { title: string; sub?: string };
}

export const ENEMIES: Record<string, EnemyDef> = {
  tr_beast: {
    id: 'tr_beast', name: '蝕化獸', level: 1, hp: 120, atk: 10, def: 2, spd: 6, breakMax: 30, weak: ['light'], xp: 10,
    attacks: [
      { id: 'claw', name: '爪擊', telegraph: 'white', windUpMs: 1100, mul: 1, weight: 1 },
      { id: 'ram', name: '衝撞', telegraph: 'red', windUpMs: 1200, mul: 1.2, weight: 1 },
    ],
  },
  mist_wolf: {
    id: 'mist_wolf', name: '霧狼', level: 2, hp: 55, atk: 15, def: 3, spd: 13, breakMax: 20, weak: ['fire'], xp: 12,
    attacks: [
      { id: 'bite', name: '撲咬', telegraph: 'white', windUpMs: 650, mul: 1, weight: 2 },
      { id: 'double', name: '連咬', telegraph: 'white', windUpMs: 600, mul: 0.6, hits: [0, 350], weight: 1 },
    ],
  },
  thorn_shroom: {
    id: 'thorn_shroom', name: '刺蕈', level: 2, hp: 70, atk: 13, def: 5, spd: 5, breakMax: 25, weak: ['fire'], xp: 12,
    attacks: [{ id: 'spore', name: '孢子噴射', telegraph: 'red', windUpMs: 800, mul: 0.8, status: 'poison', weight: 1 }],
  },
  umbra_boar: {
    id: 'umbra_boar', name: '蝕化野豬', level: 4, hp: 180, atk: 19, def: 8, spd: 7, breakMax: 40, weak: ['light'], xp: 24,
    traits: ['wallCrash'],
    attacks: [
      { id: 'charge', name: '衝鋒', telegraph: 'red', windUpMs: 900, mul: 1.4, weight: 2 },
      { id: 'umbra_bite', name: '蝕咬', telegraph: 'purple', windUpMs: 800, mul: 0.8, status: 'umbra', weight: 1 },
    ],
  },
  boss_wolfking: {
    id: 'boss_wolfking', name: '霧角狼王', level: 5, hp: 460, atk: 32, def: 10, spd: 12, breakMax: 80, weak: ['fire', 'light'],
    actionsPerRound: 2, xp: 120, traits: ['howl', 'fogPhase2'],
    attacks: [
      { id: 'pounce', name: '撲咬', telegraph: 'white', windUpMs: 600, mul: 1, weight: 3 },
      { id: 'claws', name: '雙爪', telegraph: 'white', windUpMs: 550, mul: 0.7, hits: [0, 300], weight: 2 },
      { id: 'fog_raid', name: '霧襲', telegraph: 'purple', windUpMs: 700, mul: 0.8, aoe: true, status: 'umbra', weight: 2, phase: 2 },
      { id: 'lunge', name: '狂撲', telegraph: 'red', windUpMs: 500, mul: 1.6, weight: 1, phase: 2 },
    ],
  },
  // ───────── 第 2 章：沉鐘礦坑 ─────────
  rock_beetle: {
    id: 'rock_beetle', name: '岩甲蟲', level: 6, hp: 170, atk: 24, def: 16, spd: 5, breakMax: 30, weak: ['phys', 'fire'], resist: ['water'], xp: 30,
    attacks: [
      { id: 'shell_ram', name: '甲殼衝撞', telegraph: 'red', windUpMs: 1000, mul: 1.3, weight: 2 },
      { id: 'pincer', name: '岩鉗', telegraph: 'white', windUpMs: 900, mul: 0.9, weight: 1 },
    ],
  },
  lamp_wraith: {
    id: 'lamp_wraith', name: '礦燈幽魂', level: 6, hp: 95, atk: 22, def: 4, spd: 14, breakMax: 22, weak: ['light'], resist: ['phys'], xp: 30,
    attacks: [
      { id: 'flicker', name: '殘燈閃爍', telegraph: 'white', windUpMs: 650, mul: 0.6, hits: [0, 300], weight: 2 },
      { id: 'umbra_wick', name: '蝕芯', telegraph: 'purple', windUpMs: 800, mul: 0.8, status: 'umbra', weight: 1 },
    ],
  },
  blast_lizard: {
    id: 'blast_lizard', name: '爆炸蜥', level: 7, hp: 120, atk: 26, def: 6, spd: 10, breakMax: 25, weak: ['water'], resist: ['fire'], xp: 34,
    attacks: [
      { id: 'tail_lash', name: '甩尾', telegraph: 'white', windUpMs: 700, mul: 1, weight: 2 },
      { id: 'blast', name: '自爆衝刺', telegraph: 'red', windUpMs: 850, mul: 1.5, aoe: true, weight: 1 },
    ],
  },
  boss_bellworm: {
    id: 'boss_bellworm', name: '鐘喉蠕蟲', level: 9, hp: 1075, atk: 40, def: 13, spd: 9, breakMax: 110, weak: ['light', 'water'], resist: ['fire'],
    actionsPerRound: 2, xp: 300,
    attacks: [
      // 階段 1：鐘響節奏——連續 4 次白光，節拍與鐘聲同步
      { id: 'bell_toll', name: '四連鐘響', telegraph: 'white', windUpMs: 700, mul: 0.4, hits: [0, 420, 840, 1260], weight: 3 },
      { id: 'bell_slam', name: '鐘身撞擊', telegraph: 'white', windUpMs: 650, mul: 1, weight: 2 },
      // 階段 2：鑽地（紅光，反向滑動）＋吞噬星燼（紫光蝕化）
      { id: 'burrow', name: '鑽地突襲', telegraph: 'red', windUpMs: 600, mul: 1.5, weight: 2, phase: 2 },
      { id: 'ember_devour', name: '吞噬星燼', telegraph: 'purple', windUpMs: 750, mul: 0.7, aoe: true, status: 'umbra', weight: 1, phase: 2, drainEmber: 3 },
    ],
    phase2: { title: '鐘裂', sub: '鑽地＋吞噬星燼' },
  },
  // ───────── 第 3 章：王都星冠城 ─────────
  sewer_rat: {
    id: 'sewer_rat', name: '下水道蝕鼠', level: 9, hp: 130, atk: 30, def: 8, spd: 15, breakMax: 22, weak: ['fire', 'light'], xp: 40,
    attacks: [
      { id: 'gnaw', name: '囓咬', telegraph: 'white', windUpMs: 600, mul: 0.7, hits: [0, 280], weight: 2 },
      { id: 'plague', name: '蝕疫', telegraph: 'red', windUpMs: 800, mul: 0.8, status: 'poison', weight: 1 },
    ],
  },
  alley_thug: {
    id: 'alley_thug', name: '夜巷打手', level: 10, hp: 190, atk: 33, def: 12, spd: 10, breakMax: 30, weak: ['phys'], xp: 46,
    attacks: [
      { id: 'club', name: '悶棍', telegraph: 'white', windUpMs: 750, mul: 1, weight: 2 },
      { id: 'feint', name: '假動作', telegraph: 'white', windUpMs: 1100, mul: 1.2, weight: 1 },
      { id: 'tackle', name: '撞倒', telegraph: 'red', windUpMs: 700, mul: 1.3, weight: 1 },
    ],
  },
  academy_guard: {
    id: 'academy_guard', name: '研究院衛兵', level: 11, hp: 240, atk: 36, def: 18, spd: 9, breakMax: 40, weak: ['water'], resist: ['light'], xp: 58,
    attacks: [
      { id: 'glaive', name: '星刃橫掃', telegraph: 'white', windUpMs: 700, mul: 0.6, aoe: true, weight: 2 },
      { id: 'rune_lance', name: '符文突刺', telegraph: 'red', windUpMs: 650, mul: 1.5, weight: 1 },
    ],
  },
  rune_hound: {
    id: 'rune_hound', name: '符文獵犬', level: 11, hp: 150, atk: 34, def: 10, spd: 17, breakMax: 26, weak: ['water', 'phys'], xp: 50,
    attacks: [
      { id: 'rune_bite', name: '符文撕咬', telegraph: 'white', windUpMs: 550, mul: 0.6, hits: [0, 260, 520], weight: 2 },
      { id: 'umbra_howl', name: '蝕吠', telegraph: 'purple', windUpMs: 750, mul: 0.6, aoe: true, status: 'umbra', weight: 1 },
    ],
  },
  // 洛克（Lv 13）：三段戰鬥之間插入說服（劇本 ch3 rourke_duel）。每段是同一場決鬥的延續，HP 逐段下降、招式升級。
  boss_rourke_1: {
    id: 'boss_rourke_1', name: '洛克', level: 13, hp: 620, atk: 47, def: 18, spd: 8, breakMax: 90, weak: ['fire'], resist: ['phys'],
    actionsPerRound: 2, xp: 160,
    attacks: [
      { id: 'halberd', name: '斧槍劈砍', telegraph: 'white', windUpMs: 700, mul: 1, weight: 3 },
      { id: 'sweep', name: '橫掃千軍', telegraph: 'white', windUpMs: 800, mul: 0.6, aoe: true, weight: 2 },
    ],
  },
  boss_rourke_2: {
    id: 'boss_rourke_2', name: '洛克', level: 13, hp: 520, atk: 54, def: 18, spd: 9, breakMax: 90, weak: ['fire'], resist: ['phys'],
    actionsPerRound: 2, xp: 160,
    attacks: [
      { id: 'halberd', name: '斧槍劈砍', telegraph: 'white', windUpMs: 650, mul: 1, weight: 2 },
      { id: 'feint_thrust', name: '老兵的虛招', telegraph: 'white', windUpMs: 1150, mul: 1.3, weight: 2 },
      { id: 'shield_rush', name: '盾衝', telegraph: 'red', windUpMs: 650, mul: 1.5, weight: 1 },
      // 紅光連段：連續兩次閃避（D-028）
      { id: 'twin_charge', name: '雙重突進', telegraph: 'red', windUpMs: 700, mul: 0.9, hits: [0, 420], weight: 2 },
    ],
  },
  boss_rourke_3: {
    id: 'boss_rourke_3', name: '洛克', level: 13, hp: 440, atk: 58, def: 16, spd: 10, breakMax: 80, weak: ['fire'], resist: ['phys'],
    actionsPerRound: 2, xp: 220,
    attacks: [
      { id: 'halberd', name: '斧槍劈砍', telegraph: 'white', windUpMs: 600, mul: 1, weight: 2 },
      { id: 'last_stand', name: '背水一擊', telegraph: 'white', windUpMs: 700, mul: 0.5, hits: [0, 380, 760], weight: 2 },
      { id: 'shield_rush', name: '盾衝', telegraph: 'red', windUpMs: 600, mul: 1.6, weight: 1 },
      // 三連紅光：連續閃避三次（D-028）
      { id: 'veteran_combo', name: '老兵連舞', telegraph: 'red', windUpMs: 650, mul: 0.8, hits: [0, 380, 760], weight: 2 },
    ],
  },
  // ───────── 第 4 章：研究院地下 ─────────
  proto_weapon: {
    id: 'proto_weapon', name: '蝕化兵器原型', level: 14, hp: 300, atk: 44, def: 16, spd: 11, breakMax: 45, weak: ['light'], resist: ['fire'], xp: 80,
    attacks: [
      { id: 'tendril', name: '蝕觸', telegraph: 'white', windUpMs: 600, mul: 0.55, hits: [0, 300, 600], weight: 2 },
      { id: 'core_burst', name: '核心爆發', telegraph: 'purple', windUpMs: 850, mul: 0.8, aoe: true, status: 'umbra', weight: 1 },
    ],
  },
  star_golem: {
    id: 'star_golem', name: '星燼魔像', level: 14, hp: 420, atk: 46, def: 24, spd: 5, breakMax: 60, weak: ['water', 'phys'], resist: ['light'], xp: 90,
    attacks: [
      { id: 'slam', name: '重拳', telegraph: 'red', windUpMs: 1000, mul: 1.6, weight: 2 },
      { id: 'quake', name: '地鳴', telegraph: 'white', windUpMs: 900, mul: 0.6, aoe: true, weight: 1 },
    ],
  },
  // 大司星 瓦爾德蘭（Lv 16）：階段 1 白紅交錯的星術；階段 2 星燼吞噬 + 反燈印（3 回合後引爆，引路之光淨化）
  boss_valderan: {
    id: 'boss_valderan', name: '大司星 瓦爾德蘭', level: 16, hp: 1680, atk: 51, def: 20, spd: 12, breakMax: 140, weak: ['light'], resist: ['fire'],
    actionsPerRound: 2, xp: 500,
    attacks: [
      { id: 'star_volley', name: '星術連發', telegraph: 'white', windUpMs: 650, mul: 0.4, hits: [0, 300, 700, 900], weight: 3 },
      { id: 'comet', name: '墜星', telegraph: 'red', windUpMs: 700, mul: 1.5, weight: 2 },
      { id: 'crown_ray', name: '星冠光束', telegraph: 'white', windUpMs: 1200, mul: 0.7, aoe: true, weight: 1 },
      { id: 'core_siphon', name: '星核汲取', telegraph: 'purple', windUpMs: 800, mul: 0.6, aoe: true, status: 'umbra', weight: 2, phase: 2, drainEmber: 2 },
      { id: 'false_lamp', name: '仿燈印・爆', telegraph: 'red', windUpMs: 550, mul: 1.8, weight: 1, phase: 2 },
      { id: 'inverse_mark', name: '反燈印', telegraph: 'red', windUpMs: 850, mul: 0.5, weight: 3, phase: 2, mark: 3 },
    ],
    phase2: { title: '星空舞台', sub: '反燈印：用引路之光淨化' },
  },
  // ───────── 終章：墜星裂谷 ─────────
  rift_spawn: {
    id: 'rift_spawn', name: '裂谷墜影', level: 16, hp: 280, atk: 48, def: 16, spd: 14, breakMax: 40, weak: ['light'], xp: 100,
    attacks: [
      { id: 'shard_rain', name: '碎星', telegraph: 'white', windUpMs: 600, mul: 0.5, hits: [0, 250, 500], weight: 2 },
      { id: 'dive', name: '墜擊', telegraph: 'red', windUpMs: 650, mul: 1.5, weight: 1 },
    ],
  },
  // 蝕星者（終局 Boss）：階段 1 墜星雨（紅光）；階段 2 吞噬（吸星燼、蝕化全體）
  boss_starfall: {
    id: 'boss_starfall', name: '蝕星者', level: 18, hp: 1000, atk: 50, def: 20, spd: 11, breakMax: 160, weak: ['light'], resist: ['phys'],
    actionsPerRound: 2, xp: 0,
    attacks: [
      { id: 'meteor', name: '墜星雨', telegraph: 'red', windUpMs: 650, mul: 1.2, weight: 3 },
      { id: 'gaze', name: '凝視', telegraph: 'white', windUpMs: 700, mul: 0.45, hits: [0, 350, 700], weight: 2 },
      { id: 'meteor_storm', name: '流星暴', telegraph: 'red', windUpMs: 750, mul: 0.8, aoe: true, weight: 1, phase: 2 },
      { id: 'devour_memory', name: '吞噬記憶', telegraph: 'purple', windUpMs: 800, mul: 0.6, aoe: true, status: 'umbra', weight: 2, phase: 2, drainEmber: 3, seal: 2 },
    ],
    phase2: { title: '吞噬', sub: '吞噬記憶：防守失敗會被封印技能' },
  },
  // 蝕星者第二段（D-029）：刪除之眼（每回合抹除全員 HP、保護核心）＋核心（HP ≤ 35% 觸發全員共鳴：十燈）
  boss_starfall_eye: {
    id: 'boss_starfall_eye', name: '刪除之眼', level: 18, hp: 364, atk: 51, def: 12, spd: 15, breakMax: 40, weak: ['light', 'fire'], xp: 0,
    traits: ['erase'],
    attacks: [
      { id: 'erase_gaze', name: '刪除凝視', telegraph: 'white', windUpMs: 650, mul: 0.35, hits: [0, 300, 600], weight: 2 },
      { id: 'blink', name: '眨眼', telegraph: 'red', windUpMs: 550, mul: 1.2, weight: 1 },
    ],
  },
  boss_starfall_core: {
    id: 'boss_starfall_core', name: '蝕星者・核心', level: 18, hp: 1013, atk: 58, def: 15, spd: 10, breakMax: 140, weak: ['light'], resist: ['phys'],
    xp: 0, traits: ['eyeShield', 'finale'],
    attacks: [
      { id: 'meteor', name: '墜星雨', telegraph: 'red', windUpMs: 650, mul: 1.2, weight: 2 },
      { id: 'meteor_storm', name: '流星暴', telegraph: 'red', windUpMs: 750, mul: 0.8, aoe: true, weight: 1 },
      { id: 'devour_memory', name: '吞噬記憶', telegraph: 'purple', windUpMs: 800, mul: 0.6, aoe: true, status: 'umbra', weight: 2, drainEmber: 3, seal: 2 },
    ],
  },
};

export const ENCOUNTERS: Record<string, string[]> = {
  ch0_tutorial: ['tr_beast'],
  forest_a: ['mist_wolf', 'mist_wolf'],
  forest_b: ['mist_wolf', 'thorn_shroom'],
  path_a: ['mist_wolf', 'mist_wolf', 'mist_wolf'],
  path_b: ['thorn_shroom', 'thorn_shroom'],
  caravan: ['mist_wolf', 'mist_wolf', 'mist_wolf'],
  shrine_boar: ['umbra_boar'],
  boss_wolfking: ['boss_wolfking'],
  // 第 2 章
  mine_a: ['rock_beetle', 'lamp_wraith'],
  mine_b: ['lamp_wraith', 'lamp_wraith', 'blast_lizard'],
  bell_hall: ['rock_beetle', 'blast_lizard', 'lamp_wraith'],
  deep_1: ['lamp_wraith', 'blast_lizard'],
  deep_2: ['rock_beetle', 'rock_beetle'],
  deep_3: ['blast_lizard', 'blast_lizard', 'lamp_wraith'],
  boss_bellworm: ['boss_bellworm'],
  // 第 3 章
  sewer_rats: ['sewer_rat', 'sewer_rat', 'sewer_rat'],
  alley_thugs: ['alley_thug', 'alley_thug'],
  academy_guard: ['academy_guard', 'rune_hound'],
  rourke_1: ['boss_rourke_1'],
  rourke_2: ['boss_rourke_2'],
  rourke_3: ['boss_rourke_3'],
  // 第 4 章
  ch4_gate: ['academy_guard', 'academy_guard', 'rune_hound'],
  ch4_lab_a: ['proto_weapon', 'rune_hound'],
  ch4_lab_b: ['star_golem', 'proto_weapon'],
  boss_valderan: ['boss_valderan'],
  // 終章
  ch5_rift: ['rift_spawn', 'rift_spawn'],
  boss_starfall: ['boss_starfall'],
  boss_starfall_2: ['boss_starfall_eye', 'boss_starfall_core'],
};
