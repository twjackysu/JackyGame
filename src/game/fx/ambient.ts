// 大地圖的環境粒子（第 27 輪）：純畫面、不碰戰鬥亂數。
// 霧語森林＝白天飄浮的光塵＋飄落的葉子＋低空的霧／深夜螢火蟲＋夜霧；荊棘谷＝飄落的紫紅花瓣與孢子；燼紅裂谷＝往上竄的火星＋落下的灰燼；星隕高原＝閃爍的星塵＋斜斜落下的碎星（D-138）＋偶爾劃過的流星（第 153 輪）。
// 粒子存在畫面座標，鏡頭移動時跟著世界位移（視差 0.85），超出畫面就從另一邊繞回來。省電畫質數量減半。
import Phaser from 'phaser';

export type AmbientKind = 'forest' | 'thorn' | 'ember' | 'star';

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 搖擺相位／速度 */
  ph: number;
  sw: number;
  /** 閃爍 */
  tw: number;
  base: number;
  spin: number;
  par: number;
  mg: number;
}

/** 星隕高原的流星（第 153 輪，A4）：偶爾劃過畫面的一道光 */
interface Meteor {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Layer {
  tex: string;
  n: number;
  tint: number[];
  scale: [number, number];
  alpha: [number, number];
  vx: [number, number];
  vy: [number, number];
  sway: number;
  twinkle: number;
  add: boolean;
  spin?: number;
  depth: number;
  /** 視差（預設 0.85）；霧比較遠，動得慢 */
  parallax?: number;
  /** 繞回畫面另一邊前可以超出多少（大霧塊要大一點） */
  margin?: number;
}

const PARALLAX = 0.85;

function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('amb_dot')) {
    const g = scene.make.graphics({}, false);
    for (let r = 16; r > 0; r--) g.fillStyle(0xffffff, 0.05 + 0.95 * Math.pow(1 - r / 16, 2.2)).fillCircle(16, 16, r);
    g.generateTexture('amb_dot', 32, 32);
    g.destroy();
  }
  if (!scene.textures.exists('amb_petal')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.9).fillEllipse(10, 6, 18, 9);
    g.fillStyle(0xffffff, 0.5).fillEllipse(7, 5, 8, 4);
    g.generateTexture('amb_petal', 20, 12);
    g.destroy();
  }
  if (!scene.textures.exists('amb_flake')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.85).fillPoints([new Phaser.Math.Vector2(0, 4), new Phaser.Math.Vector2(5, 0), new Phaser.Math.Vector2(11, 2), new Phaser.Math.Vector2(8, 8), new Phaser.Math.Vector2(2, 9)], true);
    g.generateTexture('amb_flake', 12, 10);
    g.destroy();
  }
  if (!scene.textures.exists('amb_leaf')) {
    // 一片葉子：橢圓葉身＋中脈（中脈用較暗的半透明線，tint 之後仍看得出）
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.95).fillEllipse(9, 5, 16, 8);
    g.fillStyle(0xffffff, 0.95).fillTriangle(16, 5, 19, 3, 19, 7);
    g.lineStyle(1, 0x000000, 0.25).lineBetween(2, 5, 16, 5);
    g.generateTexture('amb_leaf', 20, 10);
    g.destroy();
  }
  if (!scene.textures.exists('amb_fog')) {
    // 一團柔邊霧：同心橢圓疊出漸層（中心最濃）
    const g = scene.make.graphics({}, false);
    for (let i = 0; i < 14; i++) {
      const k = 1 - i / 14;
      g.fillStyle(0xffffff, 0.07).fillEllipse(128, 48, 256 * k, 96 * k);
    }
    g.generateTexture('amb_fog', 256, 96);
    g.destroy();
  }
  if (!scene.textures.exists('amb_streak')) {
    // 流星：頭亮尾淡的細長條（頭在右邊）
    const g = scene.make.graphics({}, false);
    for (let x = 0; x < 72; x++) g.fillStyle(0xffffff, Math.pow(x / 72, 2.2)).fillRect(x, 2, 1, 2);
    g.fillStyle(0xffffff, 1).fillCircle(71, 3, 2.5);
    g.generateTexture('amb_streak', 75, 6);
    g.destroy();
  }
}

