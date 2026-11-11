/**
 * 主角的亮邊（第 176 輪，D-371）。
 * 主角立繪是全遊戲最暗的一張（深藍大衣、深棕頭髮，平均亮度約 65；霧狼 140、狼王 120），縮到 50px 高、站在燼紅裂谷／星隕高原的
 * 深色地面上，只剩一條紅圍巾看得到——玩家整場都在找自己。做法：開場用立繪的輪廓做一張「往外長一圈、邊緣柔化」的淡色剪影，
 * 墊在立繪後面跟著走。不改圖檔（大圖用在標題、角色面板時不該有邊），只在戰鬥場景用。純畫面，不影響任何判定。
 */
import type Phaser from 'phaser';

/** 亮邊的顏色：偏冷的白。暖色在燼紅裂谷會混進地面的熔岩紋，冷白在四張圖都跳得出來 */
export const RIM_COLOR = '#e6f4ff';
/** 亮邊在畫面上的寬度（遊戲座標 px；畫面 720 寬） */
export const RIM_SCREEN_PX = 3;
/** 亮邊的不透明度 */
export const RIM_ALPHA = 0.75;

export interface RimLayout {
  /** 原圖四周各墊多少（原圖 px） */
  pad: number;
  /** 往外長多少（原圖 px） */
  grow: number;
  w: number;
  h: number;
  /** 墊過之後，要和原圖同一個腳底點對齊的 origin */
  originX: number;
  originY: number;
}

/**
 * 立繪顯示時會縮小（scale），亮邊要先在原圖尺寸上長 RIM_SCREEN_PX / scale 那麼寬，縮下來才剩 RIM_SCREEN_PX。
 * 純函式：算墊邊後的畫布大小與 origin（墊邊後腳底點不能跑掉，不然亮邊會和人錯開）。
 */
export function rimLayout(w: number, h: number, scale: number, originX: number, originY: number, screenPx = RIM_SCREEN_PX): RimLayout {
  const grow = Math.max(2, Math.min(40, Math.round(screenPx / Math.max(0.01, scale))));
  const pad = grow * 2;
  const W = w + pad * 2;
  const H = h + pad * 2;
  return { pad, grow, w: W, h: H, originX: (pad + w * originX) / W, originY: (pad + h * originY) / H };
}

export function rimKey(key: string): string {
  return key + '__rim';
}

/** 沒有就做一張亮邊材質（每個立繪只做一次）；做不出來（沒有 canvas）回傳 null，場景就不墊 */
export function ensureRim(scene: Phaser.Scene, key: string, scale: number, originX: number, originY: number): RimLayout | null {
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const L = rimLayout(src.width, src.height, scale, originX, originY);
  const rk = rimKey(key);
  if (scene.textures.exists(rk)) return L;
  const tex = scene.textures.createCanvas(rk, L.w, L.h);
  if (!tex) return null;
  const ctx = tex.getContext();
  // 輪廓往外長：沿圓周蓋 16 次（中間一圈半徑一半，補滿內側）
  for (const rr of [L.grow, L.grow * 0.5]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.drawImage(src, L.pad + Math.cos(a) * rr, L.pad + Math.sin(a) * rr);
    }
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = RIM_COLOR;
  ctx.fillRect(0, 0, L.w, L.h);
  ctx.globalCompositeOperation = 'source-over';
  // 邊緣柔化：把自己模糊後再畫回去（不支援 ctx.filter 的瀏覽器就是硬邊，一樣看得到）
  if ('filter' in ctx) {
    const tmp = document.createElement('canvas');
    tmp.width = L.w;
    tmp.height = L.h;
    const tc = tmp.getContext('2d');
    if (tc) {
      tc.filter = `blur(${Math.max(1, Math.round(L.grow * 0.35))}px)`;
      tc.drawImage(tex.getSourceImage() as HTMLCanvasElement, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(tmp, 0, 0); // 模糊會讓邊變淡，疊一次補回來
      ctx.globalAlpha = 1;
    }
  }
  tex.refresh();
  return L;
}
