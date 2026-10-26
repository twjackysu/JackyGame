// 通關演出的文字與旅程統計（D-133）：純資料，不 import Phaser（測試用）。
import { WORLD_MAPS } from './worldMaps';
import { loadRecord, type RtRecord } from './rtRecord';
import { loadMemories, MEMORIES } from './memories';

/** 序章（D-134）：前世的設定，和結語前後呼應 */
export const PROLOGUE_LINES: readonly string[] = [
  '《星燼回響》——一款冷門的手機遊戲。',
  '全伺服器只有你一個人拿到全成就。',
  '停止營運的那天晚上，你最後一次\n打倒霧角狼王，然後睡著了。',
  '醒來的時候，營火在身邊劈啪作響。',
  '森林的氣味、遠處狼的低吼……\n全都是真的。',
  '——而你記得這裡的每一個秘密。',
];

export const FINALE_LINES: readonly string[] = [
  '霧散了。荊棘枯了。熔岩暗了下來。',
  '三片土地的主人，都倒在你的劍下。',
  '前世的你，就是在這裡關掉了遊戲——\n「第一章・完」，然後再也沒有更新。',
  '可是這一次，畫面沒有變黑。',
  '風從裂谷吹上來，帶著星燼的味道。\n地圖的邊緣之外，還有你不記得的路。',
  '——這個世界，還在等你。',
];

export const FINALE_CREDITS: readonly [string, string][] = [
  ['企劃・試玩・美術（AI 繪圖）', 'Jacky'],
  ['程式・關卡・數值・程式美術', 'Claude（Anthropic）\n每兩小時一輪的自動開發迴圈'],
  ['引擎與工具', 'Phaser 3・TypeScript・Vite\nCapacitor・Vitest・Playwright'],
  ['音樂與音效', 'WebAudio 即時合成（沒有任何音檔）'],
  ['特別感謝', '每一位把狼王打到暈過去的玩家'],
];

export interface BossLine { name: string; map: string; first?: number; best?: number; kills: number; color: string }
export const MEMORY_TOTAL = MEMORIES.length;

export interface FinaleStats {
  bosses: BossLine[];
  level: number;
  playSec: number;
  kills: number;
  chests: number;
  cardsWon: number;
  /** 前世的記憶（D-137）想起幾個 */
  memories: number;
}

/** 從各地圖紀錄算出這趟旅程（純函式，有測試） */
export function finaleStats(recs: Record<string, RtRecord>, cardsWon = 0, memories = 0): FinaleStats {
  const home = recs[WORLD_MAPS[0]!.id] ?? {};
  return {
    bosses: WORLD_MAPS.map((m) => {
      const r = recs[m.id] ?? {};
      return { name: m.boss, map: m.name, first: r.firstAt, best: r.bestBossSec, kills: r.bossKills ?? 0, color: m.color };
    }),
    level: home.level ?? 1,
    playSec: home.playSec ?? 0,
    kills: home.kills ?? 0,
    chests: WORLD_MAPS.reduce((n, m) => n + (recs[m.id]?.chests?.length ?? 0), 0),
    cardsWon,
    memories,
  };
}

/** 遊玩時間：「3 小時 05 分」或「42 分」 */
export function fmtPlay(sec: number): string {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小時 ${String(m % 60).padStart(2, '0')} 分` : `${m} 分`;
}

/** 讀 localStorage 的版本（畫面用） */
export function loadFinaleStats(): FinaleStats {
  const recs: Record<string, RtRecord> = {};
  for (const m of WORLD_MAPS) recs[m.id] = loadRecord(m.id);
  let won = 0;
  try {
    const c = JSON.parse(localStorage.getItem('jg_cards') ?? '{}') as { won?: unknown };
    won = typeof c.won === 'number' ? c.won : 0;
  } catch {
    /* 無痕模式 */
  }
  return finaleStats(recs, won, loadMemories().length);
}

export function finaleSeen(): boolean {
  try {
    return localStorage.getItem('jg_finale_seen') === '1';
  } catch {
    return false;
  }
}
export function markFinaleSeen(): void {
  try {
    localStorage.setItem('jg_finale_seen', '1');
  } catch {
    /* 無痕模式 */
  }
}


export function prologueSeen(): boolean {
  try {
    return localStorage.getItem('jg_prologue_seen') === '1';
  } catch {
    return true;
  }
}
export function markPrologueSeen(): void {
  try {
    localStorage.setItem('jg_prologue_seen', '1');
  } catch {
    /* 無痕模式 */
  }
}
