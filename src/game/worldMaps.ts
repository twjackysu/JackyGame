// 大地圖登記表（第 26 輪，D-124）：每張正式大地圖的稱呼、配色、開放順序都寫在這裡，
// 畫面與紀錄不再到處寫 `stageId === 'thornvale'`；之後加第三張地圖只要在這裡多一筆（加上地圖本身與敵人資料）。
import { makeMistwoodStage, MISTWOOD_KING } from '../core/battle/rt/maps/mistwood';
import { makeThornvaleStage, THORNVALE_QUEEN } from '../core/battle/rt/maps/thornvale';
import { EMBERRIFT_COLOSSUS, makeEmberriftStage } from '../core/battle/rt/maps/emberrift';
import { makeStarfallStage, STARFALL_SENTINEL } from '../core/battle/rt/maps/starfall';
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
  /** 第一次遇到 Boss 時的「前世攻略」提示（第 39 輪：以前四張圖都說「衝鋒撞到樹會暈」，但岩王、守望者根本不衝鋒） */
  bossTip: string;
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
  /** 石頭格的畫法：森林（樹冠）、荊棘（荊棘叢＋紅漿果）、燼岩（玄武岩＋熔岩裂紋）、星晶（藍紫晶簇） */
  decor: 'forest' | 'thorn' | 'ember' | 'star';
  /** 通關後才開放的挑戰地圖（D-138）：標題按鈕與開放提示用 */
  postGame?: boolean;
}

export const WORLD_MAPS: readonly WorldMap[] = [
  {
    id: 'mistwood', name: '霧語森林', make: makeMistwoodStage, bossAt: MISTWOOD_KING,
    boss: '霧角狼王', bw: '狼王', mw: '森林', lord: '霧語森林之主', color: '#d8ccff',
    firstKill: '首次討伐！森林安靜了一點…', bossTip: '（記得……牠衝鋒撞到樹或石頭會暈！）', phase2: ['狼王暴怒！', '#ff7a5a'], blink: ['狼王遁入霧中——小心背後！', '#c9b8ff'], blinkFx: [0xb9a8ff, 0x9a8cff, 0xd8ccff],
    firstGoal: '往北穿過森林，打倒霧角狼王', next: 'thornvale',
    palette: { ground: 0x16261c, spotA: 0x1a2c1f, spotB: 0x14231a, grass: 0x2f5a36, grid: 0x203a28, under: 0x0c170e, crownA: 0x1b3620, crownB: 0x203f25, crownHi: 0x2a5230, crownTop: 0x3d7042, edge: 0x5a8a60, mini: 0x1f3a26, miniSolid: 0x6c7378 }, decor: 'forest',
  },
  {
    id: 'thornvale', name: '荊棘谷', make: makeThornvaleStage, bossAt: THORNVALE_QUEEN,
    boss: '棘冠狼后', bw: '狼后', mw: '山谷', lord: '荊棘谷之主', color: '#c8ff8a',
    firstKill: '首次討伐！山谷的荊棘枯萎了一些…', bossTip: '（記得……狼后衝鋒撞到岩壁會暈很久！）', phase2: ['狼后怒放・荊棘綻放！', '#c8ff8a'], blink: ['狼后鑽進荊棘——小心背後！', '#c8ff8a'], blinkFx: [0x9adf5a, 0x6ac04a, 0xc8ff8a],
    firstGoal: '沿著山谷往北，打倒棘冠狼后', next: 'emberrift', recLevel: 6,
    palette: { ground: 0x2a1d19, spotA: 0x31221c, spotB: 0x241814, grass: 0x6a5232, grid: 0x382720, under: 0x160b10, crownA: 0x3a1828, crownB: 0x45202f, crownHi: 0x6a2c3e, crownTop: 0x9a4a55, edge: 0x8a5a48, mini: 0x3a2a22, miniSolid: 0x5a2838 }, decor: 'thorn',
  },
  {
    id: 'emberrift', name: '燼紅裂谷', make: makeEmberriftStage, bossAt: EMBERRIFT_COLOSSUS,
    boss: '燼心岩王', bw: '岩王', mw: '裂谷', lord: '燼紅裂谷之主', color: '#ffb36a',
    firstKill: '首次討伐！裂谷的熔岩暗了下來…', bossTip: '（記得……岩王很慢！紅圈跑出去，黃框的拳頭能格擋！）', phase2: ['岩王的熔心沸騰了！', '#ff8a3a'], blink: ['岩王沉入熔岩——小心背後！', '#ffb36a'], blinkFx: [0xff9a4a, 0xff6a2a, 0xffd08a],
    firstGoal: '穿過裂谷往北，打倒燼心岩王', next: 'starfall', recLevel: 10,
    palette: { ground: 0x1d1715, spotA: 0x241c19, spotB: 0x171210, grass: 0x5a3a24, grid: 0x2a201c, under: 0x0d0909, crownA: 0x2a2422, crownB: 0x332b28, crownHi: 0x463c38, crownTop: 0x6a5a52, edge: 0x8a4a2a, mini: 0x2e2420, miniSolid: 0x6a3a22 }, decor: 'ember',
  },
  // 第四張（D-138）：通關後的挑戰地圖。FINALE_MAP 固定在燼紅裂谷，所以接在後面不會改變結局
  {
    id: 'starfall', name: '星隕高原', make: makeStarfallStage, bossAt: STARFALL_SENTINEL,
    boss: '星骸守望者', bw: '守望者', mw: '高原', lord: '星隕高原之主', color: '#a8c8ff',
    firstKill: '首次討伐！墜落的星光安靜下來了…', bossTip: '（記得……守望者會瞬移到背後——牠一消失就轉身！）', phase2: ['守望者的星核亮了起來！', '#c8d8ff'], blink: ['守望者化成星光——小心背後！', '#c8d8ff'], blinkFx: [0x9ab8ff, 0x7a8aff, 0xe0e8ff],
    firstGoal: '穿過墜星原往北，打倒星骸守望者', recLevel: 14, postGame: true,
    palette: { ground: 0x141a2c, spotA: 0x182038, spotB: 0x101626, grass: 0x4a5a8a, grid: 0x1e2640, under: 0x0a0c18, crownA: 0x1e2046, crownB: 0x242650, crownHi: 0x2c3060, crownTop: 0x3a4078, edge: 0x6a7ac8, mini: 0x1e2440, miniSolid: 0x4a4a8a }, decor: 'star',
  },
];

/** 打倒這張圖的 Boss（第一次）會播通關演出（D-133）；之後加的挑戰地圖接在後面也不會改變結局 */
export const FINALE_MAP = 'emberrift';

export const worldMap = (id: string): WorldMap | undefined => WORLD_MAPS.find((m) => m.id === id);
/** 開放這張圖的前一張（第一張回傳 undefined） */
export const prevMap = (id: string): WorldMap | undefined => WORLD_MAPS.find((m) => m.next === id);
