// 即時戰鬥原型資料（D-063：劍士單人；技能暫用 design/20 §A6 四技能＋閃避；霧角狼王依 design/19 §2.9）。
// 數值是第一版基準，之後由模擬器（sim.ts）校準。
import { sec, u, type EnemyDefinition, type PlayerDefinition, type SkillDefinition, type StageDefinition } from './types';

export const SKILLS: Record<string, SkillDefinition> = {
  // 重斬：4s、施放 0.3s、前方扇形 2.0／90°、180%
  heavy_slash: {
    id: 'heavy_slash', name: '重斬', cooldownTicks: sec(4), castTicks: sec(0.3), moveFactor: 0, role: 'single', useRange: u(2),
    hits: [{ atTick: sec(0.3) - 1, shape: { type: 'sector', r: u(2), deg: 90 }, mult: 180 }],
  },
  // 旋風斬：8s、施放 0.9s、自身圓 R2.2、3×80%（每 0.3s），可邊轉邊走（70% 移速）
  whirlwind: {
    id: 'whirlwind', name: '旋風斬', cooldownTicks: sec(8), castTicks: sec(0.9), moveFactor: 0.7, role: 'aoe', useRange: u(2.2),
    hits: [0, 1, 2].map((k) => ({ atTick: sec(0.3) * (k + 1) - 1, shape: { type: 'circle' as const, r: u(2.2) }, mult: 80 })),
  },
  // 衝鋒：7s、施放 0.3s、直線 4／寬 1.2、140%、命中減速；同敵一次施放最多受傷一次
  charge: {
    id: 'charge', name: '衝鋒', cooldownTicks: sec(7), castTicks: sec(0.3), moveFactor: 0, role: 'gap', useRange: u(4.5),
    dash: { fromTick: 0, ticks: sec(0.3), distance: u(4) },
    hits: [0, 3, 6].map((t) => ({ atTick: t, shape: { type: 'circle' as const, r: u(1.0) }, mult: 140, oncePerTarget: true, status: { id: 'slow' as const, ticks: sec(1) } })),
  },
  // 格擋反擊：8s、施放 0.6s；窗口 0～12 ticks（D-065 放寬） 被可格擋攻擊命中 → 傷害 −80% 並立即反擊 220%（前扇形 2）
  parry: {
    id: 'parry', name: '格擋反擊', cooldownTicks: sec(8), castTicks: sec(0.6), moveFactor: 0, role: 'block',
    hits: [],
    block: { windowTicks: 12, reducePct: 80, counter: { atTick: 0, shape: { type: 'sector', r: u(2), deg: 120 }, mult: 220 } },
  },
  // 劍刃風暴（大招，design/20 A2）：45s、施放 2.4s、自身圓 R3、8×75%＋最後一擊 200%（總 800%）、40 MP；可邊轉邊走（50%）
  // 原型先做資料與模擬（NEXT 第 3 項），試玩鍵位還沒放
  blade_storm: {
    id: 'blade_storm', name: '劍刃風暴', cooldownTicks: sec(45), castTicks: sec(2.4), moveFactor: 0.5, role: 'ult', useRange: u(3), mp: 40,
    hits: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ atTick: 8 * (k + 1) - 1, shape: { type: 'circle' as const, r: u(3) }, mult: 75 })),
      { atTick: sec(2.4) - 1, shape: { type: 'circle' as const, r: u(3) }, mult: 200 },
    ],
  },
};

