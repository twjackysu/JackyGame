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
  /** 上次休息的營火（第 89 輪，D-230）：下次進這張圖（不是走光門來的）就從這裡出發 */
  fire?: string;
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

/** 暴怒狼王解鎖條件（D-099）：Lv8 以上或狼王討伐 3 次。
 * 第 100 輪（D-247）：都要先打倒這張圖的 Boss 一次——以前 Lv8 就算，第一次走進燼紅裂谷（建議 Lv10）、星隕高原時
 * 連岩王／守望者的面都沒見過，☰ 已經有「岩王暴怒：關」可以打開（第一次就打暴怒版），荊棘谷升到 Lv8 也跳「解鎖：狼后暴怒！」。 */
export const FURY_UNLOCK = { level: 8, kills: 3 } as const;
export function furyUnlocked(rec: RtRecord, level: number): boolean {
  const k = rec.bossKills ?? 0;
  return k >= 1 && (level >= FURY_UNLOCK.level || k >= FURY_UNLOCK.kills);
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
export const MAP_KEYS = ['bossKills', 'firstAt', 'bestBossSec', 'chests', 'fury', 'furyKills', 'night', 'fire'] as const satisfies readonly (keyof RtRecord)[];
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

const NUM_KEYS = ['bossKills', 'firstAt', 'bestBossSec', 'kills', 'coin', 'dust', 'crystal', 'runs', 'playSec', 'level', 'xp', 'furyKills'] as const;
const BOOL_KEYS = ['fury', 'night'] as const;
const okNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/**
 * 第 112 輪（D-260）：讀檔時檢查基本欄位的型別。以前存檔被弄壞（例如 level 變成字串）會讓 HUD 顯示「Lv NaN・HP NaN/NaN」
 * 而且一路存回去；現在型別不對的欄位直接丟掉（當成沒有），其他欄位照用。形狀複雜的欄位（行囊、技能、懸賞、行商）各自另有 clean*。
 */
export function sanitizeRecord(raw: unknown): RtRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = { ...(raw as Record<string, unknown>) };
  for (const k of NUM_KEYS) if (out[k] !== undefined && !okNum(out[k])) delete out[k];
  if (okNum(out.level)) out.level = Math.max(1, Math.floor(out.level));
  for (const k of BOOL_KEYS) if (out[k] !== undefined && typeof out[k] !== 'boolean') delete out[k];
  if (out.fire !== undefined && typeof out.fire !== 'string') delete out.fire;
  if (out.chests !== undefined) {
    if (Array.isArray(out.chests)) out.chests = out.chests.filter((c) => typeof c === 'string');
    else delete out.chests;
  }
  if (out.spent !== undefined) {
    const sp = out.spent;
    if (!sp || typeof sp !== 'object' || Array.isArray(sp)) delete out.spent;
    else {
      const o: Record<string, number> = {};
      for (const [k, v] of Object.entries(sp as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) o[k] = v; // 分解會記成負的花費
      out.spent = o;
    }
  }
  return out as RtRecord;
}

function readRaw(stage: string): RtRecord {
  try {
    return sanitizeRecord(JSON.parse(localStorage.getItem(`jg_rt_${stage}`) ?? '{}') as unknown);
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
export function nextGoal(stage: string, rec: RtRecord, level: number, otherKills: number, frontier?: string): string {
  const m = worldMap(stage);
  // 第 100 輪（D-248）：frontier＝往後第一張還沒打倒 Boss 的地圖。以前只看下一張——打完荊棘谷回霧語森林，
  // 目標寫「☰ 開啟狼王暴怒」（主線還沒走完就叫人刷暴怒），現在寫「前往燼紅裂谷，打倒燼心岩王」
  const fx = frontier && frontier !== m?.next ? worldMap(frontier) : undefined;
  if ((rec.bossKills ?? 0) && fx) return `前往${fx.name}，打倒${fx.boss}`;
  const nx = m?.next ? worldMap(m.next) : undefined;
  const boss = m?.boss ?? '';
  const bw = m?.bw ?? '';
  const mw = m?.mw ?? '';
  if (!(rec.bossKills ?? 0)) return m?.firstGoal ?? '';
  if (nx && !otherKills) return `前往${nx.name}，打倒${nx.boss}`;
  if (!furyUnlocked(rec, level)) return `升到 Lv${FURY_UNLOCK.level} 或討伐 ${boss} ${FURY_UNLOCK.kills} 次，開啟${bw}暴怒`;
  // 第 51 輪：暴怒已經開著還叫人「☰ 開啟」很怪 → 直接說打倒暴怒版
  if (!(rec.furyKills ?? 0)) return rec.fury ? `打倒暴怒的${bw}（解鎖深夜的${mw}）` : `☰ 開啟「${bw}暴怒」並打倒牠（解鎖深夜的${mw}）`;
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

/** 往後第一張還沒打倒 Boss、而且已經開放的地圖（D-248，給 nextGoal 的 frontier）；沒有就 undefined */
export function frontierAfter(stage: string): string | undefined {
  for (let id = worldMap(stage)?.next, n = 0; id && n < 10; id = worldMap(id)?.next, n++) if (mapOpen(id) && !bossKillsOf(id)) return id;
  return undefined;
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

/**
 * 老玩家的開場大字（第 44 輪）：這張圖的 Boss 已經打倒過，就不再播第一次的教學（「往北穿過森林…撿到裝備去行囊換上」），
 * 改成「歡迎回到○○！」＋下一個目標。目標太長就在「、」「，」之後或「（」之前斷行，每行不超過 maxLine 字（置中大字 30px 在 720 寬放得下）。
 * 第一次（還沒打倒 Boss）回 null，照舊用地圖的 intro。
 */
export function returnIntro(stage: string, rec: RtRecord, level: number, otherKills: number, frontier?: string, maxLine = 22): string | null {
  const m = worldMap(stage);
  if (!m || !(rec.bossKills ?? 0)) return null;
  const goal = `▶ ${nextGoal(stage, rec, level, otherKills, frontier)}`;
  const lines: string[] = [];
  let cur = '';
  for (const part of goal.split(/(?<=[、，])|(?=（)/)) {
    if (cur && [...cur + part].length > maxLine) {
      lines.push(cur.replace(/[、，]$/, ''));
      cur = part;
    } else cur += part;
  }
  if (cur) lines.push(cur);
  return [`歡迎回到${m.name}！`, ...lines].join('\n');
}

/** 從 ☰ 切到深夜重新進入（第 59 輪）：第一行「歡迎回到○○！」換成「深夜的○○・怪更兇、掉得更好」，目標照舊 */
export function nightIntro(intro: string, mapName: string): string {
  return intro.replace(/^[^\n]*/, `深夜的${mapName}・怪更兇、掉得更好`);
}
