// 即時戰鬥大地圖的獨立紀錄（D-087）：跨場累計，只存在 localStorage `jg_rt_<stage>`，不碰主線 session 存檔。
// 純資料函式放這裡（有測試），讀寫 localStorage 的包一層 try/catch（無痕模式）。
import { prevMap, WORLD_MAPS, worldMap } from './worldMaps';
import { GEAR_SLOTS, isGear, type GearSlot, type RtGear } from '../core/battle/rt/gear';

export interface RtRecord {
  /** 狼王討伐總次數 */
  bossKills?: number;
  /** 第一次討伐的時間（Date.now） */
  firstAt?: number;
  /** 最快討伐（從進森林開始算，秒） */
  bestBossSec?: number;
  /** 累計擊殺 */
  kills?: number;
  /** 累計撿到的材料（名稱刻意不用 gold，避免和主線資產混淆） */
  coin?: number;
  dust?: number;
  crystal?: number;
  /** 打開過的寶箱 id（下次進來會是空箱） */
  chests?: string[];
  /** 進森林次數 */
  runs?: number;
  /** 累計遊玩秒數 */
  playSec?: number;
  /** 等級與目前經驗（D-090；下次進森林帶著） */
  level?: number;
  xp?: number;
  /** 行囊與身上裝備（D-091） */
  bag?: RtGear[];
  equip?: Partial<Record<GearSlot, RtGear>>;
  /** 狼王暴怒版（D-099）：玩家的選擇（解鎖後才有效）與討伐次數 */
  fury?: boolean;
  furyKills?: number;
  /** 深夜模式（D-103）：打倒暴怒狼王一次後解鎖 */
  night?: boolean;
  /** 技能點分配（D-110；形狀由 rtSkills.cleanRanks 檢查） */
  skills?: unknown;
  /** 技能變化（D-112）：選了變化版的技能 id（技能滿 5 級才有效，由 rtSkills.cleanVariants 檢查） */
  variants?: unknown;
  /** 營地懸賞（D-109；形狀由 rtBounty.cleanBounties 檢查） */
  bounty?: unknown;
  /** 強化花掉的材料（累計撿到 − 花掉 ＝ 手上有的；分解得到的粉塵記成負的花費） */
  spent?: { dust?: number; crystal?: number; coin?: number };
  /** 營火行商的貨架（D-116；形狀由 rtShop.cleanShop 檢查） */
  shop?: unknown;
}

/** 手上可以用的粉塵與結晶 */
export function walletOf(rec: RtRecord): { dust: number; crystal: number } {
  return { dust: Math.max(0, (rec.dust ?? 0) - (rec.spent?.dust ?? 0)), crystal: Math.max(0, (rec.crystal ?? 0) - (rec.spent?.crystal ?? 0)) };
}

/** 花材料（負數＝得到，例如分解）；不夠就回 null */
export function spend(rec: RtRecord, dust: number, crystal: number): RtRecord | null {
  const w = walletOf(rec);
  if (w.dust < dust || w.crystal < crystal) return null;
  return { ...rec, spent: { ...rec.spent, dust: (rec.spent?.dust ?? 0) + dust, crystal: (rec.spent?.crystal ?? 0) + crystal } };
}

/** 讀出來的行囊一律檢查形狀（壞資料丟掉、最多 60 件、身上的部位要對） */
export function cleanBag(rec: RtRecord): { bag: RtGear[]; equip: Partial<Record<GearSlot, RtGear>> } {
  const bag = (Array.isArray(rec.bag) ? rec.bag : []).filter(isGear).slice(0, 60);
  const equip: Partial<Record<GearSlot, RtGear>> = {};
  for (const slot of GEAR_SLOTS) {
    const g = rec.equip?.[slot];
    if (isGear(g) && g.slot === slot) equip[slot] = g;
  }
  return { bag, equip };
}

/** 一場的累計快照（從開場到現在） */
export interface RunSnap {
  kills: number;
  coin: number;
  dust: number;
  crystal: number;
  chests: string[];
  sec: number;
}

