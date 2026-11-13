/**
 * 頂端「目標」字條什麼時候收起來（第 194 輪）：老玩家回到打過的地圖，字條常駐兩行長字
 * （「…可以再挑戰／▶ 刷深夜的高原、把裝備強化到 +10…」），一直蓋著畫面上緣的怪和箭頭。
 * 規則：新玩家的「目標：往北，打倒…」一直留著；老玩家的講幾秒就淡掉；這一趟第一次打倒 Boss 後的「下一個目標」留久一點。
 * 字換了（打倒 Boss、開了新目標）會重新亮起來。完整內容在選單的「下一個目標」那一行一直看得到。純畫面。
 */
export const GOAL_FADE = {
  /** 老玩家：進圖／字換了之後留幾毫秒 */
  vetMs: 8000,
  /** 這一趟才第一次打倒 Boss：下一個目標留幾毫秒 */
  firstKillMs: 25000,
  /** 淡出花多久 */
  fadeMs: 600,
} as const;

export interface GoalFadeIn {
  /** 進圖時就已經打倒過這張圖的 Boss */
  veteran: boolean;
  /** 這一趟已經打倒 Boss（字條是「✔ 已討伐／▶ 下一個目標」） */
  done: boolean;
  /** 目前這段字已經顯示多久（毫秒） */
  ageMs: number;
}

/** 字條的透明度 0～1；0＝收起來（不佔位置，箭頭可以用那一塊） */
export function goalAlpha(q: GoalFadeIn): number {
  const hold = q.veteran ? GOAL_FADE.vetMs : q.done ? GOAL_FADE.firstKillMs : Infinity;
  if (q.ageMs <= hold) return 1;
  return Math.max(0, 1 - (q.ageMs - hold) / GOAL_FADE.fadeMs);
}
