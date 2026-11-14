/**
 * 競技場大廳那四行規則說明放哪（第 203 輪）。以前貼在場地下緣（下緣 +44 置中）：第一行壓在金色場框上、
 * 後三行壓在觀眾席那條花紋上，灰字疊在花紋上很難讀；而它下面到按鈕之間有一大塊空的。
 * 現在：下面的空位放得下就整段放到觀眾席下面、和按鈕之間置中；放不下（360×640 這種矮螢幕）留在原位，但墊一塊深色底。
 */
export const LOBBY_NOTE = {
  /** 觀眾席那條花紋從場地下緣往下多高 */
  band: 104,
  /** 和上下各至少留多少 */
  gap: 10,
  /** 放不下時的原位（場地下緣往下） */
  legacy: 44,
} as const;

export function lobbyNoteY(arenaBottom: number, btnTop: number, textH: number): { y: number; backed: boolean } {
  const top = arenaBottom + LOBBY_NOTE.band + LOBBY_NOTE.gap;
  const bottom = btnTop - LOBBY_NOTE.gap;
  if (bottom - top >= textH) return { y: Math.round((top + bottom) / 2), backed: false };
  return { y: arenaBottom + LOBBY_NOTE.legacy, backed: true };
}
