// 幕名卡的文字與「播過了沒」（D-187）；畫面在 ui/chapterCard.ts。不碰 Phaser，測試可以直接 import。
import { WORLD_MAPS, worldMap } from './worldMaps';

const NUM = ['一', '二', '三', '四', '五', '六'];

/** 每張圖的一句話（地圖說明大字講操作，這裡只講氣氛） */
const LINES: Record<string, string> = {
  mistwood: '停服那晚之後，醒來的第一片森林',
  thornvale: '荊棘會記得每一個闖進來的人',
  emberrift: '熔岩的盡頭，是這段旅程的終點',
  starfall: '故事結束之後，星星還在往下掉',
};

export interface ChapterLabel { kicker: string; title: string; line: string; color: string }

/** 「第 N 幕」＋地圖名＋一句話；通關後的挑戰地圖叫「番外」。不是大地圖回傳 null */
export function chapterLabel(id: string): ChapterLabel | null {
  const m = worldMap(id);
  if (!m) return null;
  const story = WORLD_MAPS.filter((w) => !w.postGame);
  const i = story.findIndex((w) => w.id === id);
  const kicker = m.postGame ? '番　外' : `第${NUM[i] ?? String(i + 1)}幕`;
  return { kicker, title: m.name, line: LINES[id] ?? '', color: m.color };
}

export function chapterSeen(id: string): boolean {
  try {
    return localStorage.getItem(`jg_chapter_${id}`) === '1';
  } catch {
    return true;
  }
}

export function markChapterSeen(id: string): void {
  try {
    localStorage.setItem(`jg_chapter_${id}`, '1');
  } catch {
    /* 私密模式：下次再播一次也沒關係 */
  }
}

