// 即時戰鬥原型資料（D-063：劍士單人；技能暫用 design/20 §A6 四技能＋閃避；霧角狼王依 design/19 §2.9）。
// 數值是第一版基準，之後由模擬器（sim.ts）校準。
import { sec, u, type AreaAttack, type EliteAffix, type EnemyDefinition, type PlayerDefinition, type SkillDefinition, type StageDefinition } from './types';

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

/**
 * 技能變化（D-112）：技能點滿 5 級後可以切換成這個版本。id 跟原技能相同（冷卻、按鈕、技能點與裝備特效都共用），
 * 只是招式本身不一樣——同一顆按鈕換一種打法。
 */
export const SKILL_VARIANTS: Record<string, SkillDefinition & { variantName: string; desc: string }> = {
  // 裂地斬：前方直線 4.5／寬 1.0、240%、穿透整排；施放 0.45s、冷卻 5s
  heavy_slash: {
    id: 'heavy_slash', name: '裂地斬', variantName: '裂地斬', desc: '往前劈出 4.5 格直線劍氣，整排穿透 240%；冷卻 5 秒',
    cooldownTicks: sec(5), castTicks: sec(0.45), moveFactor: 0, role: 'single', useRange: u(4),
    hits: [{ atTick: sec(0.45) - 1, shape: { type: 'line', len: u(4.5), width: u(1.0) }, mult: 240 }],
  },
  // 龍捲：1.8s 內 6×55%（範圍 1.8），施放中可以全速移動；冷卻 9s
  whirlwind: {
    id: 'whirlwind', name: '龍捲', variantName: '龍捲', desc: '轉 1.8 秒共 6 段（每段 55%），轉的時候能全速移動；冷卻 9 秒',
    cooldownTicks: sec(9), castTicks: sec(1.8), moveFactor: 1.0, role: 'aoe', useRange: u(1.8),
    hits: [0, 1, 2, 3, 4, 5].map((k) => ({ atTick: sec(0.3) * (k + 1) - 1, shape: { type: 'circle' as const, r: u(1.8) }, mult: 55 })),
  },
  // 流星衝：衝 6 格、路上 120%＋減速，衝到底再爆一圈 90%；冷卻 8s
  charge: {
    id: 'charge', name: '流星衝', variantName: '流星衝', desc: '衝 6 格、路上 120%＋減速，落地再爆一圈 90%；冷卻 8 秒',
    cooldownTicks: sec(8), castTicks: sec(0.5), moveFactor: 0, role: 'gap', useRange: u(6.5),
    dash: { fromTick: 0, ticks: sec(0.4), distance: u(6) },
    hits: [
      ...[0, 4, 8].map((t) => ({ atTick: t, shape: { type: 'circle' as const, r: u(1.1) }, mult: 120, oncePerTarget: true, status: { id: 'slow' as const, ticks: sec(1.5) } })),
      { atTick: sec(0.4) + 2, shape: { type: 'circle' as const, r: u(1.8) }, mult: 90 },
    ],
  },
  // 不動架勢：窗口 0.8s、完全不受傷，反擊改成全方位 180%；冷卻 10s
  parry: {
    id: 'parry', name: '不動架勢', variantName: '不動架勢', desc: '格擋窗口 0.8 秒、擋下完全不受傷，四面反擊 180%；冷卻 10 秒',
    cooldownTicks: sec(10), castTicks: sec(1.0), moveFactor: 0, role: 'block',
    hits: [],
    block: { windowTicks: 24, reducePct: 100, counter: { atTick: 0, shape: { type: 'circle', r: u(2.6) }, mult: 180 } },
  },
  // 星落一閃：0.9s 蓄力、一擊 760%（範圍 3.6）；不能移動
  blade_storm: {
    id: 'blade_storm', name: '星落一閃', variantName: '星落一閃', desc: '蓄力 0.9 秒一擊 760%（範圍 3.6 格），站著不能動',
    cooldownTicks: sec(45), castTicks: sec(0.9), moveFactor: 0, role: 'ult', useRange: u(3.4), mp: 40,
    hits: [{ atTick: sec(0.9) - 1, shape: { type: 'circle', r: u(3.6) }, mult: 760 }],
  },
};