export const EMPTY_SNAP: RunSnap = { kills: 0, coin: 0, dust: 0, crystal: 0, chests: [], sec: 0 };

/** 把這場從 prev 到 now 的增量加進紀錄（重複呼叫不會重複計算） */
export function mergeRun(rec: RtRecord, prev: RunSnap, now: RunSnap): RtRecord {
  const d = (a: number, b: number): number => Math.max(0, a - b);
  const out: RtRecord = { ...rec };
  out.kills = (rec.kills ?? 0) + d(now.kills, prev.kills);
  out.coin = (rec.coin ?? 0) + d(now.coin, prev.coin);
  out.dust = (rec.dust ?? 0) + d(now.dust, prev.dust);
  out.crystal = (rec.crystal ?? 0) + d(now.crystal, prev.crystal);
  out.playSec = Math.round((rec.playSec ?? 0) + d(now.sec, prev.sec));
  const set = new Set(rec.chests ?? []);
  for (const c of now.chests) set.add(c);
  out.chests = [...set].sort();
  return out;
}

/** 討伐 Boss：次數 +1、首殺時間、最快紀錄（只有這場第一次討伐才算時間） */
export function recordBoss(rec: RtRecord, sec: number | null, at: number, fury = false): { rec: RtRecord; first: boolean; best: boolean } {
  const first = !rec.bossKills;
  const out: RtRecord = { ...rec, bossKills: (rec.bossKills ?? 0) + 1, firstAt: rec.firstAt ?? at };
  if (fury) out.furyKills = (rec.furyKills ?? 0) + 1;
  let best = false;
  if (sec !== null && (rec.bestBossSec === undefined || sec < rec.bestBossSec)) {
    out.bestBossSec = Math.round(sec);
    best = rec.bestBossSec !== undefined;
  }
  return { rec: out, first, best };
}

/** 暴怒狼王解鎖條件（D-099）：Lv8 以上或狼王討伐 3 次 */
export const FURY_UNLOCK = { level: 8, kills: 3 } as const;
export function furyUnlocked(rec: RtRecord, level: number): boolean {
  return level >= FURY_UNLOCK.level || (rec.bossKills ?? 0) >= FURY_UNLOCK.kills;
}

/** 深夜模式解鎖（D-103）：打倒暴怒狼王至少一次 */
export function nightUnlocked(rec: RtRecord): boolean {
  return (rec.furyKills ?? 0) >= 1;
}

/**
 * 共用進度的地圖（D-114）：荊棘谷的等級、經驗、行囊、技能點、材料、懸賞、累計數字都存在霧語森林的紀錄裡；
 * 只有 MAP_KEYS（Boss 討伐、寶箱、暴怒與深夜）是每張地圖自己的。
 */
export const LINKED_MAPS: Readonly<Record<string, string>> = Object.fromEntries(WORLD_MAPS.slice(1).map((m) => [m.id, WORLD_MAPS[0]!.id])); // { thornvale: 'mistwood' }
export const MAP_KEYS = ['bossKills', 'firstAt', 'bestBossSec', 'chests', 'fury', 'furyKills', 'night'] as const satisfies readonly (keyof RtRecord)[];
type MapKey = (typeof MAP_KEYS)[number];

function pickMap(rec: RtRecord): Pick<RtRecord, MapKey> {
  const out: Record<string, unknown> = {};
  for (const k of MAP_KEYS) if (rec[k] !== undefined) out[k] = rec[k];
  return out as Pick<RtRecord, MapKey>;
}
function dropMap(rec: RtRecord): RtRecord {
  const out: RtRecord = { ...rec };
  for (const k of MAP_KEYS) delete out[k];
  return out;
}
/** 共用地圖讀取：主地圖的共用欄位＋自己的地圖欄位 */
export function joinRecord(home: RtRecord, own: RtRecord): RtRecord {
  return { ...dropMap(home), ...pickMap(own) };
}
/** 共用地圖寫入：共用欄位寫回主地圖（主地圖自己的 Boss／寶箱不動），地圖欄位留在自己 */
export function splitRecord(home: RtRecord, rec: RtRecord): { home: RtRecord; own: RtRecord } {
  return { home: { ...dropMap(rec), ...pickMap(home) }, own: pickMap(rec) };
}

