// 無頭平衡模擬：簡單策略 AI + 機率化時機輸入（03 §7.4）。
import { ENCOUNTERS, ENEMIES } from '../../data/combatants';
import { mulberry32, type Rng } from '../rng';
import {
  availableCommands,
  chooseCommand,
  createBattle,
  currentHero,
  resolveDefense,
  resolveTiming,
  totalLamps,
  type BattleState,
  type Command,
  type CreateBattleOptions,
} from './engine';
import type { DefenseResult, Timing } from './formulas';

export interface SimSkill {
  attack: { perfect: number; good: number };
  defense: number; // 防守成功率（其中約一半為完美）
}

export interface SimResult {
  won: boolean;
  /** 戰後各角色 HP%（倒地 0） */
  hpPct?: number[];
  rounds: number;
  hpLostPct: number;
}

export const MAX_SIM_ROUNDS = 40;

function rollTiming(rng: Rng, sk: SimSkill): Timing {
  const r = rng();
  if (r < sk.attack.perfect) return 'perfect';
  if (r < sk.attack.perfect + sk.attack.good) return 'good';
  return 'miss';
}

function rollDefense(rng: Rng, s: BattleState, sk: SimSkill): DefenseResult[] {
  const p = s.pendingEnemy!;
  let chance = sk.defense * (s.windowScale < 1 ? 0.8 : 1) + (s.telegraphLeadBonusMs > 0 ? 0.05 : 0);
  chance = Math.min(0.98, chance);
  return p.hits.map(() => {
    const r = rng();
    if (r < chance * 0.5 && p.attack.telegraph !== 'purple') return 'perfect';
    if (r < chance) return 'success';
    return 'fail';
  });
}

function pickTarget(s: BattleState, elem: string): number {
  const alive = s.enemies.map((e, i) => ({ e, i })).filter((x) => !x.e.downed && x.e.hp > 0);
  const weak = alive.filter((x) => x.e.weak.includes(elem as never));
  const pool = weak.length ? weak : alive;
  pool.sort((a, b) => a.e.hp - b.e.hp);
  return pool[0]?.i ?? 0;
}

let cleansePolicy = true;

function policy(s: BattleState): Command {
  const hero = currentHero(s)!;
  const usable = new Set(availableCommands(s).filter((c) => c.usable).map((c) => c.skillId ?? c.type));
  const isBoss = s.enemies.some((e) => (ENEMIES[e.id]?.actionsPerRound ?? 1) > 1 && e.hp > 0);
  const biggest = s.enemies
    .map((e, i) => ({ e, i }))
    .filter((x) => x.e.hp > 0)
    .sort((a, b) => b.e.hp - a.e.hp)[0];
  // 反燈印：快引爆時優先淨化
  const doomed = cleansePolicy && s.heroes.some((h) => !h.downed && h.status.doomMark > 0 && h.status.doomMark <= 2);
  if (doomed && hero.id === 'lian' && usable.has('guiding_light')) return { type: 'skill', skillId: 'guiding_light' };
  if (doomed && hero.id === 'io' && usable.has('glimmer_song')) return { type: 'skill', skillId: 'glimmer_song' };
  const living0 = s.enemies.filter((e) => e.hp > 0).length;
  // 技能樹奧義（有學才會 usable）
  if (hero.id === 'io' && usable.has('star_lullaby') && (s.heroes.some((h) => h.downed) || s.heroes.filter((h) => h.hp / h.maxHp < 0.5).length >= 2)) return { type: 'skill', skillId: 'star_lullaby' };
  if (hero.id === 'lian' && usable.has('thousand_lamps') && totalLamps(s) <= 2 && (isBoss || living0 >= 2)) return { type: 'skill', skillId: 'thousand_lamps' };
  if (hero.id === 'serin' && usable.has('dawn_flash') && biggest && biggest.e.hp > 200) return { type: 'skill', skillId: 'dawn_flash', target: biggest.i };
  if (hero.id === 'rourke' && usable.has('all_in') && living0 >= 2 && hero.hp / hero.maxHp > 0.4) return { type: 'skill', skillId: 'all_in' };
  if (hero.id === 'liora' && usable.has('chain_blast') && living0 >= 2) return { type: 'skill', skillId: 'chain_blast' };
  if (hero.id === 'lian') {
    const lamps = totalLamps(s);
    if (lamps >= 4 && usable.has('resonance')) return { type: 'skill', skillId: 'resonance' };
    if (lamps < 4 && usable.has('lamp_mark') && biggest && biggest.e.hp > 100) {
      return { type: 'skill', skillId: 'lamp_mark', target: biggest.i };
    }
    if (lamps >= 3 && s.ember >= 3 && usable.has('resonance') && !usable.has('lamp_mark')) {
      return { type: 'skill', skillId: 'resonance' };
    }
  }
  if (hero.id === 'io' && usable.has('glimmer_song')) {
    if (s.heroes.some((h) => h.downed || h.hp / h.maxHp < 0.45)) return { type: 'skill', skillId: 'glimmer_song' };
  }
  if (hero.id === 'rourke' && isBoss && s.round === 1 && usable.has('taunt')) return { type: 'skill', skillId: 'taunt' };
  const living = s.enemies.filter((e) => e.hp > 0).length;
  if (hero.id === 'liora') {
    if (usable.has('lamp_detonator') && s.ember >= 7) return { type: 'skill', skillId: 'lamp_detonator' };
    if (usable.has('blast_art') && living >= 2) return { type: 'skill', skillId: 'blast_art' };
  }
  if (hero.id === 'serin' && biggest) {
    if (usable.has('lamp_slash') && s.ember >= 7) return { type: 'skill', skillId: 'lamp_slash', target: biggest.i };
    if (usable.has('break_slash') && biggest.e.hp > 150) return { type: 'skill', skillId: 'break_slash', target: biggest.i };
  }
  return { type: 'attack', target: pickTarget(s, hero.element) };
}

export function simulateBattle(
  party: CreateBattleOptions['party'],
  encounterId: string,
  skill: SimSkill,
  seed: number,
  opts: { guidingLight?: boolean; cleanse?: boolean } = {},
): SimResult {
  const enemies = ENCOUNTERS[encounterId];
  if (!enemies) throw new Error(`unknown encounter ${encounterId}`);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let s = createBattle({ party, enemies, seed, flags: { guidingLight: opts.guidingLight } }).state;
  cleansePolicy = opts.cleanse ?? true;
  let steps = 0;
  while (s.phase !== 'victory' && s.phase !== 'defeat' && s.round <= MAX_SIM_ROUNDS && steps++ < 5000) {
    if (s.phase === 'playerCommand') s = chooseCommand(s, policy(s)).state;
    else if (s.phase === 'playerTiming') s = resolveTiming(s, rollTiming(rng, skill)).state;
    else if (s.phase === 'enemyTelegraph') s = resolveDefense(s, rollDefense(rng, s, skill)).state;
  }
  const maxHp = s.heroes.reduce((a, h) => a + h.maxHp, 0);
  const hp = s.heroes.reduce((a, h) => a + (h.downed ? 0 : h.hp), 0);
  return {
    won: s.phase === 'victory', rounds: s.round, hpLostPct: (maxHp - hp) / maxHp,
    hpPct: s.heroes.map((h) => (h.downed ? 0 : h.hp / h.maxHp)),
  };
}
