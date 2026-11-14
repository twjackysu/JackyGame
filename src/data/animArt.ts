// 有走路影格的怪物立繪（11/14，Jacky 的 Tripo 3D 模型用 Blender 渲染成 2D：scripts/tripo/README.md）。
// 圖放在 public/art/anim/（import-art.mjs 只掃 public/art/ 這一層，不會把整張表當成單張立繪載入）。
// 每張是 cols×rows 的格子，所有影格同尺寸、腳底對齊；第 0 格兼站立圖。
export interface AnimSheet {
  /** 材質 key（也是檔名：art/anim/<key>.webp） */
  key: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** 走路時每格幾毫秒 */
  ms: number;
}

export const ANIM_ART: readonly AnimSheet[] = [
  // 瘴氣狼（餘命城的 enemy_miasma_wolf）走路一循環 10 格；霧影狼、夜棘首領用
  { key: 'enemy_miasma_wolf_walk', frameWidth: 573, frameHeight: 380, frames: 10, ms: 85 },
];

export function animSheet(key: string): AnimSheet | undefined {
  return ANIM_ART.find((a) => a.key === key);
}
