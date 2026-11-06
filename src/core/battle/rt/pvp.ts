// PvP 數值正規化（24 §6.1，V3 先行，第 143 輪）：純函式，給之後的隊伍引擎（Q6）、非同步天梯驗證（Q7）、平衡模擬用。
// 原則：打人要打得久一點（看得到操作與換招）、控制不能一套控到死、裝備差距縮小（刷寶有用，但不是決定一切）。
// 這裡只放規則；引擎接上去的時候（V3 Q6）才會影響戰鬥，單人 PvE 完全不讀這份。
import { gearBase, type RtGear } from './gear';
import { sec } from './types';

export type PvpWeapon = 'sword' | 'bow' | 'staff';

export const PVP = {
  /** 場內最大 HP 倍率 */
  hpMult: 3,
  /** 所有傷害倍率 */
  dmgMult: 0.5,
  /**
   * 武器相剋的傷害百分比 [攻擊方][被打方]（第 144 輪平衡：三武器互打勝率 40～60%，23 §Q6）；只影響玩家打玩家，PvE 不讀。
   * 為什麼要分對手：遠程會邊退邊射，弓對劍、法杖對弓、劍對法杖是「繞圈相剋」，單一武器倍率調不平（調一邊另一組就歪）。
   * 量法：`RT_REPORT=1 npx vitest run tests/rt-pvp-balance.test.ts --silent=false`
   */
  vsPct: {
    sword: { sword: 100, bow: 100, staff: 100 },
    bow: { sword: 86, bow: 100, staff: 100 },
    staff: { sword: 100, bow: 95, staff: 100 },
  } as Readonly<Record<PvpWeapon, Readonly<Record<PvpWeapon, number>>>>,
  /** 控制效果（暈、凍、緩）時間倍率 */
  ccMult: 0.5,
  /** 同一個目標在視窗內第 n 次被控的時間倍率（第 4 次起免疫） */
  ccDecay: [1, 0.5, 0.25, 0] as readonly number[],
  /** 遞減視窗：最後一次被控後這麼久沒被控就重置 */
  ccWindowTicks: sec(15),
  /** 物品等級差距保留多少（0.3＝差 10 級只算差 3 級） */
  ilvlKeep: 0.3,
  /** 強化等級保留多少（+10 只算 +5） */
  enhKeep: 0.5,
} as const;

export const pvpMaxHp = (maxHp: number): number => Math.round(maxHp * PVP.hpMult);
/** 傷害至少 1（不然低攻打高防永遠打不動） */
export const pvpDamage = (dmg: number, att: PvpWeapon = 'sword', def: PvpWeapon = 'sword'): number =>
  dmg <= 0 ? 0 : Math.max(1, Math.round((dmg * PVP.dmgMult * PVP.vsPct[att][def]) / 100));

/** 控制遞減的狀態（每個目標一份） */
export interface CcMemo {
  /** 視窗內第幾次（0 起算） */
  n: number;
  /** 上一次被控的 tick */
  last: number;
}

/** 這次控制要給幾 tick，並回傳新的遞減狀態 */
export function pvpCc(baseTicks: number, now: number, memo: CcMemo | undefined): { ticks: number; memo: CcMemo } {
  const n = memo && now - memo.last <= PVP.ccWindowTicks ? memo.n : 0;
  const k = PVP.ccDecay[Math.min(n, PVP.ccDecay.length - 1)]!;
  return { ticks: Math.round(baseTicks * PVP.ccMult * k), memo: { n: n + 1, last: now } };
}

/** 物品等級往參考等級壓（參考＝這場兩邊的平均或段位的標準等級） */
export function pvpIlvl(ilvl: number, ref: number): number {
  return Math.max(1, Math.min(12, Math.round(ref + (ilvl - ref) * PVP.ilvlKeep)));
}

/** 詞綴的平數值大約和物品等級成正比（gear.ts 的 affixValue：1＋L×0.35）；百分比詞綴不壓 */
const flatScale = (from: number, to: number): number => (1 + to * 0.35) / (1 + from * 0.35);

/** 進場用的裝備：底數值照壓縮後的等級重算、平詞綴等比例縮、強化減半。名字、特效、uid 不變 */
export function pvpGear(g: RtGear, ref: number): RtGear {
  const L = pvpIlvl(g.ilvl, ref);
  const k = flatScale(g.ilvl, L);
  const affixes = g.affixes.map((a) => (a.stat === 'atkPct' || a.stat === 'hpPct' ? a : { ...a, value: Math.max(1, Math.round(a.value * k)) }));
  const out: RtGear = { ...g, ilvl: L, base: gearBase(g.slot, L, g.rarity), affixes };
  if (g.enh) out.enh = Math.floor(g.enh * PVP.enhKeep);
  return out;
}
