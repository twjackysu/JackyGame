// 即時戰鬥大地圖的獨立紀錄（D-087）：跨場累計，只存在 localStorage `jg_rt_<stage>`，不碰主線 session 存檔。
// 純資料函式放這裡（有測試），讀寫 localStorage 的包一層 try/catch（無痕模式）。
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
export function recordBoss(rec: RtRecord, sec: number | null, at: number): { rec: RtRecord; first: boolean; best: boolean } {
  const first = !rec.bossKills;
  const out: RtRecord = { ...rec, bossKills: (rec.bossKills ?? 0) + 1, firstAt: rec.firstAt ?? at };
  let best = false;
  if (sec !== null && (rec.bestBossSec === undefined || sec < rec.bestBossSec)) {
    out.bestBossSec = Math.round(sec);
    best = rec.bestBossSec !== undefined;
  }
  return { rec: out, first, best };
}

export function loadRecord(stage: string): RtRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(`jg_rt_${stage}`) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as RtRecord) : {};
  } catch {
    return {};
  }
}

export function saveRecord(stage: string, rec: RtRecord): void {
  try {
    localStorage.setItem(`jg_rt_${stage}`, JSON.stringify(rec));
  } catch {
    /* 無痕模式：這場的紀錄就不保留 */
  }
}

/** 秒數 → 「4 分 05 秒」 */
export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m} 分 ${String(s).padStart(2, '0')} 秒` : `${s} 秒`;
}