export const SWORDSMAN: PlayerDefinition = {
  id: 'swordsman',
  hp: 620,
  atk: 34,
  def: 20,
  speed: 3.5,
  radius: u(0.4),
  attackIntervalTicks: sec(0.8),
  attackRange: u(1.5),
  attackWindupTicks: sec(0.2),
  attackRecoverTicks: sec(0.6) - 1,
  critRate: 5,
  critDmg: 150,
  mp: 100,
  mpStart: 0,
  // 造成直接傷害 +1（持續傷害不算）、受到傷害 +2、格擋成功 +5（D-065 ②；第 13 輪初值，見 D-068）
  mpGain: { deal: 1, hurt: 2, block: 5 },
  potion: { healPct: 30, cooldownTicks: sec(15), carry: 20 },
  skills: ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'],
  // 閃避：位移 2.5、動作 9 ticks、無敵 1～6、冷卻 5s
  dodge: { distance: u(2.5), ticks: 9, invulnFrom: 1, invulnTo: 6, cooldownTicks: sec(5) },
};

export const ENEMIES: Record<string, EnemyDefinition> = {
  wolf: {
    id: 'wolf', name: '野狼', hp: 280, atk: 26, def: 6, speed: 3.2, radius: u(0.4), hitstunTicks: 4,
    drops: { gold: [3, 6], items: [{ id: 'dust', chance: 30 }] },
    attacks: [
      { id: 'wolf_bite', shape: { type: 'sector', r: u(1.5), deg: 80 }, warningTicks: sec(0.7), recoverTicks: sec(0.5), damageMultiplier: 100, cooldownTicks: sec(2.2), triggerRange: u(1.3), blockable: true, weight: 1 },
    ],
  },
  // 狼王召喚的小狼（比野狼脆）
  wolf_pup: {
    id: 'wolf_pup', name: '小狼', hp: 120, atk: 20, def: 4, speed: 3.4, radius: u(0.35), hitstunTicks: 5,
    drops: { gold: [1, 3], items: [{ id: 'dust', chance: 10 }] },
    attacks: [
      { id: 'pup_bite', shape: { type: 'sector', r: u(1.3), deg: 80 }, warningTicks: sec(0.7), recoverTicks: sec(0.5), damageMultiplier: 100, cooldownTicks: sec(2.4), triggerRange: u(1.1), blockable: true, weight: 1 },
    ],
  },
  // 遠程：保持距離、直線毒刺（紫＝附負面狀態；可格擋）
  thorn_shooter: {
    id: 'thorn_shooter', name: '荊棘射手', hp: 200, atk: 24, def: 4, speed: 2.8, radius: u(0.4), hitstunTicks: 5,
    drops: { gold: [4, 8], items: [{ id: 'dust', chance: 40 }, { id: 'potion', chance: 12 }] },
    attacks: [
      { id: 'thorn_shot', shape: { type: 'line', len: u(7), width: u(0.8) }, warningTicks: sec(0.8), recoverTicks: sec(0.6), damageMultiplier: 90, cooldownTicks: sec(3), triggerRange: u(6), blockable: true, status: { id: 'poison', ticks: sec(8), powerPct: 10 }, weight: 1 },
    ],
  },
  // 精英：撕咬＋短衝鋒
  alpha_wolf: {
    id: 'alpha_wolf', name: '狼群首領', hp: 1000, atk: 32, def: 10, speed: 3.6, radius: u(0.55), hitstunTicks: 2,
    drops: { gold: [20, 30], items: [{ id: 'dust', chance: 100, count: [2, 3] }, { id: 'crystal', chance: 25 }, { id: 'potion', chance: 50 }] },
    attacks: [
      { id: 'alpha_bite', shape: { type: 'sector', r: u(1.8), deg: 90 }, warningTicks: sec(0.7), recoverTicks: sec(0.4), damageMultiplier: 110, cooldownTicks: sec(2.4), triggerRange: u(1.5), blockable: true, weight: 3 },
      { id: 'alpha_charge', shape: { type: 'line', len: u(4.5), width: u(1.2) }, warningTicks: sec(0.8), recoverTicks: sec(0.5), damageMultiplier: 140, cooldownTicks: sec(8), triggerRange: u(4.5), blockable: true, charge: { ticks: sec(0.35), wallStunTicks: sec(1.5) }, weight: 1 },
    ],
  },
  wolf_king: {
    id: 'wolf_king', name: '霧角狼王', hp: 4200, atk: 31, def: 12, speed: 3.0, radius: u(0.9), hitstunTicks: 0,
    drops: { gold: [80, 120], items: [{ id: 'dust', chance: 100, count: [4, 6] }, { id: 'crystal', chance: 100 }] },
    attacks: [
      // P1：爪擊（小扇形、快）、扇形撕咬、直線衝鋒；P2 加環形震波
      { id: 'king_claw', shape: { type: 'sector', r: u(2.2), deg: 70 }, warningTicks: sec(0.7), recoverTicks: sec(0.4), damageMultiplier: 110, cooldownTicks: sec(3.2), triggerRange: u(2.0), blockable: true, weight: 3 },
      { id: 'king_bite', shape: { type: 'sector', r: u(3.2), deg: 110 }, warningTicks: sec(1.0), recoverTicks: sec(0.6), damageMultiplier: 170, cooldownTicks: sec(6), triggerRange: u(3.0), blockable: true, weight: 2 },
      { id: 'king_charge', shape: { type: 'line', len: u(7), width: u(1.6) }, warningTicks: sec(0.9), recoverTicks: sec(0.5), damageMultiplier: 160, cooldownTicks: sec(9), triggerRange: u(7), blockable: true, charge: { ticks: sec(0.5), wallStunTicks: sec(2) }, weight: 2 },
      { id: 'king_quake', shape: { type: 'ring', rIn: u(2.0), rOut: u(4.5) }, warningTicks: sec(1.2), recoverTicks: sec(0.6), damageMultiplier: 150, cooldownTicks: sec(10), triggerRange: u(4), blockable: false, phase2Only: true, weight: 2 },
    ],
    boss: { phase2AtPct: 50, phase2CooldownPct: 87, summon: { enemyId: 'wolf_pup', count: 2, everyTicks: sec(12) } },
  },
};

