// 角色技能定義（09 §1）。純資料，引擎依 id 解析效果。
import type { HeroDef } from '../../data/combatants';

export type HeroId = HeroDef['id'];
export type SkillTargeting = 'enemy' | 'allEnemies' | 'self' | 'allAllies' | 'none';

export interface SkillDef {
  id: string;
  hero: HeroId;
  name: string;
  costSp?: number;
  costEmber?: number;
  /** 需要時機輸入（resolveTiming）；否則立即生效 */
  timing: boolean;
  targeting: SkillTargeting;
  oncePerBattle?: boolean;
  /** 需要旗標解鎖（例：引路之光 1-9） */
  unlockFlag?: 'guidingLight';
  /** 連攜技：此夥伴也必須在場（未倒地） */
  partner?: HeroId;
  /** 技能樹解鎖（Unit.treeSkills 有才能用；D-049） */
  tree?: true;
}

/** 普攻倍率與目標（洛克普攻打全體） */
export const BASIC_ATTACK: Record<HeroId, { mul: number; all: boolean; name: string }> = {
  lian: { mul: 1.0, all: false, name: '提燈打擊' },
  io: { mul: 0.9, all: false, name: '指尖漣漪' },
  rourke: { mul: 0.8, all: true, name: '斧槍橫掃' },
  serin: { mul: 1.0, all: false, name: '攻擊' },
  liora: { mul: 1.0, all: false, name: '攻擊' },
};

export const SKILLS: Record<string, SkillDef> = {
  lamp_mark: { id: 'lamp_mark', hero: 'lian', name: '燈印', costEmber: 1, timing: true, targeting: 'enemy' },
  resonance: { id: 'resonance', hero: 'lian', name: '共鳴', costEmber: 3, timing: true, targeting: 'allEnemies' },
  guiding_light: {
    id: 'guiding_light', hero: 'lian', name: '引路之光', costSp: 2, timing: false, targeting: 'none', unlockFlag: 'guidingLight',
  },
  glimmer_song: { id: 'glimmer_song', hero: 'io', name: '微光之歌', costSp: 4, timing: true, targeting: 'allAllies' },
  silence: { id: 'silence', hero: 'io', name: '靜默', costSp: 2, timing: false, targeting: 'enemy' },
  rewind: { id: 'rewind', hero: 'io', name: '回溯', costEmber: 5, timing: false, targeting: 'allAllies', oncePerBattle: true },
  taunt: { id: 'taunt', hero: 'rourke', name: '挑釁', costSp: 1, timing: false, targeting: 'self' },
  counter_stance: { id: 'counter_stance', hero: 'rourke', name: '反擊架勢', costSp: 2, timing: false, targeting: 'self' },
  veteran_instinct: { id: 'veteran_instinct', hero: 'rourke', name: '老兵的直覺', costSp: 2, timing: false, targeting: 'none' },
  // 第 2 章同伴
  break_slash: { id: 'break_slash', hero: 'serin', name: '破陣斬', costSp: 2, timing: true, targeting: 'enemy' },
  guardian_oath: { id: 'guardian_oath', hero: 'serin', name: '守護誓言', costSp: 2, timing: false, targeting: 'self' },
  blast_art: { id: 'blast_art', hero: 'liora', name: '爆破術', costSp: 3, timing: true, targeting: 'allEnemies' },
  // 連攜技（03 §連攜技）：與連恩同時在場、消耗星燼
  lamp_slash: { id: 'lamp_slash', hero: 'serin', name: '連攜・燈下斬', costEmber: 4, timing: true, targeting: 'enemy', partner: 'lian' },
  lamp_detonator: { id: 'lamp_detonator', hero: 'liora', name: '連攜・燈火雷管', costEmber: 4, timing: true, targeting: 'allEnemies', partner: 'lian' },
  // 技能樹底部的主動技能（11-open-world §2.5 v2）
  thousand_lamps: { id: 'thousand_lamps', hero: 'lian', name: '千燈共鳴', costSp: 4, costEmber: 2, timing: true, targeting: 'allEnemies', tree: true },
  dawn_flash: { id: 'dawn_flash', hero: 'serin', name: '破曉一閃', costSp: 4, timing: true, targeting: 'enemy', tree: true },
  all_in: { id: 'all_in', hero: 'rourke', name: '梭哈', costSp: 3, timing: true, targeting: 'allEnemies', tree: true },
  star_lullaby: { id: 'star_lullaby', hero: 'io', name: '星之搖籃曲', costSp: 5, timing: true, targeting: 'allAllies', tree: true },
  chain_blast: { id: 'chain_blast', hero: 'liora', name: '連鎖大爆破', costSp: 5, timing: true, targeting: 'allEnemies', tree: true },
};

export function skillsFor(hero: HeroId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.hero === hero);
}

export const ITEMS = {
  potion_s: { id: 'potion_s', name: '小回復藥', healHp: 60 },
  potion_m: { id: 'potion_m', name: '回復藥', healHp: 160 },
  lamp_oil: { id: 'lamp_oil', name: '燈油', restoreSp: 2 },
  /** 莉歐拉的發明：對全體敵人造成火屬性固定傷害（弱點 ×1.5、抗性 ×0.5） */
  blast_bottle: { id: 'blast_bottle', name: '爆燈瓶', blastDmg: 45 },
} as const;
export type ItemId = keyof typeof ITEMS;