function readRaw(stage: string): RtRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(`jg_rt_${stage}`) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as RtRecord) : {};
  } catch {
    return {};
  }
}
function writeRaw(stage: string, rec: RtRecord): void {
  try {
    localStorage.setItem(`jg_rt_${stage}`, JSON.stringify(rec));
  } catch {
    /* 無痕模式：這場的紀錄就不保留 */
  }
}

export function loadRecord(stage: string): RtRecord {
  const home = LINKED_MAPS[stage];
  return home ? joinRecord(readRaw(home), readRaw(stage)) : readRaw(stage);
}

export function saveRecord(stage: string, rec: RtRecord): void {
  const home = LINKED_MAPS[stage];
  if (!home) return writeRaw(stage, rec);
  const sp = splitRecord(readRaw(home), rec);
  writeRaw(home, sp.home);
  writeRaw(stage, sp.own);
}

/**
 * 暫停選單的「下一個目標」（第 22 輪）：依進度給一句話。rec＝這張地圖的紀錄（共用地圖已 join），
 * otherKills＝下一張地圖（worldMaps 的 next）的 Boss 討伐次數；沒有下一張就不看。
 */
export function nextGoal(stage: string, rec: RtRecord, level: number, otherKills: number): string {
  const m = worldMap(stage);
  const nx = m?.next ? worldMap(m.next) : undefined;
  const boss = m?.boss ?? '';
  const bw = m?.bw ?? '';
  const mw = m?.mw ?? '';
  if (!(rec.bossKills ?? 0)) return m?.firstGoal ?? '';
  if (nx && !otherKills) return `前往${nx.name}，打倒${nx.boss}`;
  if (!furyUnlocked(rec, level)) return `升到 Lv${FURY_UNLOCK.level} 或討伐 ${boss} ${FURY_UNLOCK.kills} 次，開啟${bw}暴怒`;
  if (!(rec.furyKills ?? 0)) return `☰ 開啟「${bw}暴怒」並打倒牠（解鎖深夜的${mw}）`;
  return `刷深夜的${mw}、把裝備強化到 +10、挑戰最快討伐`;
}

/** 等級不夠時的小提示（第 30 輪，NEXT 第 3 項：新手沒裝備卡在荊棘谷）：還沒打倒這張圖的 Boss、等級低於建議等級才出現 */
export function levelTip(stage: string, rec: RtRecord, level: number): string | null {
  const m = worldMap(stage);
  if (!m?.recLevel || (rec.bossKills ?? 0) > 0 || level >= m.recLevel) return null;
  return `建議 Lv${m.recLevel}（現在 Lv${level}）：打不過就先刷怪升級、\n到營火找行商買裝備、把裝備強化`;
}

/** 大地圖開放條件（D-114／D-124）：第一張一開始就開；其他張要先打倒前一張圖的 Boss 一次 */
export function mapOpen(stage: string): boolean {
  const pv = prevMap(stage);
  if (!pv) return !!worldMap(stage);
  return (readRaw(pv.id).bossKills ?? 0) >= 1;
}

/** 荊棘谷開放條件（D-114）：霧語森林的狼王打倒過一次 */
export function thornvaleOpen(): boolean {
  return mapOpen('thornvale');
}

/** 某張地圖自己的 Boss 討伐次數（不經過共用合併） */
export function bossKillsOf(stage: string): number {
  return readRaw(stage).bossKills ?? 0;
}

/** 秒數 → 「4 分 05 秒」 */
export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m} 分 ${String(s).padStart(2, '0')} 秒` : `${s} 秒`;
}