export const STAGES: Record<string, StageDefinition> = {
  forest_entry: {
    id: 'forest_entry', name: '森林入口', arena: { w: u(14), h: u(18) }, player: { x: u(7), y: u(15) }, timeLimitTicks: sec(180),
    enemies: [{ enemyId: 'wolf', x: u(5), y: u(5) }, { enemyId: 'wolf', x: u(7), y: u(4) }, { enemyId: 'wolf', x: u(9), y: u(5) }],
  },
  wolf_den: {
    id: 'wolf_den', name: '狼群巢穴', arena: { w: u(16), h: u(20) }, player: { x: u(8), y: u(17) }, timeLimitTicks: sec(240),
    enemies: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ enemyId: 'wolf', x: u(3 + (k % 4) * 3.3), y: u(4 + Math.floor(k / 4) * 2.5) })),
  },
  forest_deep: {
    id: 'forest_deep', name: '森林深處', arena: { w: u(16), h: u(22) }, player: { x: u(8), y: u(19) }, timeLimitTicks: sec(240),
    enemies: [
      { enemyId: 'wolf', x: u(5), y: u(9) }, { enemyId: 'wolf', x: u(11), y: u(9) }, { enemyId: 'wolf', x: u(6), y: u(6) }, { enemyId: 'wolf', x: u(10), y: u(6) },
      { enemyId: 'thorn_shooter', x: u(4), y: u(3) }, { enemyId: 'thorn_shooter', x: u(12), y: u(3) },
    ],
  },
  elite_pack: {
    id: 'elite_pack', name: '精英狼群', arena: { w: u(16), h: u(20) }, player: { x: u(8), y: u(17) }, timeLimitTicks: sec(240),
    enemies: [
      { enemyId: 'alpha_wolf', x: u(6), y: u(5) }, { enemyId: 'alpha_wolf', x: u(10), y: u(5) },
      { enemyId: 'wolf', x: u(4), y: u(8) }, { enemyId: 'wolf', x: u(8), y: u(8) }, { enemyId: 'wolf', x: u(12), y: u(8) },
    ],
  },
  wolf_king: {
    id: 'wolf_king', name: '霧角狼王', arena: { w: u(16), h: u(20) }, player: { x: u(8), y: u(16) }, timeLimitTicks: sec(300),
    enemies: [{ enemyId: 'wolf_king', x: u(8), y: u(6) }],
  },
  // D-071／D-072：有石頭的試玩關（尋路、視線、隔石衝鋒、地圖怪待機與脫戰）；遠程隔著石頭不能射擊，狼會繞過石頭
  rock_grove: {
    id: 'rock_grove', name: '碎石林道', timeLimitTicks: sec(240), player: { x: u(8), y: u(19.5) },
    mapAi: true, // D-072：怪物待機，走近（看得到）才醒；追太遠會回家回滿
    arena: { w: u(16), h: u(22), solid: { cell: u(1), rows: [
      '................',
      '................',
      '...##......##...',
      '...##......##...',
      '................',
      '......####......',
      '................',
      '..#..........#..',
      '..#...####...#..',
      '..#..........#..',
      '................',
      '................',
      '.....#....#.....',
      '.....#....#.....',
      '................',
      '..###......###..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ] } },
    enemies: [
      // 三組狼（每組兩隻，同伴會連鎖醒來）＋精英＋兩隻躲在石頭後的射手
      { enemyId: 'wolf', x: u(4.5), y: u(11) }, { enemyId: 'wolf', x: u(5.5), y: u(11.8) },
      { enemyId: 'wolf', x: u(11.5), y: u(11) }, { enemyId: 'wolf', x: u(10.5), y: u(11.8) },
      { enemyId: 'wolf', x: u(7.5), y: u(6.5) }, { enemyId: 'wolf', x: u(8.5), y: u(6.5) },
      { enemyId: 'thorn_shooter', x: u(4), y: u(1.5) }, { enemyId: 'thorn_shooter', x: u(12), y: u(1.5) },
      { enemyId: 'alpha_wolf', x: u(8), y: u(9.5), tier: 'elite' },
    ],
  },
  // 第七關（第 15 輪）：重生點＋營火的試玩——怪會重生、打不過就退回營火（怪不追進來），倒下在營火醒來；5 分鐘看能刷多少
  camp_clearing: {
    id: 'camp_clearing', name: '營火空地', timeLimitTicks: sec(300), player: { x: u(9), y: u(28.2) },
    mapAi: true, reviveAtCampfire: true, loot: true, enemies: [],
    campfires: [{ id: 'camp', x: u(9), y: u(25.8) }],
    arena: { w: u(18), h: u(30), solid: { cell: u(1), rows: [
      '..................',
      '..................',
      '....##......##....',
      '..................',
      '..................',
      '.......####.......',
      '..................',
      '..................',
      '..##..........##..',
      '..##..........##..',
      '..................',
      '..................',
      '.......#..#.......',
      '..................',
      '..................',
      '....##......##....',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
    ] } },
    spawnGroups: [
      { id: 'west', enemyId: 'wolf', cx: u(4), cy: u(18), spawnRadius: u(1.2), maxAlive: 2, respawnTicks: sec(20) },
      { id: 'east', enemyId: 'wolf', cx: u(14), cy: u(17), spawnRadius: u(1.2), maxAlive: 2, respawnTicks: sec(20) },
      { id: 'mid', enemyId: 'wolf_pup', cx: u(9), cy: u(10), spawnRadius: u(1.5), maxAlive: 3, respawnTicks: sec(25) },
      { id: 'shooter', enemyId: 'thorn_shooter', cx: u(9), cy: u(3.5), spawnRadius: u(1), maxAlive: 1, respawnTicks: sec(30) },
      { id: 'alpha', enemyId: 'alpha_wolf', cx: u(15.5), cy: u(5), spawnRadius: u(0.5), maxAlive: 1, respawnTicks: sec(90), tier: 'elite' },
    ],
  },
};
