// 大地圖登記表（第 26 輪，D-124）：每張正式大地圖的稱呼、配色、開放順序都寫在這裡，
// 畫面與紀錄不再到處寫 `stageId === 'thornvale'`；之後加第三張地圖只要在這裡多一筆（加上地圖本身與敵人資料）。
import { makeMistwoodStage, MISTWOOD_KING } from '../core/battle/rt/maps/mistwood';
import { makeThornvaleStage, THORNVALE_QUEEN } from '../core/battle/rt/maps/thornvale';
import type { StageDefinition } from '../core/battle/rt/types';

/** 地面分塊與小地圖的配色 */
export interface MapPalette {
  ground: number; spotA: number; spotB: number; grass: number; grid: number; under: number;
  crownA: number; crownB: number; crownHi: number; crownTop: number; edge: number;
  /** 小地圖：地面、石頭 */
  mini: number; miniSolid: number;
}

export interface WorldMap {
  id: string;
  /** 地圖名（標題按鈕「前往○○」、☰ 往返） */
  name: string;
  make: () => StageDefinition;
  /** Bot 前進的目標（Boss 巢穴） */
  bossAt: { x: number; y: number };
  /** Boss 全名／簡稱、地形稱呼（森林／山谷） */
  boss: string;
  bw: string;
  mw: string;
  /** Boss 登場名牌的副標與顏色 */
  lord: string;
  color: string;
  /** 首次討伐的大字 */
  firstKill: string;
  /** 第二階段、遁地（瞬移）大字＋顏色 */
  phase2: [string, string];
  blink: [string, string];
  /** 瞬移特效顏色：出發點火花、出發點環、到達點火花 */
  blinkFx: [number, number, number];
  /** 還沒打倒 Boss 時的「下一個目標」 */
  firstGoal: string;
  /** 打倒這張圖的 Boss 一次後開放的下一張圖 */
  next?: string;
  /** 建議等級（開放提示用） */
  recLevel?: number;
  palette: MapPalette;
  /** 石頭格的畫法：森林（樹冠）、荊棘（荊棘叢＋紅漿果） */
  decor: 'forest' | 'thorn';
}

export const WORLD_MAPS: readonly WorldMap[] = [
  {
    id: 'mistwood', name: '霧語森林', make: makeMistwoodStage, bossAt: MISTWOOD_KING,
    boss: '霧角狼王', bw: '狼王', mw: '森林', lord: '霧語森林之主', color: '#d8ccff',
    firstKill: '首次討伐！森林安靜了一點…', phase2: ['狼王暴怒！', '#ff7a5a'], blink: ['狼王遁入霧中——小心背後！', '#c9b8ff'], blinkFx: [0xb9a8ff, 0x9a8cff, 0xd8ccff],
    firstGoal: '往北穿過森林，打倒霧角狼王', next: 'thornvale',
    palette: { ground: 0x16261c, spotA: 0x1a2c1f, spotB: 0x14231a, grass: 0x2f5a36, grid: 0x203a28, under: 0x0c170e, crownA: 0x1b3620, crownB: 0x203f25, crownHi: 0x2a5230, crownTop: 0x3d7042, edge: 0x5a8a60, mini: 0x1f3a26, miniSolid: 0x6c7378 }, decor: 'forest',
  },
  {
    id: 'thornvale', name: '荊棘谷', make: makeThornvaleStage, bossAt: THORNVALE_QUEEN,
    boss: '棘冠狼后', bw: '狼后', mw: '山谷', lord: '荊棘谷之主', color: '#c8ff8a',
    firstKill: '首次討伐！山谷的荊棘枯萎了一些…', phase2: ['狼后怒放・荊棘綻放！', '#c8ff8a'], blink: ['狼后鑽進荊棘——小心背後！', '#c8ff8a'], blinkFx: [0x9adf5a, 0x6ac04a, 0xc8ff8a],
    firstGoal: '沿著山谷往北，打倒棘冠狼后', recLevel: 6,
    palette: { ground: 0x2a1d19, spotA: 0x31221c, spotB: 0x241814, grass: 0x6a5232, grid: 0x382720, under: 0x160b10, crownA: 0x3a1828, crownB: 0x45202f, crownHi: 0x6a2c3e, crownTop: 0x9a4a55, edge: 0x8a5a48, mini: 0x3a2a22, miniSolid: 0x5a2838 }, decor: 'thorn',
  },
];

export const worldMap = (id: string): WorldMap | undefined => WORLD_MAPS.find((m) => m.id === id);
/** 開放這張圖的前一張（第一張回傳 undefined） */
export const prevMap = (id: string): WorldMap | undefined => WORLD_MAPS.find((m) => m.next === id);
