// 前世的記憶（第 29 輪，D-137）：每張大地圖藏三個「記憶」，走過去就想起前世玩這款遊戲時的一段事——
// 一半是故事（轉生的設定、停服前的回憶），一半是真的有用的攻略提示。純畫面層：不動核心、不影響 stateHash。
// 每想起一個拿 1 顆結晶，九個全想起來再拿 5 顆。存 localStorage `jg_memories`（id 陣列）。
export interface Memory {
  id: string;
  map: string;
  /** 格子座標（中心點＝格子 ×100＋50） */
  tx: number;
  ty: number;
  lines: string;
}

export const MEMORIES: readonly Memory[] = [
  { id: 'mw_camp', map: 'mistwood', tx: 34, ty: 91, lines: '前世第一次玩，在這裡被狼咬了十幾次。\n後來才懂：狼撲上來前，地上會先亮紅。' },
  { id: 'mw_den', map: 'mistwood', tx: 5, ty: 60, lines: '論壇置頂文：「狼群巢穴一次只拉一組。」\n不倒下一直打，首領就會被引出來。' },
  { id: 'mw_lair', map: 'mistwood', tx: 30, ty: 26, lines: '霧角狼王衝鋒撞上岩壁會暈。\n前世的第一次討伐，就是靠這招拿到的。' },
  { id: 'tv_slope', map: 'thornvale', tx: 11, ty: 62, lines: '攻略網站把荊棘坡叫做「新手墳場」。\n棘背狼的毒，回營火休息就會解。' },
  { id: 'tv_mother', map: 'thornvale', tx: 6, ty: 48, lines: '荊棘母樹的根系環——貼著樹反而安全。\n當年公會頻道吵了三天才有人發現。' },
  { id: 'tv_garden', map: 'thornvale', tx: 18, ty: 26, lines: '狼后鑽進荊棘之後，會從背後冒出來。\n聽到地底的沙沙聲，就轉身。' },
  { id: 'er_vents', map: 'emberrift', tx: 8, ty: 46, lines: '熔岩口噴發前，地面會越來越亮。\n把怪引過去燒——玩家都叫這招「烤狼」。' },
  { id: 'er_hall', map: 'emberrift', tx: 40, ty: 46, lines: '走噴口原還是黑曜長廊？\n前世的公會為了這個吵了一整晚。' },
  { id: 'er_throne', map: 'emberrift', tx: 23, ty: 26, lines: '燼心岩王從來沒出現在更新預告裡。\n停服前最後一次改版，他就站在這裡等。' },
];

export const MEMORY_REWARD = { each: 1, all: 5 } as const;
/** 走到幾格內就想起來 */
export const MEMORY_RADIUS = 2.2;

export const memoriesOf = (map: string): Memory[] => MEMORIES.filter((m) => m.map === map);

/** 讀已經想起來的記憶（壞資料、未知 id 丟掉） */
export function loadMemories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('jg_memories') ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const ok = new Set(MEMORIES.map((m) => m.id));
    return [...new Set(raw.filter((x): x is string => typeof x === 'string' && ok.has(x)))];
  } catch {
    return [];
  }
}

export function saveMemories(ids: readonly string[]): void {
  try {
    localStorage.setItem('jg_memories', JSON.stringify(ids));
  } catch {
    /* 無痕模式 */
  }
}

/** 想起一個記憶：回傳新的清單與這次拿到的結晶（已經有了回傳 null） */
export function recall(have: readonly string[], id: string): { ids: string[]; crystal: number; all: boolean } | null {
  if (have.includes(id) || !MEMORIES.some((m) => m.id === id)) return null;
  const ids = [...have, id];
  const all = ids.length === MEMORIES.length;
  return { ids, crystal: MEMORY_REWARD.each + (all ? MEMORY_REWARD.all : 0), all };
}
