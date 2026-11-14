// 文字按鈕的底（第 203 輪）：全遊戲的按鈕都是「有底色的 Text」——底色是 Phaser 直接填的一塊直角長方形，
// 亮黃的「完成／關閉／離開／+1 加點」和深褐的次要鈕都是平的色塊，像還沒做完的佔位按鈕（每個面板都有）。
// 這裡在一個地方把那塊底換成：圓角＋上亮下暗的一點厚度＋細邊（深色鈕是淡金邊，看得出是按鈕）。
// 做法：Text 重畫自己的畫布時，第一個 fillRect 就是那塊底色 → 只攔那一次，改畫圓角底，字照常畫在上面。
// 不改任何按鈕的大小、位置、點擊範圍與行為；底色字串照舊（pressFx 靠它認按鈕）。純畫面。
import Phaser from 'phaser';

import { BTN_SKIN, btnRadius, isDarkBg, skinnable } from './btnSkinRules';

function plate(ctx: CanvasRenderingContext2D, w: number, h: number, bg: string): void {
  const r = btnRadius(h);
  const path = (i: number): void => {
    const x0 = i, y0 = i, x1 = w - i, y1 = h - i, q = Math.max(1, r - i);
    ctx.beginPath();
    ctx.moveTo(x0 + q, y0);
    ctx.lineTo(x1 - q, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + q);
    ctx.lineTo(x1, y1 - q); ctx.quadraticCurveTo(x1, y1, x1 - q, y1);
    ctx.lineTo(x0 + q, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - q);
    ctx.lineTo(x0, y0 + q); ctx.quadraticCurveTo(x0, y0, x0 + q, y0);
    ctx.closePath();
  };
  ctx.save();
  path(0);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255,255,255,${BTN_SKIN.sheen})`);
  g.addColorStop(0.48, 'rgba(255,255,255,0)');
  g.addColorStop(0.52, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${BTN_SKIN.shade})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  path(0.75);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isDarkBg(bg) ? BTN_SKIN.edgeOnDark : BTN_SKIN.edge;
  ctx.stroke();
  ctx.restore();
}

let installed = false;
export function installBtnSkin(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.GameObjects.Text.prototype;
  const orig = proto.updateText;
  proto.updateText = function (this: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
    const bg = this.style.backgroundColor as unknown;
    if (!BTN_SKIN.on || !skinnable(bg)) return orig.call(this);
    const ctx = this.context;
    const real = ctx.fillRect;
    let done = false;
    ctx.fillRect = (x: number, y: number, w: number, h: number): void => {
      if (done) { real.call(ctx, x, y, w, h); return; }
      done = true;
      const res = this.style.resolution || 1;
      plate(ctx, this.canvas.width / res, this.canvas.height / res, bg);
    };
    try {
      return orig.call(this);
    } finally {
      delete (ctx as { fillRect?: unknown }).fillRect;
    }
  };
}
