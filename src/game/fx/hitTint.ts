// 命中火花的顏色（第三期 Q2，D-335）：照「元素視覺語言」一眼分得出來——
// 火＝橘紅、冰＝淺藍、毒＝紫綠、減速＝灰藍、破甲／虛弱＝淡紫；沒有元素就看武器（劍＝白金、弓＝青白、杖＝紫）。
// 純畫面資料：不影響傷害。
import type { Shape, SkillDefinition, SkillHit } from '../../core/battle/rt/types';

export interface HitLook {
  color: number;
  /** 粒子貼圖：火用暖色的 ember，其他用冷白的 spark */
  tex: 'spark' | 'ember';
}

const ELEMENT: Readonly<Record<string, HitLook>> = {
  burn: { color: 0xff7a2a, tex: 'ember' },
  freeze: { color: 0x9fe8ff, tex: 'spark' },
  poison: { color: 0xb46aff, tex: 'spark' },
  slow: { color: 0xa8c8ff, tex: 'spark' },
  weak: { color: 0xd8a8ff, tex: 'spark' },
  break: { color: 0xffe08a, tex: 'spark' },
};

const WEAPON: Readonly<Record<string, HitLook>> = {
  sword: { color: 0xfff0c8, tex: 'spark' },
  bow: { color: 0xc8f4ff, tex: 'spark' },
  staff: { color: 0xc89aff, tex: 'spark' },
};

export const CRIT_LOOK: HitLook = { color: 0xffd05a, tex: 'ember' };

/** 這招帶的第一個狀態（命中段、或格擋反擊） */
export function skillElement(def: SkillDefinition | undefined): string | undefined {
  if (!def) return undefined;
  for (const h of def.hits) if (h.status) return h.status.id;
  return def.block?.counter.status?.id;
}

/** 這一下命中的火花長相：暴擊金色優先，再看招式元素，最後看武器 */
export function hitLook(weapon: string | undefined, def: SkillDefinition | undefined, crit: boolean): HitLook {
  if (crit) return CRIT_LOOK;
  const el = skillElement(def);
  return (el && ELEMENT[el]) || WEAPON[weapon ?? 'sword'] || WEAPON.sword!;
}

/** 小冷卻圖示的底色與外框（第 165 輪）：五顆以前全是同一種棕色，冷卻中只剩數字，分不出哪顆是哪招 */
export interface BadgeLook {
  fill: number;
  rim: number;
  /** 冷卻中的外框（同色相、暗一階） */
  dim: number;
}

/** 元素鮮明的招用元素色（和 effectIcon 的 ELEMENT_LOOK 同一套語言）：火橘、冰青、毒綠；減速／破甲這類附帶效果不算 */
const BADGE_STATUS: Readonly<Record<string, number>> = { burn: 0xff7a2c, freeze: 0x4ad0ff, poison: 0x8ad838 };
/** 其餘照技能欄固定一色，色相拉開：第一欄金、第二欄青綠、第三欄紫、護盾欄銀白、大招粉紅 */
const BADGE_SLOT: Readonly<Record<string, number>> = { heavy_slash: 0xf0c050, whirlwind: 0x40c890, charge: 0x9a7aff, parry: 0xdfe6f2, blade_storm: 0xff7ad0 };

