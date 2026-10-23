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
  traits?: ('wallCrash' | 'howl' | 'fogPhase2')[];
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
};
