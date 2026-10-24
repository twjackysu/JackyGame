// 全域遊戲狀態（純邏輯，不 import phaser）。見 docs/design/06-tech-architecture.md §3。

export type StatKey = 'str' | 'agi' | 'int' | 'cha';
export type Faction = 'order' | 'town' | 'miners' | 'caravan';
export type CompanionId = 'serin' | 'liora' | 'io' | 'rourke';
export type MemberId = 'lian' | CompanionId;
export type FlagValue = boolean | number | string;

export interface MemberState {
  id: MemberId;
  level: number;
  xp: number;
  hp: number; // 目前 HP（戰鬥外保留）
  guest?: boolean; // 客座（洛克第 1 章）
  equipment: { weapon?: string; armor?: string; charm?: string };
}

export interface GameState {
  version: number;
  createdAt: number;
  playTimeMs: number;
  heroName: string;
  stats: Record<StatKey, number>;
  statPoints: number;
  party: MemberId[]; // 依加入順序；戰鬥上場取前 3
  members: Partial<Record<MemberId, MemberState>>;
  gold: number;
  inventory: Record<string, number>;
  cards: Record<string, number>; // 燼牌收藏：id → 張數
  deck: string[];
  flags: Record<string, FlagValue>;
  reputation: Record<Faction, number>; // −100 ~ 100
  affinity: Record<CompanionId, number>; // 0 ~ 100
  bondEvents: Record<CompanionId, number>; // 已完成羈絆事件數 0~5
  divergence: number; // 偏移值 0 ~ 100
  codex: string[]; // 已解鎖攻略筆記條目
  skills: string[]; // 已解鎖技能（連恩）
  location: { region: string; node: string };
  quests: Record<string, { stage: number; done?: boolean }>;
}

export const SAVE_VERSION = 1;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function newGame(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    playTimeMs: 0,
    heroName: '連恩',
    stats: { str: 3, agi: 4, int: 5, cha: 4 },
    statPoints: 0,
    party: ['lian'],
    members: { lian: { id: 'lian', level: 1, xp: 0, hp: 90, equipment: {} } },
    gold: 50,
    inventory: { potion_s: 2 },
    cards: {},
    deck: [],
    flags: {},
    reputation: { order: 0, town: 0, miners: 0, caravan: 0 },
    affinity: { serin: 0, liora: 0, io: 0, rourke: 0 },
    bondEvents: { serin: 0, liora: 0, io: 0, rourke: 0 },
    divergence: 0,
    codex: [],
    skills: ['lantern_strike', 'lamp_mark', 'resonance'],
    location: { region: 'ch0', node: 'corridor' },
    quests: {},
  };
}

/**
 * 二週目（D-035）：從頭開始劇情，但保留連恩等級與經驗、金錢、燼牌收藏、已看過的結局與教學提示。
 * 同伴加入時沿用連恩等級（見 join），所以全隊都會是高等級。
 */
export function newGamePlus(prev: GameState, now = Date.now()): GameState {
  const s = newGame(now);
  const lian = prev.members.lian;
  if (lian) s.members.lian = { ...s.members.lian!, level: lian.level, xp: lian.xp };
  s.gold = prev.gold;
  s.cards = { ...prev.cards };
  s.flags.ng_plus = Number(prev.flags.ng_plus ?? 0) + 1;
  for (const [k, v] of Object.entries(prev.flags)) if (k.startsWith('ending_seen_') || k.startsWith('tip_')) s.flags[k] = v;
  if (typeof prev.flags.ending === 'string') s.flags[`ending_seen_${prev.flags.ending}`] = true;
  return s;
}

/** 已看過幾種結局（含目前存檔的結局） */
export function endingsSeen(s: GameState | null): number {
  if (!s) return 0;
  const set = new Set(Object.keys(s.flags).filter((k) => k.startsWith('ending_seen_') && s.flags[k]).map((k) => k.slice(12)));
  if (typeof s.flags.ending === 'string') set.add(s.flags.ending);
  return set.size;
}

/** 對話/事件效果。資料檔（src/data/dialogue）以此描述選擇的後果。 */
export type Effect =
  | { flag: string; value?: FlagValue }
  | { divergence: number }
  | { rep: Faction; delta: number }
  | { affinity: CompanionId; delta: number }
  | { item: string; count?: number }
  | { gold: number }
  | { card: string; count?: number }
  | { codex: string }
  | { skill: string }
  | { join: CompanionId; guest?: boolean }
  | { leave: CompanionId }
  | { quest: string; stage: number; done?: boolean };