/** 把顏色壓暗成底色（保留色相，亮度約三成） */
function shade(c: number, k: number): number {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/** slot＝技能欄 id（heavy_slash／whirlwind／charge／parry／blade_storm；換打法後 def.id 會變，欄位 id 不變） */
export function skillBadge(slot: string, def: SkillDefinition | undefined): BadgeLook {
  // 護盾招的「打一下」常帶狀態，但玩家認它是護盾 → 一律用護盾欄的顏色
  // 第三欄也固定用自己的顏色：它的變化常和第一欄同元素（法杖的冰槍＋寒霜結界），兩顆會撞色
  const el = def?.guard || slot === 'charge' ? undefined : skillElement(def);
  const rim = (el && BADGE_STATUS[el]) || BADGE_SLOT[slot] || BADGE_SLOT.heavy_slash!;
  return { fill: shade(rim, 0.3), rim, dim: shade(rim, 0.6) };
}

/**
 * 長弓直線箭的長相（第 166 輪）：原招的穿雲箭／縛足箭／風障射擊以前是同一條白線，連放時分不出誰是誰。
 * 照資料分（不寫招式 id）：護盾招＝guard（和風障同色）、帶減速的＝snare（翠綠＋命中的怪腳下繩環）、沒帶狀態的重箭＝pierce（白金＋音爆環）。
 * 大招與其他元素（火／毒／冰／破甲）照原本的顏色，回 undefined。
 */
export function bowLineLook(def: SkillDefinition, hit: Pick<SkillHit, 'mult' | 'status' | 'shape'>): 'pierce' | 'snare' | 'guard' | undefined {
  if (hit.shape.type !== 'line' || def.role === 'ult') return undefined;
  if (def.guard) return hit.status ? undefined : 'guard';
  if (hit.status?.id === 'slow') return 'snare';
  if (!hit.status && hit.mult >= 150) return 'pierce';
  return undefined;
}

/**
 * 敵人招式「落下去那一刻」的長相（第 167 輪）。以前預告填滿之後紅色範圍直接消失——沒打中就什麼都沒有，打中也只有主角閃白和數字，
 * 看不出狼王是咬了一口、抓了一下還是震了地。照形狀分（不寫招式 id）：
 * 狼系的窄扇形＝爪痕（三道）、寬扇形＝咬合（上下兩排牙合起來）、其他怪的扇形＝一片月牙掃過去、環形＝震波（由內往外＋碎石）、圓形＝砸地。
 * 直線（衝鋒／射擊）與地面荊棘、熔岩、墜星那些有自己演出的招回 undefined。純畫面。
 */
export type EnemyImpact = 'claw' | 'bite' | 'sweep' | 'quake' | 'slam';
export function enemyImpact(shape: Shape, hasOwnFx: boolean, beast = true): EnemyImpact | undefined {
  if (hasOwnFx) return undefined;
  // 爪和牙只給野獸（狼系）；岩王的拳、守望者的斬、母樹的掃是一片厚月牙掃過去
  if (shape.type === 'sector') return !beast ? 'sweep' : shape.deg >= 90 ? 'bite' : 'claw';
  if (shape.type === 'ring') return 'quake';
  if (shape.type === 'circle') return 'slam';
  return undefined;
}

/**
 * 閃過敵人攻擊那一刻的回饋分級（第 168 輪）。五欄全自動之後閃避是玩家唯一要自己按的招，但閃過去以前只冒一個小小的藍色「MISS」。
 * 同一次翻滾可能連續閃過好幾下（兩隻狼同時咬）：第一下給大的（大字＋環＋短停頓），0.5 秒內後面幾下只冒小字，不重複停頓。
 * Boss 的招更大。純畫面：停頓多久、閃不閃都不影響戰鬥結果（有沒有閃過是 core 的 `dodged` 事件決定的）。
 */
export interface DodgeFeedback { big: boolean; stopMs: number; ring: number; flash: boolean }
export function dodgeFeedback(sinceLastMs: number, boss: boolean, lowFx = false): DodgeFeedback {
  if (sinceLastMs < 500) return { big: false, stopMs: 0, ring: 0, flash: false };
  return boss ? { big: true, stopMs: 110, ring: 170, flash: !lowFx } : { big: true, stopMs: 60, ring: 120, flash: false };
}

/**
 * 主角有危險時畫面邊緣的紅暈（第 170 輪）。技能全自動之後玩家只管走位、閃避、喝水，眼睛在畫面中間的主角身上、不在頂端的血條——
 * 「我快死了」和「我剛剛被打了」要在不看血條的情況下也感覺得到。回傳紅暈的不透明度（0＝不畫）：
 * - 血量低於 40% 就出現（一出現就看得到，不是從 0 慢慢淡入——截圖試過，淡入的前半段根本看不出來），越低越濃（12% 以下最濃）；低於 20% 會慢慢一明一暗（省電畫質不閃，但照樣畫——這是玩法資訊）。
 * - 剛被打（真的掉血）的 0.38 秒內多一下，一次掉超過 12% 血的重擊更濃。
 * 純畫面：只讀血量與事件，不影響戰鬥。
 */
export function dangerAlpha(hpPct: number, sinceHitMs: number, hitBig: boolean, nowMs: number, lowFx = false): number {
  if (hpPct <= 0) return 0;
  const low = hpPct >= 0.4 ? 0 : 0.28 + 0.72 * Math.min(1, (0.4 - hpPct) / 0.28);
  const pulse = hpPct < 0.2 && !lowFx ? 0.82 + 0.18 * Math.sin(nowMs / 160) : 1;
  const hit = sinceHitMs >= 0 && sinceHitMs < 380 ? (hitBig ? 0.5 : 0.26) * (1 - sinceHitMs / 380) : 0;
  return Math.min(0.85, low * 0.6 * pulse + hit);
}

/**
 * 震波翹起來的地面碎塊照地圖換顏色（第 172 輪）：以前四張圖都是土色碎石＋橘色波，
 * 星骸守望者在藍色的星隕高原震出一圈土黃色、岩王在熔岩地上也是。純畫面。
 */
export interface GroundPalette { wave: number; rockA: number; rockB: number; shadow: number; spark: number; glow: boolean }
const GROUND: Record<string, GroundPalette> = {
  // 星隕：藍白晶片、會發光
  starfall: { wave: 0xa8c8ff, rockA: 0x8fb0ff, rockB: 0xe4eeff, shadow: 0x101838, spark: 0xcfe0ff, glow: true },
  // 燼紅：黑曜碎塊、邊緣燒紅
  emberrift: { wave: 0xff9a50, rockA: 0x3a2a28, rockB: 0x5c3a30, shadow: 0x1a0c08, spark: 0xff8a3a, glow: false },
  // 荊棘谷：暗紅的土
  thornvale: { wave: 0xffb070, rockA: 0x5a3a40, rockB: 0x7a5258, shadow: 0x2a1820, spark: 0xc89a9a, glow: false },
};
const EARTH: GroundPalette = { wave: 0xffb070, rockA: 0x6a5a4a, rockB: 0x8a7a66, shadow: 0x3a3028, spark: 0xb8a488, glow: false };
export function groundPalette(stageId: string): GroundPalette {
  return GROUND[stageId] ?? EARTH;
}

/**
 * 雷暴的落點（第 178 輪）：以前每一波的兩道閃電都隨機落在圈裡，常常劈在空地上，被打到的怪身上只有數字。
 * 現在先劈圈裡的怪（從隨機一隻開始輪，怪多時每一波換人），不夠 n 隻才用隨機空地補滿。
 * 純畫面：誰受傷仍由核心的圓形判定決定；這裡只決定閃電畫在哪。座標是世界座標。
 */
export function stormStrikes(cx: number, cy: number, r: number, foes: readonly { x: number; y: number; r?: number }[], n: number, rnd: () => number): { x: number; y: number; on: boolean }[] {
  const inside = foes.filter((f) => (f.x - cx) ** 2 + (f.y - cy) ** 2 <= (r + (f.r ?? 0)) ** 2);
  const out: { x: number; y: number; on: boolean }[] = [];
  const start = inside.length ? Math.min(inside.length - 1, Math.floor(rnd() * inside.length)) : 0;
  for (let i = 0; i < Math.min(n, inside.length); i++) {
    const f = inside[(start + i) % inside.length]!;
    out.push({ x: f.x, y: f.y, on: true });
  }
  while (out.length < n) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.85;
    out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, on: false });
  }
  return out;
}
