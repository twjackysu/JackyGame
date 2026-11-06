// 第一期的舊存檔樣本（形狀照 src/game/rtRecord.ts 的 RtRecord）
const sword = { uid: 'g1', slot: 'weapon', rarity: 2, ilvl: 5, name: '霧鋼長劍', base: { atk: 20 }, affixes: [{ stat: 'atkPct', value: 4 }], enh: 7 };
const armor = { uid: 'g2', slot: 'body', rarity: 1, ilvl: 3, name: '皮甲', base: { hp: 30, def: 2 }, affixes: [] };
const ring = { uid: 'g3', slot: 'ring', rarity: 3, ilvl: 9, name: '燼心戒', base: { atk: 6 }, affixes: [{ stat: 'atk', value: 5 }], special: { skill: 'whirlwind', kind: 'dmg', value: 12 } };

export const LEGACY_SAMPLE: Record<string, string> = {
  jg_rt_mistwood: JSON.stringify({
    bossKills: 3, firstAt: 1761000000000, bestBossSec: 412, fire: 'mid', kills: 820, coin: 1500, dust: 260, crystal: 14, chests: ['c1', 'c3'], runs: 9, playSec: 7300,
    level: 12, xp: 345, bag: [armor, ring, { broken: true }], equip: { weapon: sword, head: ring }, fury: true, furyKills: 1, night: false,
    skills: { heavy_slash: 3, whirlwind: 5 }, variants: ['whirlwind'], bounty: { day: 3, done: [1] }, spent: { dust: 60, crystal: 4, coin: 700 }, shop: { seed: 9, sold: [0] },
  }),
  jg_rt_thornvale: JSON.stringify({ bossKills: 1, chests: ['t2'], fire: 'east', level: 99, kills: 5 }),
  jg_rt_emberrift: 'not json',
  jg_weapon: 'bow',
  jg_prologue_seen: '1',
  jg_memories: JSON.stringify(['m1', 'm2']),
  jg_choices: JSON.stringify({ a: 1 }),
  'jackygame.settings': JSON.stringify({ volume: 0.5 }),
};
