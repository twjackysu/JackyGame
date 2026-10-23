// 節點地圖資料（07 §2）：每章的地點座標、路徑、完成旗標與標籤。MapScene 依目前章節選用。
import { CH1_ENTRIES } from './dialogue/ch1';
import { CH2_ENTRIES } from './dialogue/ch2';
import { CH3_ENTRIES } from './dialogue/ch3';
import { CH4_ENTRIES } from './dialogue/ch4';
import { CH5_ENTRIES } from './dialogue/ch5';

export type ChapterId = 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5';

export interface ChapterMap {
  id: ChapterId;
  title: string;
  entries: typeof CH1_ENTRIES;
  pos: Record<string, [number, number]>;
  edges: [string, string][];
  /** 地點完成旗標（決定「！」提示與目標文字） */
  done: Record<string, string>;
  /** 預設的玩家位置（地點 id） */
  start: string;
  completeFlag: string;
  labels: { text: string; x: number; y: number; color: string }[];
}

export const CHAPTER_MAPS: Record<ChapterId, ChapterMap> = {
  ch1: {
    id: 'ch1',
    title: '第一章　灰燈鎮周邊',
    entries: CH1_ENTRIES,
    pos: {
      orphanage: [150, 330], tavern: [360, 290], general_store: [575, 330], town_gate: [360, 455],
      forest_edge: [360, 600], mist_lake: [145, 715], hunter_hut: [575, 715], wolf_path: [360, 820],
      lighthouse: [140, 945], campfire: [580, 935], fallen_log: [620, 1050], wolf_den: [360, 1060],
    },
    edges: [
      ['orphanage', 'tavern'], ['tavern', 'general_store'], ['tavern', 'town_gate'], ['town_gate', 'forest_edge'],
      ['forest_edge', 'mist_lake'], ['forest_edge', 'hunter_hut'], ['mist_lake', 'wolf_path'], ['hunter_hut', 'wolf_path'],
      ['wolf_path', 'lighthouse'], ['wolf_path', 'campfire'], ['campfire', 'fallen_log'], ['lighthouse', 'wolf_den'],
      ['campfire', 'wolf_den'],
    ],
    done: {
      orphanage: 'ch1_got_lantern', tavern: 'ch1_rourke_joined', town_gate: 'ch1_left_town', forest_edge: 'ch1_caravan_done',
      mist_lake: 'ch1_io_joined', hunter_hut: 'wick_hunter', wolf_path: 'ch1_path_cleared', lighthouse: 'ch1_legacy',
      campfire: 'ch1_campfire', wolf_den: 'ch1_complete', fallen_log: 'ch1_fallen_log',
    },
    start: 'orphanage',
    completeFlag: 'ch1_complete',
    labels: [
      { text: '灰燈鎮', x: 30, y: 210, color: '#ffcf96' },
      { text: '霧角森林', x: 30, y: 540, color: '#9fd8d0' },
    ],
  },
  ch2: {
    id: 'ch2',
    title: '第二章　沉鐘礦坑',
    entries: CH2_ENTRIES,
    pos: {
      greylamp_plaza: [360, 290], miners_camp: [360, 450], upper_tunnel: [190, 580], mid_tunnel: [500, 680],
      bell_hall: [300, 800], mine_campfire: [570, 870], ore_cart: [610, 1010], deep_level: [190, 960],
      bell_throat: [380, 1060],
    },
    edges: [
      ['greylamp_plaza', 'miners_camp'], ['miners_camp', 'upper_tunnel'], ['upper_tunnel', 'mid_tunnel'],
      ['mid_tunnel', 'bell_hall'], ['bell_hall', 'mine_campfire'], ['mine_campfire', 'ore_cart'],
      ['mine_campfire', 'deep_level'], ['deep_level', 'bell_throat'],
    ],
    done: {
      greylamp_plaza: 'ch2_serin_joined', miners_camp: 'ch2_camp_done', upper_tunnel: 'ch2_liora_joined',
      mid_tunnel: 'ch2_mid_cleared', bell_hall: 'ch2_bell_done', mine_campfire: 'ch2_campfire', ore_cart: 'ch2_ore_cart',
      deep_level: 'ch2_deep_done', bell_throat: 'ch2_complete',
    },
    start: 'greylamp_plaza',
    completeFlag: 'ch2_complete',
    labels: [
      { text: '灰燈鎮', x: 30, y: 210, color: '#ffcf96' },
      { text: '沉鐘礦坑', x: 30, y: 400, color: '#d8a878' },
    ],
  },
  ch3: {
    id: 'ch3',
    title: '第三章　王都星冠城',
    entries: CH3_ENTRIES,
    pos: {
      capital_gate: [360, 300], crown_plaza: [360, 470], rourke_lodging: [150, 600], tourney_hall: [570, 600],
      night_market: [160, 780], academy: [560, 820], inn_night: [300, 930], rooftop: [470, 1040], crown_plaza_dawn: [200, 1060],
    },
    edges: [
      ['capital_gate', 'crown_plaza'], ['crown_plaza', 'rourke_lodging'], ['crown_plaza', 'tourney_hall'],
      ['rourke_lodging', 'night_market'], ['tourney_hall', 'academy'], ['night_market', 'inn_night'], ['academy', 'inn_night'],
      ['inn_night', 'rooftop'], ['rooftop', 'crown_plaza_dawn'],
    ],
    done: {
      capital_gate: 'ch3_entered', crown_plaza: 'ch3_plaza_done', rourke_lodging: 'ch3_rourke_met', tourney_hall: 'ch3_tourney_done',
      night_market: 'ch3_market_done', academy: 'ch3_academy_done', inn_night: 'ch3_betrayal', rooftop: 'ch3_duel_done',
      crown_plaza_dawn: 'ch3_complete',
    },
    start: 'capital_gate',
    completeFlag: 'ch3_complete',
    labels: [
      { text: '星冠城', x: 30, y: 210, color: '#ffd27a' },
      { text: '城中區・夜', x: 30, y: 540, color: '#b8c4ff' },
    ],
  },
  ch4: {
    id: 'ch4',
    title: '第四章　研究院地下',
    entries: CH4_ENTRIES,
    pos: {
      academy_entrance: [360, 320], archive: [180, 520], holding_cells: [550, 560], lab: [360, 740], hidden_camp: [170, 900],
      star_furnace: [400, 1060],
    },
    edges: [
      ['academy_entrance', 'archive'], ['academy_entrance', 'holding_cells'], ['archive', 'lab'], ['holding_cells', 'lab'],
      ['lab', 'hidden_camp'], ['hidden_camp', 'star_furnace'],
    ],
    done: {
      academy_entrance: 'ch4_entered', archive: 'ch4_archive_done', holding_cells: 'ch4_cells_done', lab: 'ch4_lab_done',
      hidden_camp: 'ch4_campfire', star_furnace: 'ch4_complete',
    },
    start: 'academy_entrance',
    completeFlag: 'ch4_complete',
    labels: [
      { text: '星術研究院', x: 30, y: 210, color: '#c8d4ff' },
      { text: '地下', x: 30, y: 450, color: '#c8a0ff' },
    ],
  },
  ch5: {
    id: 'ch5',
    title: '終章　墜星裂谷',
    entries: CH5_ENTRIES,
    pos: { rift_edge: [360, 360], last_campfire: [360, 700], rift_core: [360, 1040] },
    edges: [['rift_edge', 'last_campfire'], ['last_campfire', 'rift_core']],
    done: { rift_edge: 'ch5_descent', last_campfire: 'ch5_vow', rift_core: 'ch5_complete' },
    start: 'rift_edge',
    completeFlag: 'ch5_complete',
    labels: [{ text: '墜星裂谷', x: 30, y: 210, color: '#ffb0d8' }],
  },
};

/** 目前章節：前一章完成後進入下一章地圖。 */
export function currentChapter(flags: Record<string, unknown>): ChapterId {
  return flags['ch4_complete'] ? 'ch5' : flags['ch3_complete'] ? 'ch4' : flags['ch2_complete'] ? 'ch3' : flags['ch1_complete'] ? 'ch2' : 'ch1';
}
