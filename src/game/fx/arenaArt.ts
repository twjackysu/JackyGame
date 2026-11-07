// 競技場的場地美術（第 153 輪，A7）：石板地（每塊深淺不同、灰縫、裂紋）、中央沙地與交叉雙劍紋章、
// 兩邊出生區的漸層、上下看台的觀眾剪影、兩側火盆（光暈會閃）、掩體石塊的亮邊。
// 純畫面：用自己的小亂數（固定種子，每次都長一樣），不碰戰鬥 PRNG；場地只在第一次 create 畫一次並烤成貼圖，每幀只動四個火盆的光。
import Phaser from 'phaser';

export interface ArenaArtOpts {
  ox: number;
  oy: number;
  /** 一格幾像素 */
  cell: number;
  cols: number;
  rows: number;
  /** 地圖的掩體（'#'＝石塊） */
  solid: readonly string[];
  me: number;
  foe: number;
  lowFx: boolean;
}

/** 固定種子的小亂數（xorshift32）：只給場地裝飾用 */
function deco(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const mix = (a: number, b: number, t: number): number => {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class ArenaArt {
  private flames: { glow: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; ph: number }[] = [];
  /** 看台的上下緣（觀眾歡呼的彩紙從這裡灑出來） */
  private standY: [number, number] = [0, 0];

  constructor(private scene: Phaser.Scene, o: ArenaArtOpts) {
    const { ox, oy, cell: c, cols, rows } = o;
    const w = cols * c;
    const h = rows * c;
    this.standY = [oy - 30, oy + h + 30];
    const spots = [[ox - 26, oy + h * 0.22], [ox + w + 26, oy + h * 0.22], [ox - 26, oy + h * 0.78], [ox + w + 26, oy + h * 0.78]] as const;
    // 場地很多筆畫（每塊石板、觀眾）：畫一次烤成貼圖，之後每幀只畫一張圖（Graphics 每幀都會重跑全部指令；重開場景直接用烤好的）
    const KEY = `arena_bg_${scene.scale.width}x${scene.scale.height}`;
    if (!scene.textures.exists(KEY)) {
      const a = scene.make.graphics({}, false);
      this.paint(a, o, w, h);
      for (const [fx, fy] of spots) brazierBase(a, fx, fy);
      a.generateTexture(KEY, scene.scale.width, scene.scale.height);
      a.destroy();
    }
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(1);
    // 兩側火盆的火（光暈每幀閃）
    for (const [fx, fy] of spots) this.flame(fx, fy, o.lowFx);
  }

  private paint(a: Phaser.GameObjects.Graphics, o: ArenaArtOpts, w: number, h: number): void {
    const r = deco(0x5eed_a7);
    const { ox, oy, cell: c, cols, rows } = o;
    this.stands(a, r, oy, h);
    a.fillStyle(0x000000, 0.5).fillRoundedRect(ox - 14, oy - 14, w + 28, h + 28, 18);
    // 石板：灰縫底色＋每塊各自的深淺（棋盤交錯的感覺保留，但不再是兩個死板的顏色）
    a.fillStyle(0x221d15, 1).fillRect(ox, oy, w, h);
    for (let gx = 0; gx < cols; gx++)
      for (let gy = 0; gy < rows; gy++) {
        const base = (gx + gy) % 2 === 0 ? 0x453b2d : 0x3c3327;
        const col = mix(base, r() < 0.5 ? 0x2e271d : 0x564a38, r() * 0.35);
        const x = ox + gx * c;
        const y = oy + gy * c;
        a.fillStyle(col, 1).fillRoundedRect(x + 1.5, y + 1.5, c - 3, c - 3, 3);
        // 上緣亮一點、下緣暗一點：石板有厚度
        a.fillStyle(0xffffff, 0.05).fillRect(x + 3, y + 2, c - 6, 3);
        a.fillStyle(0x000000, 0.12).fillRect(x + 3, y + c - 5, c - 6, 3);
        if (r() < 0.14) {
          // 裂紋：兩三段折線
          a.lineStyle(1, 0x1a150f, 0.7);
          let px = x + 6 + r() * (c - 12);
          let py = y + 6 + r() * (c - 12);
          for (let k = 0; k < 3; k++) {
            const nx = Math.max(x + 3, Math.min(x + c - 3, px + (r() - 0.5) * 18));
            const ny = Math.max(y + 3, Math.min(y + c - 3, py + (r() - 0.5) * 18));
            a.lineBetween(px, py, nx, ny);
            px = nx;
            py = ny;
          }
        }
      }
    // 中央沙地（同心圓疊出柔邊）＋紋章
    const cx = ox + w / 2;
    const cy = oy + h / 2;
    for (let i = 0; i < 8; i++) a.fillStyle(0x7a6440, 0.06).fillCircle(cx, cy, 160 - i * 14);
    a.lineStyle(3, 0xffd27a, 0.35).lineBetween(ox, cy, ox + w, cy);
    a.lineStyle(3, 0xffd27a, 0.3).strokeCircle(cx, cy, 70);
    a.lineStyle(2, 0xffd27a, 0.2).strokeCircle(cx, cy, 52);
    this.swords(a, cx, cy);
    // 出生區：從邊往中間淡出的漸層
    for (let i = 0; i < 6; i++) {
      const t = 0.11 * (1 - i / 6);
      a.fillStyle(o.me, t).fillRect(ox, oy + h - (i + 1) * (2 * c) / 6, w, (2 * c) / 6);
      a.fillStyle(o.foe, t).fillRect(ox, oy + i * (2 * c) / 6, w, (2 * c) / 6);
    }
    // 外框（金邊）＋四角鉚釘
    a.lineStyle(6, 0x8a6a3a, 1).strokeRect(ox - 3, oy - 3, w + 6, h + 6);
    a.lineStyle(2, 0xffd27a, 0.6).strokeRect(ox - 8, oy - 8, w + 16, h + 16);
    for (const [x, y] of [[ox - 6, oy - 6], [ox + w + 6, oy - 6], [ox - 6, oy + h + 6], [ox + w + 6, oy + h + 6]] as const) {
      a.fillStyle(0x8a6a3a, 1).fillCircle(x, y, 9);
      a.fillStyle(0xffd27a, 0.9).fillCircle(x - 2, y - 2, 4);
    }
    // 掩體：石塊（上面亮、側面暗）＋上緣亮邊
    o.solid.forEach((row, gy) =>
      [...row].forEach((ch, gx) => {
        if (ch !== '#') return;
        const x = ox + gx * c;
        const y = oy + gy * c;
        a.fillStyle(0x000000, 0.35).fillRect(x + 4, y + 6, c, c);
        a.fillStyle(0x5a5650, 1).fillRect(x, y, c, c);
        a.fillStyle(0x7a766e, 1).fillRect(x + 2, y + 2, c - 4, c * 0.55);
        a.fillStyle(0xb8b2a6, 0.5).fillRect(x + 2, y + 2, c - 4, 2);
        a.lineStyle(1, 0x2a2826, 1).strokeRect(x, y, c, c);
      }),
    );
  }

  /** 上下看台：石頭欄杆＋一排排觀眾的頭（暗色剪影，偶爾一面小旗） */
  private stands(a: Phaser.GameObjects.Graphics, r: () => number, oy: number, h: number): void {
    const W = this.scene.scale.width;
    const band = (top: number, bottom: number, rowsDir: 1 | -1) => {
      if (bottom - top < 16) return;
      a.fillStyle(0x141826, 1).fillRect(0, top, W, bottom - top);
      const n = Math.max(1, Math.floor((bottom - top) / 22));
      for (let row = 0; row < n; row++) {
        const y = rowsDir === 1 ? top + 14 + row * 22 : bottom - 14 - row * 22;
        const shade = 0.55 - row * 0.12;
        for (let x = 8 + r() * 10; x < W - 6; x += 15 + r() * 7) {
          const col = mix(0x2a3048, [0x4a3a52, 0x3a4a5a, 0x5a4a3a][Math.floor(r() * 3)]!, 0.5);
          a.fillStyle(col, shade).fillCircle(x, y - 4, 6).fillRoundedRect(x - 8, y + 1, 16, 10, 4);
          if (r() < 0.04) {
            // 小旗：觀眾在揮
            a.lineStyle(1, 0x8a8070, shade).lineBetween(x + 6, y - 2, x + 9, y - 20);
            a.fillStyle(r() < 0.5 ? 0x6ab8ff : 0xff6a5a, shade).fillTriangle(x + 9, y - 20, x + 21, y - 16, x + 9, y - 12);
          }
        }
      }
    };
    const top0 = Math.max(96, oy - 74);
    band(top0, oy - 16, -1);
    band(oy + h + 16, Math.min(oy + h + 100, this.scene.scale.height - 300), 1);
    // 欄杆（看台和場地之間）
    a.fillStyle(0x3a3228, 1).fillRect(0, oy - 22, W, 8).fillRect(0, oy + h + 14, W, 8);
    a.fillStyle(0x6a5a44, 0.6).fillRect(0, oy - 22, W, 2).fillRect(0, oy + h + 14, W, 2);
  }

  /** 交叉雙劍（中央紋章）：只用線與三角形 */
  private swords(a: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    for (const s of [-1, 1]) {
      const dx = Math.cos(Math.PI / 4) * s;
      const dy = Math.sin(Math.PI / 4);
      const L = 40;
      a.lineStyle(4, 0xffd27a, 0.3).lineBetween(cx - dx * L, cy + dy * L, cx + dx * L * 0.9, cy - dy * L * 0.9);
      a.fillStyle(0xffd27a, 0.3).fillTriangle(cx + dx * L * 0.9 - dy * 4, cy - dy * L * 0.9 - dx * 4 * s, cx + dx * L * 0.9 + dy * 4, cy - dy * L * 0.9 + dx * 4 * s, cx + dx * L * 1.15, cy - dy * L * 1.15);
      // 護手
      const gx = cx - dx * L * 0.55;
      const gy = cy + dy * L * 0.55;
      a.lineStyle(3, 0xffd27a, 0.3).lineBetween(gx - dy * 10 * s, gy - dx * 10, gx + dy * 10 * s, gy + dx * 10);
    }
  }

  private flame(x: number, y: number, lowFx: boolean): void {
    const tex = ensureGlow(this.scene);
    const glow = this.scene.add.image(x, y - 4, tex).setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a4a).setScale(lowFx ? 1.2 : 1.8).setAlpha(0.45);
    const core = this.scene.add.image(x, y - 6, tex).setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe0a0).setScale(0.32).setAlpha(0.95);
    this.flames.push({ glow, core, ph: this.flames.length * 1.7 });
  }


  /**
   * 觀眾歡呼（第 153 輪）：贏了從上下看台灑彩紙（金／藍／白小紙片飄落、翻轉、淡出）。純外觀，省電畫質減半。
   * @returns 灑了幾片（測試用）
   */
  cheer(lowFx: boolean): number {
    return this.confetti(lowFx ? 18 : 40, 1);
  }

  /**
   * 小歡呼（第 154 輪）：有人放大招時，看台各灑一小撮彩紙、看台邊亮一下。純外觀，省電畫質只灑幾片、不亮。
   * 兩次之間至少隔 1.2 秒（避免連放時彩紙堆滿）。@returns 灑了幾片（0＝還在冷卻）
   */
  roar(lowFx: boolean, now: number): number {
    if (now - this.lastRoar < 1200) return 0;
    this.lastRoar = now;
    if (!lowFx) {
      const sc = this.scene;
      const W = sc.scale.width;
      for (const y of this.standY) {
        const band = sc.add.rectangle(W / 2, y, W, 46, 0xffe8a8, 0.22).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: band, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => band.destroy() });
      }
    }
    return this.confetti(lowFx ? 6 : 14, 0.55);
  }

  private lastRoar = -1e9;

  /** n 片彩紙從上下看台往場內飄；reach＝飄多遠（1＝勝利的大歡呼） */
  private confetti(n: number, reach: number): number {
    const sc = this.scene;
    const W = sc.scale.width;
    const cols = [0xffd27a, 0x6ab8ff, 0xffffff, 0xffe8a8];
    for (let i = 0; i < n; i++) {
      const top = i % 2 === 0;
      const x = 20 + Math.random() * (W - 40);
      const y = top ? this.standY[0] : this.standY[1];
      const p = sc.add.rectangle(x, y, 10 + Math.random() * 6, 5 + Math.random() * 3, cols[i % cols.length]!, 0.95).setDepth(70).setAngle(Math.random() * 360);
      const dy = (top ? 90 + Math.random() * 220 : -(140 + Math.random() * 220)) * reach;
      sc.tweens.add({ targets: p, x: x + (Math.random() - 0.5) * 120, y: y + dy, angle: p.angle + (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 300), scaleY: { from: 1, to: 0.2 }, yoyo: false, duration: 1200 + Math.random() * 900, delay: Math.random() * 350, ease: top ? 'Sine.easeIn' : 'Cubic.easeOut' });
      sc.tweens.add({ targets: p, alpha: 0, delay: 1300 + Math.random() * 600, duration: 500, onComplete: () => p.destroy() });
    }
    return n;
  }

  /** 每幀：火盆閃動（t＝毫秒） */
  update(t: number): void {
    const s = t / 1000;
    for (const f of this.flames) {
      const k = 0.5 + 0.5 * Math.sin(s * 7.3 + f.ph) * Math.sin(s * 3.1 + f.ph * 2);
      f.glow.setAlpha(0.35 + 0.18 * k);
      f.core.setScale(0.28 + 0.07 * k, 0.34 + 0.1 * k);
    }
  }
}

/** 火盆：三腳架＋碗（烤進場地貼圖） */
function brazierBase(a: Phaser.GameObjects.Graphics, x: number, y: number): void {
  a.lineStyle(3, 0x3a3026, 1).lineBetween(x - 9, y + 22, x, y + 6).lineBetween(x + 9, y + 22, x, y + 6);
  a.fillStyle(0x4a3c2c, 1).fillEllipse(x, y + 4, 26, 12);
  a.fillStyle(0x2a2018, 1).fillEllipse(x, y + 1, 20, 6);
}

function ensureGlow(scene: Phaser.Scene): string {
  const key = 'arena_glow';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    for (let r = 48; r > 0; r -= 2) g.fillStyle(0xffffff, 0.04 + 0.5 * Math.pow(1 - r / 48, 2)).fillCircle(48, 48, r);
    g.generateTexture(key, 96, 96);
    g.destroy();
  }
  return key;
}