/**
 * 技能第二種變化（D-121，第 25 輪）：滿 5 級後「原招 → 變化 → 變化二 → 原招」輪流切換。
 * 存檔／BattleState 裡寫成 `${id}:b`（和第一種變化的 `${id}` 互斥），沒選的人結果完全不變。
 */
export const SKILL_VARIANTS_B: Record<string, SkillDefinition & { variantName: string; desc: string }> = {
  // 碎甲斬：前方扇形 190%＋破甲 6 秒（之後受到的傷害更容易爆擊）；冷卻 6s
  heavy_slash: {
    id: 'heavy_slash', name: '碎甲斬', variantName: '碎甲斬', desc: '前方大扇形 190%，打中的敵人「破甲」6 秒（更容易被爆擊）；冷卻 6 秒',
    cooldownTicks: sec(6), castTicks: sec(0.5), moveFactor: 0, role: 'single', useRange: u(1.8),
    hits: [{ atTick: sec(0.5) - 1, shape: { type: 'sector', r: u(2.1), deg: 130 }, mult: 190, status: { id: 'break', ticks: sec(6) } }],
  },
  // 霜旋：一圈寒氣 140%＋冰凍 1.5 秒（Boss 改成減速）；冷卻 11s
  whirlwind: {
    id: 'whirlwind', name: '霜旋', variantName: '霜旋', desc: '轉一圈寒氣（範圍 2.6）140%，小怪冰凍 1.5 秒、Boss 減速；冷卻 11 秒',
    cooldownTicks: sec(11), castTicks: sec(0.6), moveFactor: 0, role: 'aoe', useRange: u(2.4),
    hits: [{ atTick: sec(0.6) - 1, shape: { type: 'circle', r: u(2.6) }, mult: 140, status: { id: 'freeze', ticks: sec(1.5) } }],
  },
  // 影步：短衝 3 格、路上 150%＋虛弱 4 秒（敵人傷害 −20%）；冷卻 4s
  charge: {
    id: 'charge', name: '影步', variantName: '影步', desc: '快速短衝 3 格、路上 150%，打中的敵人「虛弱」4 秒（傷害 −20%）；冷卻 4 秒',
    cooldownTicks: sec(4), castTicks: sec(0.3), moveFactor: 0, role: 'gap', useRange: u(3.5),
    dash: { fromTick: 0, ticks: sec(0.2), distance: u(3) },
    hits: [0, 3].map((t) => ({ atTick: t, shape: { type: 'circle' as const, r: u(1.0) }, mult: 150, oncePerTarget: true, status: { id: 'weak' as const, ticks: sec(4) } })),
  },
  // 迴光一閃：窗口只有 0.3 秒、完全不受傷，反擊一道 6 格直線 420%；冷卻 7s
  parry: {
    id: 'parry', name: '迴光一閃', variantName: '迴光一閃', desc: '格擋窗口只有 0.3 秒（看準再按）、擋下完全不受傷，反擊 6 格直線 420%；冷卻 7 秒',
    cooldownTicks: sec(7), castTicks: sec(0.6), moveFactor: 0, role: 'block',
    hits: [],
    block: { windowTicks: 9, reducePct: 100, counter: { atTick: 0, shape: { type: 'line', len: u(6), width: u(1.2) }, mult: 420 } },
  },
  // 破空斬月：0.7s 蓄力、前方 8 格長劍氣 720%＋破甲 8 秒（第 26 輪：蓄力前 0.5 秒自動對準目標）
  blade_storm: {
    id: 'blade_storm', name: '破空斬月', variantName: '破空斬月', desc: '蓄力 0.7 秒（前 0.5 秒自動對準目標），前方 8 格劍氣 720%＋破甲 8 秒',
    cooldownTicks: sec(45), castTicks: sec(0.7), moveFactor: 0, role: 'ult', useRange: u(4), mp: 40, aimTicks: sec(0.5), // 蓄力前 0.5 秒跟著目標轉（第 26 輪），最後 0.2 秒鎖定
    hits: [{ atTick: sec(0.7) - 1, shape: { type: 'line', len: u(8), width: u(1.8) }, mult: 720, status: { id: 'break', ticks: sec(8) } }],
  },
};

