// 片尾字幕與旅程統計（終幕之後捲動）。純函式：由存檔產生要顯示的文字列。
import type { GameState } from '../core/state/gameState';

export const ENDING_NAME: Record<string, string> = { light: '燈火長明', crown: '新的大司星', dream: '餘燼之夢' };

const num = (s: GameState, k: string): number => {
  const v = s.flags[k];
  return typeof v === 'number' ? v : 0;
};

export function formatPlayTime(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} 小時 ${m % 60} 分` : `${m} 分鐘`;
}

export interface CreditLine {
  text: string;
  kind: 'title' | 'head' | 'stat' | 'body' | 'gap';
}

export function creditsLines(s: GameState): CreditLine[] {
  const ending = ENDING_NAME[String(s.flags['ending'])] ?? '？';
  const bonds = (['serin', 'liora', 'rourke', 'io'] as const)
    .filter((c) => s.affinity[c] !== undefined)
    .map((c) => `${{ serin: '瑟琳', liora: '莉歐拉', rourke: '洛克', io: '伊歐' }[c]} ${'♥'.repeat(Math.min(5, Math.floor((s.affinity[c] ?? 0) / 20)))}`);
  return [
    { text: '星燼回響', kind: 'title' },
    { text: 'Echoes of Starfall', kind: 'body' },
    { text: '', kind: 'gap' },
    { text: `結局「${ending}」`, kind: 'head' },
    { text: '', kind: 'gap' },
    { text: '── 你的旅程 ──', kind: 'head' },
    { text: `遊玩時間　${formatPlayTime(s.playTimeMs)}`, kind: 'stat' },
    { text: `戰鬥勝利　${num(s, 'stat_wins')} 場`, kind: 'stat' },
    { text: `PERFECT　${num(s, 'stat_perfect')} 次`, kind: 'stat' },
    { text: `點亮的燈印　${num(s, 'stat_lamps')} 盞`, kind: 'stat' },
    { text: `最大共鳴　${num(s, 'stat_max_resonance')} 燈`, kind: 'stat' },
    { text: `劇情偏移　${s.divergence}%`, kind: 'stat' },
    { text: `攻略筆記　${s.codex.length} 頁`, kind: 'stat' },
    ...(bonds.length ? [{ text: '', kind: 'gap' as const }, { text: '── 羈絆 ──', kind: 'head' as const }, ...bonds.map((b) => ({ text: b, kind: 'stat' as const }))] : []),
    { text: '', kind: 'gap' },
    { text: '── 製作 ──', kind: 'head' },
    { text: '企劃・程式・劇本・美術・音樂', kind: 'body' },
    { text: 'Claude（自動開發迴圈）', kind: 'stat' },
    { text: '為 Jacky 打造', kind: 'body' },
    { text: '', kind: 'gap' },
    { text: '所有角色、劇情、卡牌與音樂皆為原創', kind: 'body' },
    { text: '美術與音效全部由程式即時生成', kind: 'body' },
    { text: '', kind: 'gap' },
    { text: '謝謝你，一路提著燈。', kind: 'head' },
  ];
}
