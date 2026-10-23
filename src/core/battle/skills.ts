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
};

export function skillsFor(hero: HeroId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.hero === hero);
}

export const ITEMS = {
  potion_s: { id: 'potion_s', name: '小回復藥', healHp: 60 },
  lamp_oil: { id: 'lamp_oil', name: '燈油', restoreSp: 2 },
} as const;
export type ItemId = keyof typeof ITEMS;
