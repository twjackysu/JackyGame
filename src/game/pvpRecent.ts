// 競技場戰績的顯示小工具（第 150 輪）：純函式，畫面和測試共用。
import type { PvpRecentView } from '../net/views';

/** 一場的結果：一個字＋顏色（勝金、敗紅、和灰） */
export function recentLook(outcome: PvpRecentView['outcome']): { ch: string; color: string } {
  if (outcome === 'victory') return { ch: '勝', color: '#ffd27a' };
  if (outcome === 'defeat') return { ch: '敗', color: '#ff8a7a' };
  return { ch: '和', color: '#9aa4b8' };
}

/** 多久以前（剛剛／N 分鐘前／N 小時前／N 天前）；時鐘倒退也當「剛剛」 */
export function agoText(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  return `${Math.floor(h / 24)} 天前`;
}

/**
 * 結果畫面的連勝／今日首勝字（第 151 輪，D-324；伺服器算的，只是外觀）：沒有就空字串。
 * 首勝和連勝同時有 → 「今日首勝！・3 連勝」；連勝 2 場起才說。
 */
export function streakLine(r: { outcome: PvpRecentView['outcome']; streak: number; firstWin: boolean }): string {
  if (r.outcome !== 'victory') return '';
  const parts = [r.firstWin ? '今日首勝！' : '', r.streak >= 2 ? `${r.streak} 連勝` : ''].filter(Boolean);
  return parts.join('・');
}
