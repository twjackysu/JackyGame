// 精英／巡守倒下的演出（第 151 輪 Q5 拆場景，從 RtBattleScene 的 death 事件原封不動搬成資料表）：
// 鏡頭震動＋衝擊環（可以兩圈）＋火花＋置中「○○ 倒下了！」。Boss 倒下走場景的 bossSlain，不在這裡。
import type Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { bigText, shockRing, sparks } from './feel';

interface Fall {
  /** 鏡頭震動 [毫秒, 強度] */
  shake: [number, number];
  /** 衝擊環 [顏色, 半徑, 毫秒, 粗細]，依序畫 */
  rings: [number, number, number, number][];
  /** 火花 [數量, 貼圖, 顏色, 速度] */
  sparks: [number, string, number, number];
  color: string;
  size: number;
  /** 大字用的名字（沒寫就用敵人資料的名字） */
  name?: string;
}

const MAGMA: Fall = { shake: [180, 0.006], rings: [[0xff6a2a, 190, 500, 9]], sparks: [24, 'ember', 0xffa050, 640], color: '#ffa868', size: 44 };
const ASTRAL: Fall = { shake: [180, 0.006], rings: [[0x8aa8ff, 190, 500, 9], [0xffffff, 110, 300, 4]], sparks: [24, 'spark', 0xc8d8ff, 640], color: '#c8d8ff', size: 44 };

const FALLS: Readonly<Record<string, Fall>> = {
  // 荊棘母樹倒下（D-107）：綠色衝擊波＋葉片＋大字
  thorn_mother: { shake: [220, 0.007], rings: [[0x6aff7a, 220, 560, 10]], sparks: [26, 'ember', 0x9aff7a, 700], color: '#9aff8a', size: 46, name: '荊棘母樹' },
  thorn_stalker: { shake: [180, 0.006], rings: [[0xff8a5c, 180, 480, 8]], sparks: [22, 'ember', 0xffa07a, 600], color: '#ffb07a', size: 44, name: '荊棘巡獵者' },
  // 熔核巡者／黑曜首領倒下：熔岩衝擊環＋火星＋大字
  magma_stalker: MAGMA,
  obsidian_alpha: MAGMA,
  // 彗星巡者／星輝首領倒下（D-138）：藍白星爆環＋碎星
  comet_stalker: ASTRAL,
  astral_alpha: ASTRAL,
  eclipse_wolf: ASTRAL,
  // 迷霧巡守倒下（D-120）：青色霧環＋霧粒散開
  mist_warden: { shake: [160, 0.005], rings: [[0x6ae8d0, 180, 480, 8]], sparks: [22, 'ember', 0xbaf8ee, 620], color: '#9af0e0', size: 44, name: '迷霧巡守' },
};

/** 這隻倒下有沒有專屬演出；有就播（(x, y) 是螢幕座標），回 true */
export function eliteFall(scene: Phaser.Scene, defId: string, x: number, y: number, name: string): boolean {
  const f = FALLS[defId];
  if (!f) return false;
  scene.cameras.main.shake(f.shake[0], f.shake[1]);
  for (const [c, r, ms, w] of f.rings) shockRing(scene, x, y, c, r, ms, w);
  sparks(scene, x, y, f.sparks[0], f.sparks[1], f.sparks[2], f.sparks[3]);
  bigText(scene, GAME_WIDTH / 2, 470, `${f.name ?? name} 倒下了！`, f.color, f.size, 900);
  return true;
}
