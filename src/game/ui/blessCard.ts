// 祝福卡上的兩個提示（第 205 輪，D-410）：純資料，不碰 Phaser，結算仍然只在 core。
// ①觸發方式的小標（普攻／技能／閃避…）：一眼看出這張改的是哪一種打法。
// ②搭配：檯面上這張和身上已有的祝福（或獨特效果裝備）會互相帶動時，寫出是哪一個、怎麼帶動。
//   只列 engine.ts 裡真的會發生的連動，不是「同一類就算」：必暴會觸發綻光、擊殺爆炸會連鎖、冷卻縮短、同一下命中各自結算，
//   行為在 tests/rt-bless.test.ts 各有測試；這裡的配對規則在 tests/bless-card.test.ts。
import type { EffectDef } from '../../core/battle/rt/effects';

/** 這個效果靠什麼觸發（卡片右上的小標） */
export type BlessTrigger = 'attack' | 'skill' | 'dodge' | 'kill' | 'crit' | 'guard' | 'execute' | 'cooldown' | 'boost' | 'variant';

export function blessTrigger(d: EffectDef): BlessTrigger {
  if (d.variant) return 'variant';
  if (d.onAttack) return 'attack';
  if (d.onSkillHit) return 'skill';
  if (d.onDodge) return 'dodge';
  if (d.onKill) return 'kill';
  if (d.onCrit) return 'crit';
  if (d.onGuard) return 'guard';
  if (d.execute) return 'execute';
  if (isCooldown(d)) return 'cooldown';
  return 'boost';
}

/** 連動的種類；`lead`＝檯面上這張是「帶動的那一邊」（文字要換個說法） */
export type SynergyKind = 'crit' | 'cooldown' | 'dodge' | 'kill' | 'finish' | 'skillHit' | 'attack';
export interface BlessSynergy {
  kind: SynergyKind;
  /** 身上的那一個 */
  with: EffectDef;
  lead: boolean;
}

/** 全技能冷卻縮短（疾雷那一類）：技能放得更勤 */
const isCooldown = (d: EffectDef): boolean => !!d.mods && Object.values(d.mods).filter((m) => (m.cdPct ?? 0) > 0).length >= 3;
/** 靠「放技能／技能命中」觸發的 */
const onSkill = (d: EffectDef): boolean => !!d.onSkillHit || !!d.onGuard;
const makesCrit = (d: EffectDef): boolean => !!d.onDodge?.critTicks;

function pair(a: EffectDef, b: EffectDef): { kind: SynergyKind; lead: boolean } | undefined {
  // 閃避後必暴 × 暴擊就炸：那一下必暴一定引爆
  if (makesCrit(a) && b.onCrit) return { kind: 'crit', lead: true };
  if (a.onCrit && makesCrit(b)) return { kind: 'crit', lead: false };
  // 冷卻縮短 × 靠技能觸發：放得更勤＝觸發更多次
  if (isCooldown(a) && onSkill(b)) return { kind: 'cooldown', lead: true };
  if (onSkill(a) && isCooldown(b)) return { kind: 'cooldown', lead: false };
  // 斬首 × 擊殺觸發：收頭更快
  if (a.execute && b.onKill) return { kind: 'finish', lead: true };
  if (a.onKill && b.execute) return { kind: 'finish', lead: false };
  // 同一個時機兩個都觸發
  if (a.onDodge && b.onDodge) return { kind: 'dodge', lead: false };
  if (a.onKill && b.onKill) return { kind: 'kill', lead: false };
  if (a.onSkillHit && b.onSkillHit && sameSkill(a, b)) return { kind: 'skillHit', lead: false };
  if (a.onAttack && b.onAttack) return { kind: 'attack', lead: false };
  return undefined;
}
/** 兩個「技能命中」效果會不會落在同一招上（有一邊不限欄位，或兩邊指同一欄） */
const sameSkill = (a: EffectDef, b: EffectDef): boolean => !a.onSkillHit?.skill || !b.onSkillHit?.skill || a.onSkillHit.skill === b.onSkillHit.skill;

/** 檯面上的 `offer` 和身上的 `have` 有沒有連動；有好幾個時回傳最前面的規則（pair 裡的順序）對上的那一個 */
export function blessSynergy(offer: EffectDef, have: readonly EffectDef[]): BlessSynergy | undefined {
  let best: BlessSynergy | undefined;
  let rank = 99;
  for (const h of have) {
    if (h.id === offer.id) continue;
    const p = pair(offer, h);
    if (!p) continue;
    const r = ORDER.indexOf(p.kind);
    if (r < rank) {
      rank = r;
      best = { ...p, with: h };
    }
  }
  return best;
}
const ORDER: readonly SynergyKind[] = ['crit', 'cooldown', 'finish', 'dodge', 'kill', 'skillHit', 'attack'];

/** i18n 的 key：`bless.syn.<kind>`，帶動的那一邊多一個 `.lead` */
export const synergyKey = (s: BlessSynergy): string => `bless.syn.${s.kind}${s.lead ? '.lead' : ''}`;

/** 卡片的長相（改數字就能調）；on＝false 回到第 204 輪以前的直角卡、沒有小標與搭配 */
export const BLESS_CARD: { on: boolean; radius: number; band: number; bandA: number; chipFont: number; synFont: number; synH: number; fadeOthers: number } = { on: true, radius: 14, band: 168, bandA: 0.2, chipFont: 21, synFont: 21, synH: 34, fadeOthers: 0.22 };
