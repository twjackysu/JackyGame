// 掉落表（11-open-world §2.4b、D-049）。以「敵人 id」為鍵：每隻被擊倒的敵人各擲一次。
// Boss：首殺必掉 `firstKill` 那件稀有；之後每次擊敗仍有 `pool` 的機率。
import { mulberry32 } from '../core/rng';

export interface DropEntry {
  item: string;
  /** 0–1 */
  chance: number;
}
export interface DropDef {
  pool: readonly DropEntry[];
  /** Boss 首殺必掉 */
  firstKill?: string;
}

export const DROPS: Record<string, DropDef> = {
  // 第 1 章
  mist_wolf: { pool: [{ item: 'wolf_fang_charm', chance: 0.04 }, { item: 'moon_fang', chance: 0.006 }] },
  thorn_shroom: { pool: [{ item: 'shroom_cloak', chance: 0.05 }] },
  umbra_boar: { pool: [{ item: 'shroom_cloak', chance: 0.1 }, { item: 'wolf_fang_charm', chance: 0.05 }] },
  boss_wolfking: { firstKill: 'wolfking_pelt', pool: [{ item: 'moon_fang', chance: 0.08 }, { item: 'wolf_fang_charm', chance: 0.25 }] },
  // 第 2 章
  lamp_wraith: { pool: [{ item: 'wraith_lamp', chance: 0.04 }, { item: 'bellsong_mail', chance: 0.006 }] },
  rock_beetle: { pool: [{ item: 'beetle_guard', chance: 0.04 }] },
  blast_lizard: { pool: [{ item: 'bell_chime', chance: 0.03 }] },
  boss_bellworm: { firstKill: 'bell_chime', pool: [{ item: 'bellsong_mail', chance: 0.08 }, { item: 'wraith_lamp', chance: 0.2 }] },
  // 第 3 章
  rune_hound: { pool: [{ item: 'rune_collar', chance: 0.04 }] },
  academy_guard: { pool: [{ item: 'guard_halberd', chance: 0.04 }] },
  alley_thug: { pool: [{ item: 'rune_collar', chance: 0.03 }, { item: 'veteran_crest', chance: 0.008 }] },
  sewer_rat: { pool: [{ item: 'rourke_scarf', chance: 0.02 }] },
  boss_rourke_3: { firstKill: 'rourke_scarf', pool: [{ item: 'veteran_crest', chance: 0.08 }] },
  // 第 4 章
  proto_weapon: { pool: [{ item: 'proto_staff', chance: 0.04 }] },
  star_golem: { pool: [{ item: 'golem_plate', chance: 0.04 }, { item: 'star_lens', chance: 0.008 }] },
  boss_valderan: { firstKill: 'scholar_robe', pool: [{ item: 'star_lens', chance: 0.08 }] },
  // 終章
  rift_spawn: { pool: [{ item: 'rift_blade', chance: 0.04 }, { item: 'star_ring', chance: 0.03 }, { item: 'first_lamp', chance: 0.01 }] },
  boss_starfall: { firstKill: 'starfall_halberd', pool: [{ item: 'first_lamp', chance: 0.1 }] },
};

/** Boss 首殺旗標 */
export const firstKillFlag = (enemyId: string): string => `kill_${enemyId}`;

/**
 * 擲骰。enemies：本場被擊倒的敵人 id（重複代表多隻）；killed：已經首殺過的 Boss（旗標）。
 * 每隻敵人最多掉 1 件（先擲稀有度高的）。回傳掉落的物品 id（可能重複）。
 */
export function rollDrops(enemies: readonly string[], seed: number, killed: (enemyId: string) => boolean = () => false): string[] {
  const r = mulberry32(seed >>> 0);
  const out: string[] = [];
  const firstSeen = new Set<string>();
  for (const id of enemies) {
    const def = DROPS[id];
    if (!def) continue;
    if (def.firstKill && !killed(id) && !firstSeen.has(id)) {
      firstSeen.add(id);
      out.push(def.firstKill);
    }
    const pool = [...def.pool].sort((a, b) => a.chance - b.chance);
    for (const e of pool) {
      if (r() < e.chance) {
        out.push(e.item);
        break;
      }
    }
  }
  return out;
}
