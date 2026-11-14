import { describe, expect, it } from 'vitest';
import { LOBBY_NOTE, lobbyNoteY } from '../src/game/ui/lobbyNote';

describe('競技場大廳的規則說明放哪（第 203 輪）', () => {
  it('390×844：放到觀眾席花紋下面、按鈕上面，兩邊都不碰', () => {
    const r = lobbyNoteY(993, 1298, 112);
    expect(r.backed).toBe(false);
    expect(r.y - 56).toBeGreaterThanOrEqual(993 + LOBBY_NOTE.band);
    expect(r.y + 56).toBeLessThanOrEqual(1298);
  });
  it('360×640：下面放不下 → 留在原位，墊深色底', () => {
    const r = lobbyNoteY(854, 1020, 112);
    expect(r).toEqual({ y: 854 + LOBBY_NOTE.legacy, backed: true });
  });
});