function layersOf(kind: AmbientKind, night: boolean): Layer[] {
  if (kind === 'forest') {
    return night
      ? [
          { tex: 'amb_dot', n: 22, tint: [0xd8ff7a, 0xb8ff9a, 0xfff08a], scale: [0.5, 0.85], alpha: [0.55, 1], vx: [-12, 12], vy: [-10, 6], sway: 26, twinkle: 2.4, add: true, depth: 43 },
          { tex: 'amb_fog', n: 3, tint: [0x9ab0c8, 0x8aa0b8], scale: [1.6, 2.4], alpha: [0.25, 0.4], vx: [4, 10], vy: [-2, 2], sway: 0, twinkle: 0.2, add: false, depth: 40, parallax: 0.6, margin: 300 },
        ]
      : [
          { tex: 'amb_dot', n: 18, tint: [0xe8fff0, 0xc8f0d8, 0xfff6d8], scale: [0.3, 0.55], alpha: [0.3, 0.65], vx: [-8, 10], vy: [-16, -4], sway: 18, twinkle: 1.2, add: true, depth: 41 },
          // 第 153 輪（A4）：慢慢飄落的葉子＋低空飄過的霧
          { tex: 'amb_leaf', n: 9, tint: [0x7aa04a, 0x9ab85a, 0xc8a048, 0x6a8a3a], scale: [0.7, 1.1], alpha: [0.65, 0.9], vx: [8, 26], vy: [22, 40], sway: 34, twinkle: 0, add: false, spin: 1.8, depth: 41 },
          { tex: 'amb_fog', n: 4, tint: [0xe8f4ee, 0xd8ece4], scale: [1.4, 2.2], alpha: [0.45, 0.7], vx: [6, 14], vy: [-2, 2], sway: 0, twinkle: 0.25, add: false, depth: 40, parallax: 0.6, margin: 280 },
        ];
  }
  if (kind === 'thorn') {
    return [
      { tex: 'amb_petal', n: 16, tint: [0xd86a9a, 0xb84a7a, 0xe89ab8, 0x9a5aa8], scale: [0.8, 1.3], alpha: [0.6, 0.9], vx: [10, 34], vy: [26, 52], sway: 30, twinkle: 0, add: false, spin: 2.2, depth: 41 },
      { tex: 'amb_dot', n: 12, tint: [0xc8ff8a, 0xa8e070], scale: [0.25, 0.45], alpha: [0.35, 0.75], vx: [-6, 10], vy: [-12, -2], sway: 14, twinkle: 1.6, add: true, depth: 41 },
    ];
  }
  if (kind === 'star') {
    return [
      { tex: 'amb_dot', n: 26, tint: [0xe0e8ff, 0xa8c0ff, 0xd8b8ff, 0xffffff], scale: [0.22, 0.5], alpha: [0.5, 1], vx: [-4, 4], vy: [-4, 4], sway: 6, twinkle: 3.2, add: true, depth: 43 },
      { tex: 'amb_flake', n: 12, tint: [0xc8d8ff, 0x9ab0ff, 0xe8e0ff], scale: [0.5, 0.9], alpha: [0.5, 0.85], vx: [-40, -18], vy: [40, 70], sway: 8, twinkle: 2, add: true, spin: 3, depth: 42 },
    ];
  }
  return [
    { tex: 'amb_dot', n: 24, tint: [0xffa040, 0xff7a2a, 0xffd070], scale: [0.28, 0.6], alpha: [0.65, 1], vx: [-10, 14], vy: [-70, -30], sway: 22, twinkle: 6, add: true, depth: 43 },
    { tex: 'amb_flake', n: 14, tint: [0x8a8480, 0x6a6460, 0xa8a09a], scale: [0.8, 1.3], alpha: [0.4, 0.7], vx: [6, 22], vy: [18, 36], sway: 18, twinkle: 0, add: false, spin: 1.4, depth: 41 },
  ];
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambient {
  private motes: Mote[] = [];
  private lastOx: number | null = null;
  private scene: Phaser.Scene;
  private lastOy = 0;
  private t = 0;
  private meteors: Meteor[] = [];
  /** 下一顆流星還要幾秒；null＝這張圖沒有流星 */
  private nextMeteor: number | null = null;

  constructor(
    scene: Phaser.Scene,
    kind: AmbientKind,
    lowFx: boolean,
    night: boolean,
    private box: { x: number; y: number; w: number; h: number },
  ) {
    ensureTextures(scene);
    this.scene = scene;
    if (kind === 'star' && !lowFx) this.nextMeteor = rnd(1.5, 4);
    for (const L of layersOf(kind, night)) {
      const n = lowFx ? Math.ceil(L.n / 2) : L.n;
      for (let i = 0; i < n; i++) {
        const img = scene.add.image(0, 0, L.tex).setDepth(L.depth).setTint(L.tint[i % L.tint.length]!).setScale(rnd(...L.scale));
        if (L.add) img.setBlendMode(Phaser.BlendModes.ADD);
        const base = rnd(...L.alpha);
        img.setAlpha(base);
        this.motes.push({ img, x: box.x + Math.random() * box.w, y: box.y + Math.random() * box.h, vx: rnd(...L.vx), vy: rnd(...L.vy), ph: Math.random() * Math.PI * 2, sw: L.sway, tw: L.twinkle, base, spin: L.spin ? rnd(-L.spin, L.spin) : 0, par: L.parallax ?? PARALLAX, mg: L.margin ?? 20 });
      }
    }
  }

  /** 每幀呼叫：dt 毫秒；ox／oy＝世界原點在畫面上的位置（鏡頭位移用） */
  update(dt: number, ox: number, oy: number): void {
    const s = dt / 1000;
    this.t += s;
    const dx = this.lastOx === null ? 0 : ox - this.lastOx;
    const dy = this.lastOx === null ? 0 : oy - this.lastOy;
    this.lastOx = ox;
    this.lastOy = oy;
    const { x: bx, y: by, w, h } = this.box;
    for (const m of this.motes) {
      m.x += m.vx * s + dx * m.par;
      m.y += m.vy * s + dy * m.par;
      const g = m.mg;
      if (m.x < bx - g) m.x += w + 2 * g;
      else if (m.x > bx + w + g) m.x -= w + 2 * g;
      if (m.y < by - g) m.y += h + 2 * g;
      else if (m.y > by + h + g) m.y -= h + 2 * g;
      const sway = Math.sin(this.t * 1.3 + m.ph) * m.sw;
      m.img.setPosition(m.x + sway, m.y);
      if (m.tw) m.img.setAlpha(m.base * (0.55 + 0.45 * Math.sin(this.t * m.tw + m.ph * 3)));
      if (m.spin) m.img.rotation += m.spin * s;
    }
    if (this.nextMeteor !== null) this.updateMeteors(s);
  }

  private updateMeteors(s: number): void {
    this.nextMeteor! -= s;
    if (this.nextMeteor! <= 0 && this.visible) {
      this.nextMeteor = rnd(3, 7);
      const { x: bx, y: by, w, h } = this.box;
      // 從畫面上半部往左下劃過（跟碎星落下同一個方向）
      const ang = Math.PI - rnd(0.45, 0.75);
      const sp = rnd(520, 760);
      const img = this.scene.add
        .image(bx + rnd(0.35, 1.05) * w, by + rnd(0.02, 0.4) * h, 'amb_streak')
        .setDepth(42)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint([0xffffff, 0xd8e4ff, 0xe8d8ff][Math.floor(Math.random() * 3)]!)
        .setScale(rnd(1.2, 1.8), 1.4)
        .setRotation(ang)
        .setAlpha(0);
      const max = rnd(0.55, 0.85);
      this.meteors.push({ img, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: max, max });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]!;
      m.life -= s;
      if (m.life <= 0) {
        m.img.destroy();
        this.meteors.splice(i, 1);
        continue;
      }
      m.img.x += m.vx * s;
      m.img.y += m.vy * s;
      // 很快亮起、慢慢淡掉
      const k = 1 - m.life / m.max;
      m.img.setAlpha(k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }
  }

  private visible = true;

  setVisible(v: boolean): void {
    this.visible = v;
    for (const m of this.motes) m.img.setVisible(v);
    for (const m of this.meteors) m.img.setVisible(v);
  }
}
