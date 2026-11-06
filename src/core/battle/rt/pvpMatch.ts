// 非同步 PvP 對戰（Q7 地基，24 §6.2、第 143 輪）：伺服器給種子與雙方配裝 → 客戶端在本機打、記下自己的指令 →
// 伺服器用同一份引擎重跑（對手由 PlayerBot 操作，兩邊一模一樣）判勝負。指令紀錄不合法整場拒絕（做不了假）。
// 純函式：src/server 的 pvp.start／finish 與畫面共用。
import { addPlayer, createBattle, ctlOf, playerOf, stateHash, step } from './engine';
import { WEAPONS } from './data';
import { BOT_PROFILES, PlayerBot } from './sim';
import type { BattleCommand, BattleCommandBody, BattleState, SkillMod } from './types';

export type PvpWeapon = 'sword' | 'bow' | 'staff';
export interface PvpSide {
  weapon: PvpWeapon;
  /** 裝備換算後的平加成（伺服器用 gearBonus＋pvpGear 算好；客戶端不能自己給） */
  bonus: { hp: number; atk: number; def: number };
  skillVariants?: string[];
  skillMods?: Record<string, SkillMod>;
}
export interface PvpMatchSetup {
  seed: number;
  /** 你（pid 0） */
  me: PvpSide;
  /** 對手（pid 1，Bot 操作） */
  foe: PvpSide;
}
/** 指令紀錄：第幾個 tick 下了哪些指令（只記有指令的 tick） */
export type PvpInputs = { t: number; c: BattleCommandBody[] }[];

export const PVP_STAGE = 'pvp_arena';
/** 每個 tick 最多幾個指令、整場最多幾筆（擋灌爆伺服器的紀錄） */
export const PVP_MAX_CMDS_PER_TICK = 4;
export const PVP_MAX_RECORDS = 20_000;
const FOE_BOT = 'normal';

export function startPvp(m: PvpMatchSetup): { s: BattleState; foeBot: PlayerBot } {
  const s = createBattle({ stageId: PVP_STAGE, seed: m.seed, weapon: m.me.weapon === 'sword' ? undefined : m.me.weapon, bonus: m.me.bonus, skillVariants: m.me.skillVariants, skillMods: m.me.skillMods });
  const foe = addPlayer(s, { weapon: m.foe.weapon, team: 1, bonus: m.foe.bonus, skillVariants: m.foe.skillVariants, skillMods: m.foe.skillMods, dx: 0, dy: -9 * 120 });
  // 開場兩邊都先鎖定對方（競技場沒有怪）
  playerOf(s).targetId = foe.id;
  foe.targetId = playerOf(s).id;
  // 第 144 輪：競技場不能喝藥水（Bot 不喝；不然改過的客戶端灌藥水指令就能拖贏，伺服器重跑也會照算）
  s.potions = 0;
  ctlOf(s, foe).potions = 0;
  return { s, foeBot: new PlayerBot(BOT_PROFILES[FOE_BOT]!, 'foe', 1) };
}

const finite = (n: unknown, lim = 100_000): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= lim;
/** 一個指令合不合法（只看形狀；能不能放、冷卻好了沒是引擎判斷） */
export function validCmd(c: unknown, skills: ReadonlySet<string>): c is BattleCommandBody {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  if ('pid' in x) return false; // 只能下自己的指令
  switch (x.type) {
    case 'move':
    case 'dodge':
      return finite(x.dx, 1000) && finite(x.dy, 1000) && Object.keys(x).length === 3;
    case 'stop':
    case 'potion':
    case 'rest':
      return Object.keys(x).length === 1;
    case 'skill':
      return typeof x.id === 'string' && skills.has(x.id) && Object.keys(x).length === 2;
    case 'target':
      return Number.isSafeInteger(x.id) && Object.keys(x).length === 2;
    case 'moveTo':
      return finite(x.x) && finite(x.y) && Object.keys(x).length === 3;
    default:
      return false;
  }
}

/**
 * 重跑整場：你的指令照紀錄、對手由 Bot 操作。紀錄不合法（tick 沒遞增、超過結束時間、指令形狀不對、太多）回 null。
 * 一場最長＝關卡時間上限（3 分鐘），所以伺服器重跑的成本有上限（約 5,400 tick）。
 */
export function replayPvp(m: PvpMatchSetup, inputs: unknown): { s: BattleState; hash: string } | null {
  if (!Array.isArray(inputs) || inputs.length > PVP_MAX_RECORDS) return null;
  const skills = new Set(Object.keys(WEAPONS[m.me.weapon].skills));
  let prev = 0;
  for (const r of inputs as unknown[]) {
    const x = r as { t?: unknown; c?: unknown };
    if (!x || !Number.isSafeInteger(x.t) || (x.t as number) <= prev || !Array.isArray(x.c) || !x.c.length || x.c.length > PVP_MAX_CMDS_PER_TICK || !x.c.every((c) => validCmd(c, skills))) return null;
    prev = x.t as number;
  }
  const recs = inputs as PvpInputs;
  const { s, foeBot } = startPvp(m);
  let i = 0;
  while (s.outcome === 'running') {
    const t = s.tick + 1;
    const mine: BattleCommand[] = recs[i]?.t === t ? recs[i++]!.c : [];
    step(s, [...mine, ...foeBot.decide(s)]);
  }
  // 結束後還有沒用到的紀錄＝造假（例如把超時後的指令塞進去）
  if (i !== recs.length) return null;
  return { s, hash: stateHash(s) };
}

/** 本機打一場（畫面或測試）：每個 tick 問 mine 要指令並記下來；回傳紀錄＋結果（和 replayPvp 應該一模一樣） */
export function playPvp(m: PvpMatchSetup, mine: (s: BattleState) => BattleCommandBody[]): { s: BattleState; inputs: PvpInputs; hash: string } {
  const { s, foeBot } = startPvp(m);
  const inputs: PvpInputs = [];
  while (s.outcome === 'running') {
    const c = mine(s).slice(0, PVP_MAX_CMDS_PER_TICK);
    if (c.length) inputs.push({ t: s.tick + 1, c });
    step(s, [...c, ...foeBot.decide(s)]);
  }
  return { s, inputs, hash: stateHash(s) };
}