/** 第二種變化在存檔裡的寫法 */
export const variantB = (id: string): string => `${id}:b`;

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

/**
 * 精英詞綴專屬招式（D-118）：有詞綴的精英在原本的招式之外多一招，看招就知道是哪種詞綴。
 * 迅捷＝短距離突進（可格擋）、堅韌＝原地震地（不能格擋、命中緩速）、狂亂＝兩段連咬（可格擋，第二口重新瞄準）。
 */
export const AFFIX_ATTACKS: Record<EliteAffix, readonly AreaAttack[]> = {
  swift: [
    { id: 'affix_dash', label: '疾影突進', shape: { type: 'line', len: u(4.5), width: u(1.0) }, warningTicks: sec(0.55), recoverTicks: sec(0.4), damageMultiplier: 100, cooldownTicks: sec(6), triggerRange: u(4.5), blockable: true, charge: { ticks: sec(0.25), wallStunTicks: sec(1.2) }, weight: 2 },
  ],
  tough: [
    { id: 'affix_quake', label: '大地震擊', shape: { type: 'circle', r: u(2.4) }, warningTicks: sec(1.1), recoverTicks: sec(0.8), damageMultiplier: 150, cooldownTicks: sec(9), triggerRange: u(2.0), blockable: false, status: { id: 'slow', ticks: sec(2) }, weight: 2 },
  ],
  frenzy: [
    { id: 'affix_rend', label: '狂亂連咬', shape: { type: 'sector', r: u(1.7), deg: 90 }, warningTicks: sec(0.5), recoverTicks: sec(0.15), damageMultiplier: 80, cooldownTicks: sec(7), triggerRange: u(1.5), blockable: true, weight: 2, followUp: 'affix_rend2', followAlways: true },
    { id: 'affix_rend2', shape: { type: 'sector', r: u(1.8), deg: 100 }, warningTicks: sec(0.35), recoverTicks: sec(0.5), damageMultiplier: 90, cooldownTicks: 0, triggerRange: u(1.8), blockable: true, weight: 0 },
  ],
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
  // 霧影狼（D-104）：只在深夜出現的精英；比首領快、咬得更兇，掉落必有結晶
  shade_wolf: {
    id: 'shade_wolf', name: '霧影狼', hp: 1300, atk: 34, def: 11, speed: 4.0, radius: u(0.6), hitstunTicks: 2,
    drops: { gold: [40, 60], items: [{ id: 'dust', chance: 100, count: [3, 5] }, { id: 'crystal', chance: 100 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'shade_bite', shape: { type: 'sector', r: u(1.9), deg: 100 }, warningTicks: sec(0.6), recoverTicks: sec(0.35), damageMultiplier: 115, cooldownTicks: sec(2.0), triggerRange: u(1.6), blockable: true, weight: 3 },
      { id: 'shade_charge', shape: { type: 'line', len: u(5.5), width: u(1.3) }, warningTicks: sec(0.7), recoverTicks: sec(0.5), damageMultiplier: 140, cooldownTicks: sec(6), triggerRange: u(5.5), blockable: true, charge: { ticks: sec(0.35), wallStunTicks: sec(1.5) }, weight: 2 },
    ],
  },
  // 迷霧巡守（D-120）：霧語森林白天就在精英狼群區西側巡邏的世界精英（守著西北角寶箱）；
  // 撕咬、短衝、「霧隱突襲」（霧中消失、從背後撲出來；可以格擋，聽到聲音就轉身）
  mist_warden: {
    id: 'mist_warden', name: '迷霧巡守', hp: 1050, atk: 26, def: 10, speed: 3.6, radius: u(0.58), hitstunTicks: 2,
    drops: { gold: [30, 50], items: [{ id: 'dust', chance: 100, count: [2, 4] }, { id: 'crystal', chance: 50 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'warden_bite', shape: { type: 'sector', r: u(1.8), deg: 100 }, warningTicks: sec(0.65), recoverTicks: sec(0.4), damageMultiplier: 110, cooldownTicks: sec(2.2), triggerRange: u(1.5), blockable: true, weight: 3 },
      { id: 'warden_dash', shape: { type: 'line', len: u(5), width: u(1.2) }, warningTicks: sec(0.75), recoverTicks: sec(0.5), damageMultiplier: 130, cooldownTicks: sec(7), triggerRange: u(5), blockable: true, charge: { ticks: sec(0.35), wallStunTicks: sec(1.5) }, weight: 2 },
      { id: 'warden_ambush', shape: { type: 'sector', r: u(2.3), deg: 120 }, warningTicks: sec(0.95), recoverTicks: sec(0.7), damageMultiplier: 130, cooldownTicks: sec(12), triggerRange: u(5), blockable: true, blink: { behind: u(2.0) }, weight: 2 },
    ],
  },
  // 荊棘母樹（D-107）：不會動的世界精英；遠處直線毒刺、貼身大扇形橫掃、中距離根系環（環內貼著樹是安全的）
  thorn_mother: {
    id: 'thorn_mother', name: '荊棘母樹', hp: 4200, atk: 34, def: 10, speed: 0, radius: u(1.0), hitstunTicks: 0,
    drops: { gold: [60, 90], items: [{ id: 'dust', chance: 100, count: [4, 6] }, { id: 'crystal', chance: 100 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'mother_lance', shape: { type: 'line', len: u(8), width: u(1.0) }, warningTicks: sec(0.8), recoverTicks: sec(0.5), damageMultiplier: 120, cooldownTicks: sec(3.5), triggerRange: u(8), blockable: true, status: { id: 'poison', ticks: sec(6), powerPct: 10 }, weight: 3 },
      { id: 'mother_roots', shape: { type: 'ring', rIn: u(1.9), rOut: u(4.4) }, warningTicks: sec(1.1), recoverTicks: sec(0.6), damageMultiplier: 140, cooldownTicks: sec(7), triggerRange: u(4.4), blockable: false, weight: 2 },
      { id: 'mother_sweep', shape: { type: 'sector', r: u(2.8), deg: 200 }, warningTicks: sec(0.9), recoverTicks: sec(0.7), damageMultiplier: 130, cooldownTicks: sec(5), triggerRange: u(2.6), blockable: true, weight: 3 },
    ],
  },
  // 荊棘谷（D-114）：棘背狼＝帶毒的野狼（比野狼耐打）
  thorn_wolf: {
    id: 'thorn_wolf', name: '棘背狼', hp: 360, atk: 29, def: 8, speed: 3.3, radius: u(0.42), hitstunTicks: 4,
    drops: { gold: [5, 9], items: [{ id: 'dust', chance: 35 }, { id: 'potion', chance: 6 }] },
    attacks: [
      { id: 'thorn_bite', shape: { type: 'sector', r: u(1.5), deg: 80 }, warningTicks: sec(0.65), recoverTicks: sec(0.5), damageMultiplier: 100, cooldownTicks: sec(2.2), triggerRange: u(1.3), blockable: true, status: { id: 'poison', ticks: sec(4), powerPct: 6 }, weight: 1 },
    ],
  },
  // 夜棘首領（D-114）：深夜的山谷限定精英；撕咬帶毒、衝鋒更長，必掉結晶
  night_thorn_alpha: {
    id: 'night_thorn_alpha', name: '夜棘首領', hp: 1500, atk: 35, def: 12, speed: 3.9, radius: u(0.6), hitstunTicks: 2,
    drops: { gold: [45, 70], items: [{ id: 'dust', chance: 100, count: [3, 5] }, { id: 'crystal', chance: 100 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'nta_bite', shape: { type: 'sector', r: u(1.9), deg: 100 }, warningTicks: sec(0.6), recoverTicks: sec(0.35), damageMultiplier: 115, cooldownTicks: sec(2.0), triggerRange: u(1.6), blockable: true, status: { id: 'poison', ticks: sec(5), powerPct: 8 }, weight: 3 },
      { id: 'nta_charge', shape: { type: 'line', len: u(6), width: u(1.3) }, warningTicks: sec(0.7), recoverTicks: sec(0.5), damageMultiplier: 145, cooldownTicks: sec(6), triggerRange: u(6), blockable: true, charge: { ticks: sec(0.4), wallStunTicks: sec(1.5) }, weight: 2 },
    ],
  },
  // 荊棘巡獵者（D-117）：會在棘刺迴廊上方來回巡邏的世界精英；撕咬帶毒、長衝鋒、近身「荊棘迴旋」（不能格擋，往外跑）
  thorn_stalker: {
    id: 'thorn_stalker', name: '荊棘巡獵者', hp: 1400, atk: 31, def: 12, speed: 3.7, radius: u(0.62), hitstunTicks: 2,
    drops: { gold: [50, 80], items: [{ id: 'dust', chance: 100, count: [3, 5] }, { id: 'crystal', chance: 100 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'stalker_bite', shape: { type: 'sector', r: u(1.9), deg: 100 }, warningTicks: sec(0.65), recoverTicks: sec(0.4), damageMultiplier: 115, cooldownTicks: sec(2.2), triggerRange: u(1.6), blockable: true, status: { id: 'poison', ticks: sec(5), powerPct: 8 }, weight: 3 },
      { id: 'stalker_pounce', shape: { type: 'line', len: u(6.5), width: u(1.3) }, warningTicks: sec(0.75), recoverTicks: sec(0.5), damageMultiplier: 145, cooldownTicks: sec(7), triggerRange: u(6.5), blockable: true, charge: { ticks: sec(0.4), wallStunTicks: sec(1.6) }, weight: 2 },
      { id: 'stalker_whirl', shape: { type: 'circle', r: u(2.4) }, warningTicks: sec(0.95), recoverTicks: sec(0.6), damageMultiplier: 135, cooldownTicks: sec(9), triggerRange: u(2.0), blockable: false, status: { id: 'poison', ticks: sec(5), powerPct: 8 }, weight: 2 },
    ],
  },
  // 棘冠狼后（D-114）：荊棘谷的 Boss。狼王的近戰＋荊棘母樹的毒刺與根系；第二階段招喚棘背狼、加「荊棘綻放」大圈
  thorn_queen: {
    id: 'thorn_queen', name: '棘冠狼后', hp: 4600, atk: 33, def: 13, speed: 3.1, radius: u(0.9), hitstunTicks: 0,
    drops: { gold: [110, 160], items: [{ id: 'dust', chance: 100, count: [5, 8] }, { id: 'crystal', chance: 100, count: [1, 2] }] },
    attacks: [
      { id: 'queen_claw', shape: { type: 'sector', r: u(2.2), deg: 80 }, warningTicks: sec(0.7), recoverTicks: sec(0.4), damageMultiplier: 110, cooldownTicks: sec(3.0), triggerRange: u(2.0), blockable: true, weight: 3 },
      { id: 'queen_lance', shape: { type: 'line', len: u(8), width: u(1.1) }, warningTicks: sec(0.8), recoverTicks: sec(0.5), damageMultiplier: 130, cooldownTicks: sec(5), triggerRange: u(8), blockable: true, status: { id: 'poison', ticks: sec(6), powerPct: 10 }, weight: 2, followUp: 'queen_lance2' },
      // 暴怒版限定：毒刺連射第二發（預告較短）；鑽進荊棘從背後冒出撕咬
      { id: 'queen_lance2', shape: { type: 'line', len: u(8), width: u(1.1) }, warningTicks: sec(0.5), recoverTicks: sec(0.6), damageMultiplier: 110, cooldownTicks: 0, triggerRange: u(8), blockable: true, status: { id: 'poison', ticks: sec(6), powerPct: 10 }, weight: 0, furyOnly: true },
      { id: 'queen_ambush', shape: { type: 'sector', r: u(2.6), deg: 130 }, warningTicks: sec(0.9), recoverTicks: sec(0.7), damageMultiplier: 150, cooldownTicks: sec(11), triggerRange: u(6), blockable: true, blink: { behind: u(2.2) }, weight: 2, furyOnly: true },
      { id: 'queen_roots', shape: { type: 'ring', rIn: u(1.9), rOut: u(4.4) }, warningTicks: sec(1.1), recoverTicks: sec(0.6), damageMultiplier: 150, cooldownTicks: sec(8), triggerRange: u(4.2), blockable: false, weight: 2 },
      { id: 'queen_charge', shape: { type: 'line', len: u(7), width: u(1.6) }, warningTicks: sec(0.9), recoverTicks: sec(0.5), damageMultiplier: 150, cooldownTicks: sec(10), triggerRange: u(7), blockable: true, charge: { ticks: sec(0.5), wallStunTicks: sec(2) }, weight: 2 },
      { id: 'queen_bloom', shape: { type: 'circle', r: u(3.2) }, warningTicks: sec(1.3), recoverTicks: sec(0.8), damageMultiplier: 170, cooldownTicks: sec(12), triggerRange: u(2.8), blockable: false, phase2Only: true, weight: 2 },
    ],
    boss: { phase2AtPct: 50, phase2CooldownPct: 85, summon: { enemyId: 'thorn_wolf', count: 2, everyTicks: sec(14) } },
  },
  // ---- 燼紅裂谷（D-125）：熔渣史萊姆、燼鬃狼、燼芯菇、黑曜首領、Boss 燼心岩王 ----
  // 熔渣史萊姆：慢、肉、會跳過來壓（短衝）＋原地濺射（不能格擋的小圓，要走開）
  slag_slime: {
    id: 'slag_slime', name: '熔渣史萊姆', hp: 520, atk: 30, def: 12, speed: 2.5, radius: u(0.5), hitstunTicks: 5,
    drops: { gold: [5, 9], items: [{ id: 'dust', chance: 45 }] },
    attacks: [
      { id: 'slime_splash', shape: { type: 'circle', r: u(1.7) }, warningTicks: sec(0.9), recoverTicks: sec(0.6), damageMultiplier: 110, cooldownTicks: sec(3.2), triggerRange: u(1.3), blockable: false, weight: 2 },
      { id: 'slime_hop', shape: { type: 'line', len: u(3.5), width: u(1.3) }, warningTicks: sec(0.8), recoverTicks: sec(0.7), damageMultiplier: 120, cooldownTicks: sec(6), triggerRange: u(3.5), blockable: true, charge: { ticks: sec(0.4), wallStunTicks: sec(1.2) }, weight: 1 },
    ],
  },
  // 燼鬃狼：比棘背狼快、咬兩下（第二下預告短）
  ember_wolf: {
    id: 'ember_wolf', name: '燼鬃狼', hp: 400, atk: 31, def: 9, speed: 3.6, radius: u(0.42), hitstunTicks: 4,
    drops: { gold: [4, 8], items: [{ id: 'dust', chance: 35 }] },
    attacks: [
      { id: 'ember_bite', shape: { type: 'sector', r: u(1.5), deg: 80 }, warningTicks: sec(0.65), recoverTicks: sec(0.3), damageMultiplier: 95, cooldownTicks: sec(2.6), triggerRange: u(1.3), blockable: true, weight: 1, followUp: 'ember_bite2', followAlways: true },
      { id: 'ember_bite2', shape: { type: 'sector', r: u(1.6), deg: 90 }, warningTicks: sec(0.45), recoverTicks: sec(0.6), damageMultiplier: 90, cooldownTicks: 0, triggerRange: u(1.6), blockable: true, weight: 0 },
    ],
  },
  // 燼芯菇：射出熔岩彈（直線、較寬、沒有中毒）
  ember_shroom: {
    id: 'ember_shroom', name: '燼芯菇', hp: 240, atk: 27, def: 5, speed: 2.6, radius: u(0.4), hitstunTicks: 5,
    drops: { gold: [5, 9], items: [{ id: 'dust', chance: 40 }, { id: 'potion', chance: 12 }] },
    attacks: [
      { id: 'ember_shot', shape: { type: 'line', len: u(7), width: u(1.0) }, warningTicks: sec(0.85), recoverTicks: sec(0.6), damageMultiplier: 110, cooldownTicks: sec(3.2), triggerRange: u(6), blockable: true, weight: 1 },
    ],
  },
  // 黑曜首領（精英）：撕咬＋長衝鋒＋落地震擊
  obsidian_alpha: {
    id: 'obsidian_alpha', name: '黑曜首領', hp: 1700, atk: 35, def: 14, speed: 3.7, radius: u(0.6), hitstunTicks: 2,
    drops: { gold: [30, 45], items: [{ id: 'dust', chance: 100, count: [3, 4] }, { id: 'crystal', chance: 50 }, { id: 'potion', chance: 60 }] },
    attacks: [
      { id: 'obs_bite', shape: { type: 'sector', r: u(1.9), deg: 100 }, warningTicks: sec(0.65), recoverTicks: sec(0.4), damageMultiplier: 115, cooldownTicks: sec(2.4), triggerRange: u(1.6), blockable: true, weight: 3 },
      { id: 'obs_charge', shape: { type: 'line', len: u(6), width: u(1.3) }, warningTicks: sec(0.8), recoverTicks: sec(0.4), damageMultiplier: 140, cooldownTicks: sec(8), triggerRange: u(6), blockable: true, charge: { ticks: sec(0.4), wallStunTicks: sec(1.6) }, weight: 2, followUp: 'obs_slam', followAlways: true },
      { id: 'obs_slam', shape: { type: 'circle', r: u(2.2) }, warningTicks: sec(0.6), recoverTicks: sec(0.7), damageMultiplier: 120, cooldownTicks: 0, triggerRange: u(3), blockable: false, weight: 0 },
    ],
  },
  // 燼心岩王（Boss）：慢、重。拳擊（扇形）、熔岩裂地（長直線）、重踏（自身圓）；第二階段加震波環＋招喚熔渣史萊姆。
  ember_colossus: {
    id: 'ember_colossus', name: '燼心岩王', hp: 5400, atk: 35, def: 15, speed: 2.6, radius: u(1.05), hitstunTicks: 0,
    drops: { gold: [140, 200], items: [{ id: 'dust', chance: 100, count: [6, 9] }, { id: 'crystal', chance: 100, count: [1, 2] }] },
    attacks: [
      { id: 'colossus_fist', shape: { type: 'sector', r: u(2.6), deg: 90 }, warningTicks: sec(0.8), recoverTicks: sec(0.5), damageMultiplier: 120, cooldownTicks: sec(3.2), triggerRange: u(2.3), blockable: true, weight: 3 },
      { id: 'colossus_fissure', shape: { type: 'line', len: u(10), width: u(1.4) }, warningTicks: sec(1.0), recoverTicks: sec(0.6), damageMultiplier: 150, cooldownTicks: sec(7), triggerRange: u(9), blockable: true, weight: 2, followUp: 'colossus_fissure2' },
      { id: 'colossus_stomp', shape: { type: 'circle', r: u(3.0) }, warningTicks: sec(1.2), recoverTicks: sec(0.8), damageMultiplier: 160, cooldownTicks: sec(9), triggerRange: u(2.6), blockable: false, weight: 2 },
      { id: 'colossus_quake', shape: { type: 'ring', rIn: u(2.2), rOut: u(5.0) }, warningTicks: sec(1.2), recoverTicks: sec(0.7), damageMultiplier: 150, cooldownTicks: sec(10), triggerRange: u(4.5), blockable: false, phase2Only: true, weight: 2 },
      // 暴怒版限定：裂地之後再補一道（預告短）
      { id: 'colossus_fissure2', shape: { type: 'line', len: u(10), width: u(1.4) }, warningTicks: sec(0.6), recoverTicks: sec(0.7), damageMultiplier: 130, cooldownTicks: 0, triggerRange: u(10), blockable: true, weight: 0, furyOnly: true },
    ],
    boss: { phase2AtPct: 50, phase2CooldownPct: 85, summon: { enemyId: 'slag_slime', count: 2, everyTicks: sec(16) } },
  },
  wolf_king: {
    id: 'wolf_king', name: '霧角狼王', hp: 4200, atk: 31, def: 12, speed: 3.0, radius: u(0.9), hitstunTicks: 0,
    drops: { gold: [80, 120], items: [{ id: 'dust', chance: 100, count: [4, 6] }, { id: 'crystal', chance: 100 }] },
    attacks: [
      // P1：爪擊（小扇形、快）、扇形撕咬、直線衝鋒；P2 加環形震波
      { id: 'king_claw', shape: { type: 'sector', r: u(2.2), deg: 70 }, warningTicks: sec(0.7), recoverTicks: sec(0.4), damageMultiplier: 110, cooldownTicks: sec(3.2), triggerRange: u(2.0), blockable: true, weight: 3 },
      { id: 'king_bite', shape: { type: 'sector', r: u(3.2), deg: 110 }, warningTicks: sec(1.0), recoverTicks: sec(0.6), damageMultiplier: 170, cooldownTicks: sec(6), triggerRange: u(3.0), blockable: true, weight: 2 },
      { id: 'king_charge', shape: { type: 'line', len: u(7), width: u(1.6) }, warningTicks: sec(0.9), recoverTicks: sec(0.5), damageMultiplier: 160, cooldownTicks: sec(9), triggerRange: u(7), blockable: true, charge: { ticks: sec(0.5), wallStunTicks: sec(2) }, weight: 2, followUp: 'king_charge2' },
      // 暴怒版限定（D-105）：衝完回頭再衝一次（預告較短）；霧中瞬移到背後撕咬
      { id: 'king_charge2', shape: { type: 'line', len: u(7), width: u(1.6) }, warningTicks: sec(0.6), recoverTicks: sec(0.7), damageMultiplier: 140, cooldownTicks: 0, triggerRange: u(7), blockable: true, charge: { ticks: sec(0.5), wallStunTicks: sec(2) }, weight: 0, furyOnly: true },
      { id: 'king_mist_rend', shape: { type: 'sector', r: u(2.6), deg: 120 }, warningTicks: sec(0.9), recoverTicks: sec(0.7), damageMultiplier: 150, cooldownTicks: sec(11), triggerRange: u(6), blockable: true, blink: { behind: u(2.2) }, weight: 2, furyOnly: true },
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
    mapAi: true, reviveAtCampfire: true, loot: true, lootEnhance: { dustPerLevel: 4, maxLevel: 5, atkPctPerLevel: 8 }, rampPctPerMin: 10, enemies: [],
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
