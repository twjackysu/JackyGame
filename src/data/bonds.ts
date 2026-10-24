// 同伴羈絆（03 §同伴關係線）：事件清單、階段稱號、心情台詞。羈絆面板與片尾使用。
import type { GameState } from '../core/state/gameState';

export type BondCompanion = 'io' | 'serin' | 'liora' | 'rourke';

export interface BondEvent {
  flag: string;
  title: string;
  /** 未解鎖時顯示的提示 */
  hint: string;
}

export interface BondDef {
  id: BondCompanion;
  name: string;
  epithet: string;
  events: BondEvent[];
  /** 依階段（0–4）的心情台詞 */
  moods: [string, string, string, string, string];
}

export const BOND_TIERS = ['初識', '同行者', '戰友', '知己', '心之所向'] as const;

export const BONDS: BondDef[] = [
  {
    id: 'io', name: '伊歐', epithet: '霧湖的歌姬',
    events: [
      { flag: 'bond_io_1', title: '五個音', hint: '第一章・營火' },
      { flag: 'io_rescued', title: '再一次，找到你', hint: '第四章・星核爐' },
      { flag: 'vow_io', title: '心之約定', hint: '終章・最後的營火' },
    ],
    moods: ['……你是誰？', '我會記住你的名字。', '跟著你的燈走，就不會迷路。', '連恩的聲音，我全部都記得。', '明天、後天，我都想待在你旁邊。'],
  },
  {
    id: 'serin', name: '瑟琳', epithet: '被逐出家門的騎士',
    events: [
      { flag: 'bond_serin_1', title: '被看見的強', hint: '第二章・礦坑營火' },
      { flag: 'bond_serin_2', title: '留到最後', hint: '第三章・燼牌大賽' },
      { flag: 'bond_serin_3', title: '劍的重量', hint: '第四章・通風井營火' },
      { flag: 'vow_serin', title: '日出之約', hint: '終章・最後的營火' },
    ],
    moods: ['別拖我後腿。', '……還算可以。', '背後交給我。', '你選的路，我會一起走。', '約好的日出，一起看。'],
  },
  {
    id: 'liora', name: '莉歐拉', epithet: '愛爆炸的發明家',
    events: [
      { flag: 'bond_liora_1', title: '鐘聲與火藥', hint: '第二章・礦坑營火' },
      { flag: 'bond_liora_2', title: '夜市的攤位', hint: '第三章・夜市' },
      { flag: 'bond_liora_3', title: '燒掉，還是留下', hint: '第四章・檔案室' },
      { flag: 'vow_liora', title: '不會爆炸的東西', hint: '終章・最後的營火' },
    ],
    moods: ['要不要試試我的新發明？', '你這人，還挺耐炸的。', '下一個發明，第一個給你看。', '……謝謝你沒有把我當瘋子。', '我的攤位，招牌要寫你的名字。'],
  },
  {
    id: 'rourke', name: '洛克', epithet: '提著斧槍的老兵',
    events: [
      { flag: 'bond_rourke_1', title: '沒人對我說過', hint: '第一章・營火' },
      { flag: 'bond_rourke_2', title: '認得路的人', hint: '第三章・王都' },
      { flag: 'bond_rourke_3', title: '鐘塔屋頂', hint: '第三章・決鬥之後' },
    ],
    moods: ['小鬼，別死了。', '……你這燈，還挺亮的。', '老骨頭還能替你擋幾下。', '欠你的，我會還。', '全押了，小子。'],
  },
];

/** 羈絆階段 0–4：好感每 25 一階，已完成事件數至少要跟上（避免只靠刷好感） */
export function bondTier(s: GameState, b: BondDef): number {
  const aff = s.affinity[b.id] ?? 0;
  const done = b.events.filter((e) => s.flags[e.flag]).length;
  return Math.max(0, Math.min(4, Math.floor(aff / 25), done + 1));
}

export function bondMet(s: GameState, b: BondDef): boolean {
  return s.party.includes(b.id) || (s.affinity[b.id] ?? 0) > 0 || b.events.some((e) => s.flags[e.flag]);
}