export function applyEffect(s: GameState, e: Effect): void {
  if ('flag' in e) s.flags[e.flag] = e.value ?? true;
  else if ('divergence' in e) s.divergence = clamp(s.divergence + e.divergence, 0, 100);
  else if ('rep' in e) s.reputation[e.rep] = clamp(s.reputation[e.rep] + e.delta, -100, 100);
  else if ('affinity' in e) s.affinity[e.affinity] = clamp(s.affinity[e.affinity] + e.delta, 0, 100);
  else if ('item' in e) {
    const n = (s.inventory[e.item] ?? 0) + (e.count ?? 1);
    if (n <= 0) delete s.inventory[e.item];
    else s.inventory[e.item] = n;
  } else if ('gold' in e) s.gold = Math.max(0, s.gold + e.gold);
  else if ('card' in e) s.cards[e.card] = (s.cards[e.card] ?? 0) + (e.count ?? 1);
  else if ('codex' in e) {
    if (!s.codex.includes(e.codex)) s.codex.push(e.codex);
  } else if ('skill' in e) {
    if (!s.skills.includes(e.skill)) s.skills.push(e.skill);
  } else if ('join' in e) {
    if (!s.party.includes(e.join)) s.party.push(e.join);
    const lv = s.members.lian?.level ?? 1;
    const prev = s.members[e.join];
    s.members[e.join] = prev
      ? { ...prev, guest: e.guest }
      : { id: e.join, level: lv, xp: 0, hp: -1, guest: e.guest, equipment: {} }; // hp −1 = 滿血（由戰鬥層計算 MaxHP）
  } else if ('leave' in e) s.party = s.party.filter((m) => m !== e.leave);
  else if ('quest' in e) s.quests[e.quest] = { stage: e.stage, done: e.done };
}

export function applyEffects(s: GameState, effects: readonly Effect[] | undefined): void {
  for (const e of effects ?? []) applyEffect(s, e);
}

/** 條件：對話選項、事件觸發用。 */
export type Condition =
  | { flag: string; equals?: FlagValue; not?: boolean }
  | { affinityAtLeast: [CompanionId, number] }
  | { repAtLeast: [Faction, number] }
  | { divergenceAtLeast: number }
  | { hasItem: string }
  | { hasCodex: string }
  | { inParty: MemberId }
  | { all: Condition[] }
  | { any: Condition[] };

export function check(s: GameState, c: Condition): boolean {
  if ('flag' in c) {
    const v = s.flags[c.flag];
    const ok = c.equals === undefined ? !!v : v === c.equals;
    return c.not ? !ok : ok;
  }
  if ('affinityAtLeast' in c) return s.affinity[c.affinityAtLeast[0]] >= c.affinityAtLeast[1];
  if ('repAtLeast' in c) return s.reputation[c.repAtLeast[0]] >= c.repAtLeast[1];
  if ('divergenceAtLeast' in c) return s.divergence >= c.divergenceAtLeast;
  if ('hasItem' in c) return (s.inventory[c.hasItem] ?? 0) > 0 || Object.values(s.members).some((m) => !!m && Object.values(m.equipment).includes(c.hasItem));
  if ('hasCodex' in c) return s.codex.includes(c.hasCodex);
  if ('inParty' in c) return s.party.includes(c.inParty);
  if ('all' in c) return c.all.every((x) => check(s, x));
  return c.any.some((x) => check(s, x));
}

/** 屬性檢定成功率（03 §5）：clamp(50% + (屬性 − 難度) × 12%, 5%, 95%) */
export function checkChance(statValue: number, dc: number): number {
  return clamp(0.5 + (statValue - dc) * 0.12, 0.05, 0.95);
}

/** 從 L 升到 L+1 所需 XP（03 §7.3） */
export const xpToNext = (level: number): number => Math.round(40 * Math.pow(level, 1.6));

/** 加經驗，回傳升了幾級。每升 1 級連恩 +1 屬性點。 */
export function grantXp(s: GameState, member: MemberId, xp: number): number {
  const m = s.members[member];
  if (!m) return 0;
  m.xp += xp;
  let ups = 0;
  while (m.xp >= xpToNext(m.level) && m.level < 20) {
    m.xp -= xpToNext(m.level);
    m.level++;
    ups++;
  }
  if (member === 'lian') s.statPoints += ups;
  return ups;
}

/** 戰鬥上場人數（隊伍前 N 位） */
export const ACTIVE_PARTY = 3;

/** 交換隊伍中兩位成員的位置（前 3 位上場）。主角連恩必須留在上場位；不合法時回傳 null。 */
export function swapPartyMembers(party: readonly MemberId[], i: number, j: number): MemberId[] | null {
  if (i === j || i < 0 || j < 0 || i >= party.length || j >= party.length) return null;
  const next = [...party];
  [next[i], next[j]] = [next[j]!, next[i]!];
  const li = next.indexOf('lian');
  if (li >= ACTIVE_PARTY) return null;
  return next;
}
