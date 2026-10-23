// 程式生成的角色／敵人剪影材質（05：剪影 + 邊緣光）。
// 做法：先用邊緣光色描邊整個輪廓，再把深色本體往右下偏移填上，只留下左上側的亮邊 → 便宜的 rim light。
import Phaser from 'phaser';

type P = [number, number];

interface ShapeOpts {
  fill: number;
  rim: number;
  rimWidth?: number;
  offset?: number;
}

function poly(pts: P[], s: number): Phaser.Math.Vector2[] {
  return pts.map(([x, y]) => new Phaser.Math.Vector2(x * s, y * s));
}

function rimPoly(g: Phaser.GameObjects.Graphics, pts: P[], o: ShapeOpts, s: number): void {
  const v = poly(pts, s);
  const w = (o.rimWidth ?? 3) * s;
  const off = (o.offset ?? 2.5) * s;
  g.fillStyle(o.rim, 1);
  g.fillPoints(v, true);
  g.lineStyle(w, o.rim, 1);
  g.strokePoints(v, true, true);
  g.fillStyle(o.fill, 1);
  g.fillPoints(
    v.map((p) => new Phaser.Math.Vector2(p.x + off, p.y + off * 0.8)),
    true,
  );
}

function eye(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, s: number): void {
  g.fillStyle(color, 0.35);
  g.fillCircle(x * s, y * s, r * 2.2 * s);
  g.fillStyle(color, 1);
  g.fillCircle(x * s, y * s, r * s);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x * s, y * s, r * 0.45 * s);
}

const HERO_FILL = 0x121628;
const LAMP_RIM = 0xffb565;
const ENEMY_FILL = 0x0d0a18;

export interface ArtInfo {
  key: string;
  w: number;
  h: number;
  /** 世界座標中「腳底」相對中心的偏移（用於陰影） */
  footY: number;
  /** 提燈等發光點（相對左上角，材質座標） */
  glow?: { x: number; y: number; color: number; scale: number };
}

export const ART: Record<string, ArtInfo> = {};

function make(
  scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics, s: number) => void,
  glow?: ArtInfo['glow'],
): void {
  const s = 2; // 以 2 倍解析度繪製，顯示時縮 0.5 → 邊緣較銳利
  ART[key] = { key, w, h, footY: h / 2 - 6, glow };
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, s);
  g.generateTexture(key, w * s, h * s);
  g.destroy();
}

export function generateCombatantArt(scene: Phaser.Scene): void {
    if (!scene.textures.exists('lamp_icon')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffa54a, 0.35);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffd27a, 1);
      g.fillTriangle(16, 4, 26, 18, 6, 18);
      g.fillCircle(16, 20, 8);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 19, 3.5);
      g.generateTexture('lamp_icon', 32, 32);
      g.destroy();
    }
  // ---------------- 我方（背影） ----------------
  make(scene, 'hero_lian', 130, 200, (g, s) => {
    const o = { fill: HERO_FILL, rim: LAMP_RIM };
    // 提燈的桿子（右手往前舉）
    g.lineStyle(5 * s, 0x2a2238, 1);
    g.lineBetween(78 * s, 108 * s, 112 * s, 52 * s);
    g.lineStyle(2 * s, LAMP_RIM, 0.9);
    g.lineBetween(76 * s, 106 * s, 110 * s, 50 * s);
    // 斗篷
    rimPoly(g, [[52, 62], [78, 62], [92, 96], [102, 196], [64, 188], [26, 196], [36, 98]], o, s);
    // 圍巾飄帶
    rimPoly(g, [[44, 70], [20, 92], [14, 120], [30, 100], [48, 84]], { ...o, rim: 0xff8a3d }, s);
    // 兜帽
    rimPoly(g, [[65, 18], [86, 30], [90, 58], [78, 72], [52, 72], [40, 58], [44, 30]], o, s);
    // 提燈本體
    g.fillStyle(0x2a2238, 1);
    g.fillRect(104 * s, 50 * s, 16 * s, 22 * s);
    g.fillStyle(0xffd27a, 1);
    g.fillRect(107 * s, 54 * s, 10 * s, 14 * s);
    g.fillStyle(0xffffff, 1);
    g.fillRect(110 * s, 58 * s, 4 * s, 6 * s);
  }, { x: 112, y: 61, color: 0xffa54a, scale: 0.9 });

  make(scene, 'hero_rourke', 160, 220, (g, s) => {
    const o = { fill: 0x14141f, rim: 0xd9c8a8 };
    // 斧槍
    g.lineStyle(6 * s, 0x2b2420, 1);
    g.lineBetween(26 * s, 214 * s, 26 * s, 10 * s);
    g.lineStyle(2 * s, 0xd9c8a8, 0.8);
    g.lineBetween(23 * s, 214 * s, 23 * s, 10 * s);
    rimPoly(g, [[26, 24], [2, 14], [-0, 44], [26, 50]], { fill: 0x2e3140, rim: 0xeaf2ff, rimWidth: 2 }, s);
    rimPoly(g, [[26, 4], [32, 18], [20, 18]], { fill: 0x2e3140, rim: 0xeaf2ff, rimWidth: 2 }, s);
    // 身體（寬肩）
    rimPoly(g, [[50, 72], [128, 72], [146, 104], [136, 214], [86, 206], [40, 214], [32, 104]], o, s);
    // 肩甲
    rimPoly(g, [[34, 74], [62, 66], [66, 92], [30, 100]], { ...o, fill: 0x22242f }, s);
    rimPoly(g, [[116, 66], [146, 74], [150, 100], [112, 92]], { ...o, fill: 0x22242f }, s);
    // 頭盔
    rimPoly(g, [[88, 26], [108, 34], [112, 66], [66, 66], [70, 34]], { ...o, fill: 0x1c1e29 }, s);
    // 披風下擺
    rimPoly(g, [[56, 150], [122, 150], [130, 214], [48, 214]], { fill: 0x2a1418, rim: 0xb84a3a, rimWidth: 2 }, s);
  });

  make(scene, 'hero_io', 110, 180, (g, s) => {
    const o = { fill: 0x141a30, rim: 0xa9e6ff };
    // 長袍
    rimPoly(g, [[44, 70], [66, 70], [78, 110], [88, 176], [55, 170], [22, 176], [32, 110]], o, s);
    // 白髮（亮色）
    rimPoly(g, [[55, 22], [76, 32], [82, 64], [76, 92], [64, 78], [46, 78], [34, 92], [28, 64], [34, 32]], {
      fill: 0xdfe8f5, rim: 0xffffff, offset: 1.5,
    }, s);
    // 髮絲陰影
    g.fillStyle(0xaab6cc, 1);
    g.fillPoints(poly([[55, 30], [62, 74], [50, 74]], s), true);
    // 手上的光點
    g.fillStyle(0xbff2ff, 1);
    g.fillCircle(90 * s, 100 * s, 4 * s);
  }, { x: 90, y: 100, color: 0x7fd8ff, scale: 0.5 });

  make(scene, 'hero_liora', 120, 190, (g, s) => {
    const o = { fill: 0x161424, rim: 0xff7a5a };
    // 斜背包背帶
    g.lineStyle(4 * s, 0x3a2a26, 1);
    g.lineBetween(40 * s, 70 * s, 82 * s, 130 * s);
    // 外套
    rimPoly(g, [[42, 66], [78, 66], [90, 100], [96, 186], [60, 180], [24, 186], [32, 100]], o, s);
    // 背包
    rimPoly(g, [[70, 118], [96, 116], [100, 146], [72, 148]], { fill: 0x2a1e1c, rim: 0xff9a6a, rimWidth: 2 }, s);
    // 鮑伯短髮
    rimPoly(g, [[60, 18], [80, 26], [86, 50], [82, 70], [38, 70], [34, 50], [40, 26]], { fill: 0x2a1a22, rim: 0xff9a7a }, s);
    // 護目鏡帶
    g.fillStyle(0x4a3a36, 1);
    g.fillRect(36 * s, 42 * s, 50 * s, 6 * s);
    g.fillStyle(0xff7a5a, 0.9);
    g.fillRect(36 * s, 42 * s, 50 * s, 1.5 * s);
    g.fillStyle(0x8a6a50, 1);
    g.fillCircle(60 * s, 45 * s, 3 * s);
    // 手持發光燒瓶（左手）
    g.fillStyle(0x2a2238, 1);
    g.fillRect(14 * s, 86 * s, 6 * s, 8 * s);
    g.fillStyle(0xff8a3d, 0.4);
    g.fillCircle(17 * s, 104 * s, 14 * s);
    g.fillStyle(0xff8a3d, 1);
    g.fillCircle(17 * s, 104 * s, 9 * s);
    g.fillStyle(0xffe0a0, 1);
    g.fillCircle(15 * s, 102 * s, 4 * s);
  }, { x: 17, y: 104, color: 0xff8a3d, scale: 0.6 });

  // 瑟琳（背影；若立繪版已先生成則沿用）
  make(scene, 'hero_serin', 150, 230, (g, s) => {
    const o = { fill: 0x161a2c, rim: 0xc8d4ff };
    // 劍（右手斜握）
    g.lineStyle(6 * s, 0x2a2e40, 1);
    g.lineBetween(110 * s, 140 * s, 142 * s, 30 * s);
    g.lineStyle(2 * s, 0xc8d4ff, 1);
    g.lineBetween(108 * s, 138 * s, 140 * s, 28 * s);
    g.lineStyle(8 * s, 0x2a2e40, 1);
    g.lineBetween(100 * s, 132 * s, 122 * s, 142 * s);
    // 身體與鎧甲
    rimPoly(g, [[50, 84], [100, 84], [118, 118], [124, 226], [75, 218], [26, 226], [32, 118]], o, s);
    // 肩甲
    rimPoly(g, [[30, 86], [58, 80], [60, 108], [26, 112]], { ...o, fill: 0x22263a }, s);
    rimPoly(g, [[92, 80], [120, 86], [124, 112], [90, 108]], { ...o, fill: 0x22263a }, s);
    // 腰帶
    g.fillStyle(0x3a3448, 1);
    g.fillRect(36 * s, 150 * s, 78 * s, 8 * s);
    // 頭（後腦）
    rimPoly(g, [[75, 30], [94, 38], [98, 66], [88, 82], [62, 82], [52, 66], [56, 38]], { fill: 0x2a2440, rim: 0xe8d8ff }, s);
    // 馬尾
    rimPoly(g, [[70, 44], [82, 44], [86, 78], [80, 132], [72, 150], [68, 120], [66, 80]], { fill: 0x2a2440, rim: 0xe8d8ff, rimWidth: 2 }, s);
    g.fillStyle(0xc8d4ff, 1);
    g.fillRect(70 * s, 50 * s, 12 * s, 4 * s);
  });

  // ---------------- 敵方 ----------------
  const wolfPts: P[] = [
    [6, 78], [22, 66], [40, 56], [50, 30], [58, 20], [64, 44], [80, 40], [110, 44], [140, 50], [160, 54], [170, 58],
    [188, 38], [198, 44], [184, 64], [172, 78], [170, 96], [178, 132], [166, 137], [158, 134], [154, 104], [130, 96],
    [96, 98], [80, 104], [76, 134], [62, 137], [56, 132], [58, 100], [46, 92], [28, 88], [14, 86],
  ];
  make(scene, 'enemy_mist_wolf', 200, 140, (g, s) => {
    rimPoly(g, wolfPts, { fill: ENEMY_FILL, rim: 0x9fb8ff }, s);
    // 鬃毛鋸齒
    rimPoly(g, [[62, 42], [72, 30], [82, 42], [92, 30], [102, 44], [112, 34], [122, 48]], { fill: ENEMY_FILL, rim: 0x9fb8ff, rimWidth: 2 }, s);
    g.fillStyle(0xdfe8ff, 1);
    g.fillTriangle(14 * s, 84 * s, 18 * s, 92 * s, 22 * s, 85 * s);
    eye(g, 34, 68, 3.5, 0x8ff0ff, s);
  });

  make(scene, 'enemy_boss_wolfking', 300, 230, (g, s) => {
    const k = 1.45;
    const pts = wolfPts.map(([x, y]): P => [x * k + 6, y * k + 26]);
    // 霧角（鹿角般的分岔）
    g.lineStyle(7 * s, 0xb9a6ff, 1);
    const antler = (x0: number, y0: number, dir: number) => {
      g.lineBetween(x0 * s, y0 * s, (x0 + 18 * dir) * s, (y0 - 40) * s);
      g.lineBetween((x0 + 18 * dir) * s, (y0 - 40) * s, (x0 + 10 * dir) * s, (y0 - 66) * s);
      g.lineBetween((x0 + 10 * dir) * s, (y0 - 26) * s, (x0 - 14 * dir) * s, (y0 - 46) * s);
      g.lineBetween((x0 + 16 * dir) * s, (y0 - 38) * s, (x0 + 40 * dir) * s, (y0 - 52) * s);
    };
    antler(84, 60, -1);
    antler(98, 62, 1);
    g.lineStyle(3 * s, 0x2a1d4a, 1);
    rimPoly(g, pts, { fill: 0x0b0816, rim: 0xc6b0ff, rimWidth: 4 }, s);
    rimPoly(g, [[98, 82], [112, 60], [124, 82], [138, 58], [152, 84], [166, 62], [180, 90], [196, 70], [204, 96]], {
      fill: 0x0b0816, rim: 0xc6b0ff, rimWidth: 3,
    }, s);
    eye(g, 55, 124, 5, 0xc48bff, s);
    eye(g, 66, 120, 3, 0xc48bff, s);
  });

  make(scene, 'enemy_thorn_shroom', 150, 160, (g, s) => {
    const o = { fill: 0x170c18, rim: 0xd890ff };
    rimPoly(g, [[58, 86], [92, 86], [100, 156], [50, 156]], { fill: 0x1d1420, rim: 0xb7a0c8 }, s);
    const cap: P[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      const r = i % 2 === 0 ? 70 : 58;
      cap.push([75 + Math.cos(a) * r, 92 + Math.sin(a) * r * 0.85]);
    }
    rimPoly(g, cap, o, s);
    for (const [x, y] of [[50, 60], [80, 44], [104, 66], [66, 76]] as P[]) {
      g.fillStyle(0xff7ae0, 0.9);
      g.fillCircle(x * s, y * s, 5 * s);
    }
    eye(g, 64, 116, 3, 0xff9af0, s);
    eye(g, 86, 116, 3, 0xff9af0, s);
  });

  make(scene, 'enemy_umbra_boar', 230, 160, (g, s) => {
    const o = { fill: 0x0f0a12, rim: 0xff8a6a };
    rimPoly(g, [
      [14, 92], [24, 66], [52, 46], [90, 30], [150, 28], [196, 44], [218, 74], [214, 110], [200, 112], [196, 152],
      [178, 152], [172, 118], [86, 120], [80, 152], [62, 152], [56, 116], [30, 112],
    ], o, s);
    // 背脊尖刺
    rimPoly(g, [[70, 40], [84, 14], [96, 32], [110, 8], [122, 30], [138, 10], [148, 30], [166, 18], [172, 40]], {
      ...o, rimWidth: 2,
    }, s);
    // 獠牙
    g.fillStyle(0xfff0d8, 1);
    g.fillTriangle(22 * s, 92 * s, 4 * s, 70 * s, 30 * s, 86 * s);
    eye(g, 44, 70, 4, 0xff5a3a, s);
  });

  make(scene, 'enemy_tr_beast', 200, 170, (g, s) => {
    const o = { fill: 0x0e0b16, rim: 0xa58cff };
    rimPoly(g, [
      [20, 120], [30, 70], [70, 36], [120, 30], [168, 56], [186, 110], [176, 166], [150, 166], [140, 130], [70, 130],
      [60, 166], [34, 166],
    ], o, s);
    rimPoly(g, [[70, 40], [82, 6], [98, 34], [116, 2], [128, 34], [150, 14], [156, 50]], { ...o, rimWidth: 2 }, s);
    eye(g, 66, 78, 5, 0xb48cff, s);
    eye(g, 92, 74, 4, 0xb48cff, s);
  });

  make(scene, 'enemy_rock_beetle', 210, 150, (g, s) => {
    const o = { fill: 0x14110e, rim: 0xd8a868 };
    // 腳
    g.lineStyle(5 * s, 0x2a221a, 1);
    for (const x of [60, 100, 140, 170]) {
      g.lineBetween(x * s, 110 * s, (x - 12) * s, 144 * s);
    }
    // 身體
    rimPoly(g, [[30, 104], [44, 70], [80, 40], [130, 34], [176, 52], [200, 88], [196, 118], [40, 122]], o, s);
    // 石板甲片
    const plate = { fill: 0x2a2620, rim: 0xb89a70, rimWidth: 2 };
    rimPoly(g, [[66, 54], [104, 40], [110, 76], [70, 84]], plate, s);
    rimPoly(g, [[112, 40], [158, 50], [150, 84], [116, 78]], plate, s);
    rimPoly(g, [[160, 58], [190, 86], [180, 108], [154, 92]], plate, s);
    rimPoly(g, [[72, 90], [148, 90], [140, 112], [80, 112]], plate, s);
    // 頭與大顎
    rimPoly(g, [[10, 96], [22, 76], [46, 70], [50, 112], [24, 116]], o, s);
    g.fillStyle(0xe8d0a8, 1);
    g.fillTriangle(12 * s, 100 * s, -2 * s, 92 * s, 10 * s, 108 * s);
    g.fillTriangle(14 * s, 110 * s, 0, 120 * s, 18 * s, 116 * s);
    eye(g, 26, 88, 3.5, 0xffb030, s);
    eye(g, 38, 84, 2.5, 0xffb030, s);
  });

  make(scene, 'enemy_lamp_wraith', 150, 190, (g, s) => {
    const o = { fill: 0x110e22, rim: 0xb8c8ff };
    // 鬼影身體 + 飄尾
    rimPoly(g, [
      [74, 14], [104, 28], [116, 64], [112, 110], [102, 140], [110, 168], [92, 154], [84, 186], [72, 160],
      [56, 178], [58, 140], [40, 110], [36, 64], [48, 28],
    ], o, s);
    // 手臂伸向燈
    rimPoly(g, [[46, 80], [20, 100], [16, 112], [28, 108], [52, 96]], { ...o, rimWidth: 2 }, s);
    // 礦燈
    g.lineStyle(2 * s, 0x8a90b0, 1);
    g.lineBetween(20 * s, 108 * s, 20 * s, 118 * s);
    g.fillStyle(0xa78cff, 0.3);
    g.fillCircle(20 * s, 130 * s, 18 * s);
    g.fillStyle(0x2a2440, 1);
    g.fillRect(12 * s, 118 * s, 16 * s, 22 * s);
    g.fillStyle(0xbfd0ff, 1);
    g.fillRect(15 * s, 122 * s, 10 * s, 14 * s);
    g.fillStyle(0xffffff, 1);
    g.fillRect(18 * s, 126 * s, 4 * s, 6 * s);
    eye(g, 64, 56, 4, 0xc8b0ff, s);
    eye(g, 86, 56, 4, 0xc8b0ff, s);
    g.fillStyle(0x6a5aa8, 1);
    g.fillEllipse(75 * s, 76 * s, 12 * s, 8 * s);
  }, { x: 20, y: 130, color: 0x9fb0ff, scale: 0.6 });

  make(scene, 'enemy_blast_lizard', 200, 140, (g, s) => {
    const o = { fill: 0x120d0c, rim: 0xff9a50 };
    // 尾巴 + 身體 + 頭
    rimPoly(g, [
      [8, 86], [20, 70], [44, 62], [70, 60], [120, 58], [150, 66], [176, 60], [196, 40], [190, 72], [170, 90],
      [158, 96], [160, 128], [146, 128], [138, 102], [86, 104], [78, 128], [64, 128], [60, 100], [34, 98], [14, 96],
    ], o, s);
    // 背棘
    rimPoly(g, [[70, 62], [80, 48], [92, 60], [104, 46], [116, 60], [128, 50], [140, 64]], { ...o, rimWidth: 2 }, s);
    // 發光腹囊
    for (const [x, y, r] of [[84, 96, 9], [106, 98, 11], [128, 96, 9]] as [number, number, number][]) {
      g.fillStyle(0xff7a2a, 0.35);
      g.fillCircle(x * s, y * s, r * 1.6 * s);
      g.fillStyle(0xff8a3d, 1);
      g.fillCircle(x * s, y * s, r * s);
      g.fillStyle(0xffe0a0, 1);
      g.fillCircle((x - 2) * s, (y - 2) * s, r * 0.4 * s);
    }
    g.fillStyle(0xfff0d8, 1);
    g.fillTriangle(10 * s, 90 * s, 18 * s, 94 * s, 14 * s, 86 * s);
    eye(g, 30, 74, 3.5, 0xffc040, s);
  }, { x: 106, y: 98, color: 0xff7a2a, scale: 0.7 });

  make(scene, 'enemy_boss_bellworm', 320, 260, (g, s) => {
    // 地面裂口
    g.fillStyle(0x1a1420, 1);
    g.fillEllipse(170 * s, 246 * s, 260 * s, 26 * s);
    rimPoly(g, [[50, 248], [80, 236], [120, 242], [160, 232], [210, 240], [260, 234], [290, 248], [250, 256], [90, 256]], {
      fill: 0x18121c, rim: 0x8a6aa8, rimWidth: 2,
    }, s);
    // 蠕蟲身體（弓起）
    const o = { fill: 0x0d0a16, rim: 0xb08cff, rimWidth: 4 };
    rimPoly(g, [
      [120, 246], [110, 200], [112, 160], [126, 124], [150, 100], [190, 96], [214, 120], [220, 160], [226, 246],
    ], o, s);
    // 體節環
    g.lineStyle(3 * s, 0x2a1e44, 1);
    for (const y of [140, 170, 200, 226]) g.lineBetween(116 * s, y * s, 222 * s, (y + 4) * s);
    // 紫色裂紋
    g.lineStyle(2.5 * s, 0xc070ff, 1);
    g.lineBetween(140 * s, 150 * s, 160 * s, 180 * s);
    g.lineBetween(160 * s, 180 * s, 150 * s, 210 * s);
    g.lineBetween(196 * s, 160 * s, 186 * s, 196 * s);
    g.lineBetween(186 * s, 196 * s, 204 * s, 222 * s);
    // 銅鐘頭殼
    rimPoly(g, [[110, 108], [118, 60], [146, 26], [170, 18], [196, 26], [222, 60], [230, 108], [246, 124], [94, 124]], {
      fill: 0x3a2814, rim: 0xe8b060, rimWidth: 4,
    }, s);
    g.lineStyle(3 * s, 0xc08a40, 1);
    g.lineBetween(118 * s, 76 * s, 222 * s, 76 * s);
    g.lineBetween(104 * s, 114 * s, 236 * s, 114 * s);
    // 鐘口（嘴）
    g.fillStyle(0x1a0812, 1);
    g.fillEllipse(170 * s, 128 * s, 140 * s, 30 * s);
    g.fillStyle(0xc070ff, 0.35);
    g.fillEllipse(170 * s, 130 * s, 90 * s, 14 * s);
    // 牙齒
    g.fillStyle(0xf4e8d8, 1);
    for (let i = 0; i < 12; i++) {
      const x = 108 + i * 11;
      g.fillTriangle(x * s, 120 * s, (x + 8) * s, 120 * s, (x + 4) * s, 134 * s);
    }
    for (let i = 0; i < 10; i++) {
      const x = 118 + i * 11;
      g.fillTriangle(x * s, 138 * s, (x + 8) * s, 138 * s, (x + 4) * s, 128 * s);
    }
    // 鐘殼裂紋與眼
    g.lineStyle(2 * s, 0xc070ff, 1);
    g.lineBetween(150 * s, 40 * s, 158 * s, 66 * s);
    g.lineBetween(158 * s, 66 * s, 148 * s, 90 * s);
    g.lineBetween(200 * s, 44 * s, 190 * s, 70 * s);
    eye(g, 140, 96, 5, 0xc48bff, s);
    eye(g, 200, 96, 5, 0xc48bff, s);
    eye(g, 170, 90, 3.5, 0xc48bff, s);
  }, { x: 170, y: 130, color: 0xa060ff, scale: 1.2 });
}

/** 對話立繪用（剪影，正面半身）。 */
export function generatePortraitArt(scene: Phaser.Scene): void {
  generateHeroPortraits(scene);
  make(scene, 'npc_serin_simple', 150, 230, (g, s) => {
    const o = { fill: 0x161a2c, rim: 0xc8d4ff };
    // 劍
    g.lineStyle(5 * s, 0xc8d4ff, 1);
    g.lineBetween(128 * s, 40 * s, 128 * s, 200 * s);
    g.lineStyle(10 * s, 0x2a2e40, 1);
    g.lineBetween(114 * s, 190 * s, 142 * s, 190 * s);
    // 身體與鎧甲
    rimPoly(g, [[52, 92], [98, 92], [116, 124], [120, 230], [30, 230], [34, 124]], o, s);
    // 馬尾長髮
    rimPoly(g, [[56, 30], [94, 30], [104, 70], [112, 140], [96, 116], [92, 88], [58, 88], [44, 70]], { fill: 0x2a2440, rim: 0xe8d8ff }, s);
    // 臉
    rimPoly(g, [[64, 46], [86, 46], [90, 72], [75, 88], [60, 72]], { fill: 0x1c2036, rim: 0xffffff, rimWidth: 2 }, s);
    // 胸甲星紋
    g.fillStyle(0xc8d4ff, 0.9);
    g.fillTriangle(75 * s, 120 * s, 82 * s, 134 * s, 68 * s, 134 * s);
  });
  const knight = (key: string, crest: number, rim: number) =>
    make(scene, key, 170, 240, (g, s) => {
      const o = { fill: 0x12141f, rim };
      rimPoly(g, [[40, 98], [130, 98], [154, 132], [160, 240], [10, 240], [16, 132]], o, s);
      rimPoly(g, [[14, 100], [56, 90], [60, 128], [10, 136]], { ...o, fill: 0x1e2130 }, s);
      rimPoly(g, [[114, 90], [156, 100], [160, 136], [110, 128]], { ...o, fill: 0x1e2130 }, s);
      rimPoly(g, [[85, 22], [112, 36], [116, 92], [54, 92], [58, 36]], { ...o, fill: 0x1a1c28 }, s);
      // 面罩縫
      g.fillStyle(0x6a7aa8, 1);
      g.fillRect(64 * s, 58 * s, 42 * s, 5 * s);
      // 盔頂羽飾
      rimPoly(g, [[84, 24], [96, 0], [110, 6], [92, 30]], { fill: crest, rim: 0xffffff, rimWidth: 1.5 }, s);
      g.fillStyle(rim, 0.9);
      g.fillTriangle(85 * s, 140 * s, 95 * s, 160 * s, 75 * s, 160 * s);
    });
  knight('npc_knight', 0x3a4a7a, 0x9fb0d8);
  knight('npc_gwen', 0x8a2a2a, 0xffd27a);

  // ---------------- 城鎮居民（通用立繪） ----------------
  // 瑪拉：中年旅店老闆娘。頭頂髮髻 + 圍裙（胸兜 + 下擺），暖色燈光邊緣。
  make(scene, 'npc_mara', 160, 235, (g, s) => {
    const o = { fill: 0x1a1420, rim: LAMP_RIM };
    // 髮髻
    rimPoly(g, [[68, 10], [92, 10], [100, 24], [92, 38], [68, 38], [60, 24]], { fill: 0x2a1e26, rim: LAMP_RIM }, s);
    // 盤起的頭髮
    rimPoly(g, [[52, 40], [108, 40], [116, 76], [106, 102], [54, 102], [44, 76]], { fill: 0x2a1e26, rim: LAMP_RIM }, s);
    // 身體（圓潤肩線）
    rimPoly(g, [[50, 104], [110, 104], [132, 128], [142, 235], [18, 235], [28, 128]], o, s);
    // 圍裙：胸兜 + 下擺
    const apron = { fill: 0x2e2630, rim: 0xffd9a0, rimWidth: 2 };
    rimPoly(g, [[62, 112], [98, 112], [104, 150], [56, 150]], apron, s);
    rimPoly(g, [[46, 150], [114, 150], [122, 235], [38, 235]], apron, s);
    // 圍裙腰帶
    g.fillStyle(LAMP_RIM, 0.85);
    g.fillRect(32 * s, 148 * s, 96 * s, 4 * s);
    // 臉
    rimPoly(g, [[64, 52], [96, 52], [100, 80], [80, 100], [60, 80]], { fill: 0x241c2a, rim: 0xffffff, rimWidth: 2 }, s);
  });

  // 漢娜：年長的孤兒院院長。略微駝背（頭較低）、大披肩、右手拄著拐杖，柔和米色邊緣。
  make(scene, 'npc_hanna', 160, 235, (g, s) => {
    const rim = 0xe8dcc8;
    const o = { fill: 0x18161f, rim };
    // 身體（窄肩、下垂）
    rimPoly(g, [[52, 120], [108, 120], [124, 148], [130, 235], [30, 235], [36, 148]], o, s);
    // 灰白短髮（淺色本體表現白髮）
    rimPoly(g, [[56, 54], [104, 54], [112, 84], [104, 104], [56, 104], [48, 84]], { fill: 0x7e7888, rim: 0xffffff, offset: 1.5 }, s);
    // 臉
    rimPoly(g, [[64, 64], [96, 64], [98, 90], [80, 110], [62, 90]], { fill: 0x221e2a, rim: 0xffffff, rimWidth: 2 }, s);
    // 披肩：寬三角垂墜
    rimPoly(g, [[34, 112], [126, 112], [140, 152], [80, 200], [20, 152]], { fill: 0x2a2232, rim, rimWidth: 2.5 }, s);
    // 披肩流蘇
    g.fillStyle(rim, 0.7);
    for (let i = 0; i < 6; i++) {
      const x = 46 + i * 13;
      const edgeY = 200 - Math.abs(x - 80) * 0.8; // 沿披肩下緣
      g.fillRect(x * s, edgeY * s, 2 * s, 8 * s);
    }
    // 拐杖（右側）：杖身 + 彎把
    g.lineStyle(5 * s, 0x2a2238, 1);
    g.lineBetween(138 * s, 156 * s, 138 * s, 235 * s);
    g.lineBetween(138 * s, 156 * s, 126 * s, 150 * s);
    g.lineStyle(1.5 * s, rim, 0.9);
    g.lineBetween(136 * s, 156 * s, 136 * s, 235 * s);
    g.lineBetween(136 * s, 154 * s, 125 * s, 148 * s);
    // 握杖的手
    rimPoly(g, [[124, 146], [134, 146], [136, 158], [124, 158]], { fill: 0x221e2a, rim, rimWidth: 1.5, offset: 1 }, s);
  });

  // 托比：小男孩。身形矮小（頭頂約在 1/4 處）、亂翹的頭髮從歪戴的帽子下冒出、吊帶褲。
  make(scene, 'npc_toby', 150, 230, (g, s) => {
    const rim = 0xbfe6a0;
    const o = { fill: 0x141a1c, rim };
    // 身體（窄小）
    rimPoly(g, [[52, 148], [98, 148], [114, 170], [118, 230], [32, 230], [36, 170]], o, s);
    // 吊帶
    g.lineStyle(3 * s, rim, 0.8);
    g.lineBetween(58 * s, 152 * s, 62 * s, 230 * s);
    g.lineBetween(92 * s, 152 * s, 88 * s, 230 * s);
    // 亂翹的頭髮（兩側與後方的尖角）
    rimPoly(g, [
      [40, 92], [34, 80], [48, 84], [50, 72], [100, 72], [104, 84], [118, 80], [110, 96], [116, 108], [104, 112],
      [106, 126], [94, 132], [56, 132], [44, 124], [46, 112], [32, 108],
    ], { fill: 0x2a2018, rim }, s);
    // 臉
    rimPoly(g, [[58, 94], [92, 94], [96, 118], [75, 136], [56, 118]], { fill: 0x1e2426, rim: 0xffffff, rimWidth: 2 }, s);
    // 帽子：帽頂 + 往左歪的帽簷
    const cap = { fill: 0x24302a, rim, rimWidth: 2.5 };
    rimPoly(g, [[52, 88], [56, 66], [76, 56], [96, 64], [102, 88]], cap, s);
    rimPoly(g, [[24, 90], [102, 86], [102, 95], [30, 98]], cap, s);
    // 額前翹起的一撮
    rimPoly(g, [[66, 96], [72, 104], [78, 96], [84, 106], [88, 96]], { fill: 0x2a2018, rim, rimWidth: 1.5, offset: 1 }, s);
  });

  // 法羅：商隊領隊。寬簷帽、長外套、斜背包帶 + 腰側皮包，金棕色邊緣。
  make(scene, 'npc_farrow', 170, 240, (g, s) => {
    const rim = 0xd8c08a;
    const o = { fill: 0x16141c, rim };
    // 外套
    rimPoly(g, [[50, 108], [120, 108], [146, 138], [152, 240], [18, 240], [24, 138]], o, s);
    // 翻領（V 字）
    g.fillStyle(rim, 0.55);
    g.fillTriangle(62 * s, 112 * s, 85 * s, 160 * s, 74 * s, 112 * s);
    g.fillTriangle(108 * s, 112 * s, 85 * s, 160 * s, 96 * s, 112 * s);
    // 斜背包帶（左肩 → 右腰）
    g.lineStyle(8 * s, 0x2a2018, 1);
    g.lineBetween(42 * s, 118 * s, 132 * s, 200 * s);
    g.lineStyle(2 * s, rim, 0.9);
    g.lineBetween(40 * s, 114 * s, 130 * s, 196 * s);
    // 腰側皮包
    rimPoly(g, [[112, 190], [150, 186], [154, 226], [114, 230]], { fill: 0x2a2018, rim, rimWidth: 2 }, s);
    g.fillStyle(rim, 0.9);
    g.fillRect(128 * s, 196 * s, 8 * s, 6 * s);
    // 臉
    rimPoly(g, [[68, 62], [102, 62], [106, 90], [85, 108], [64, 90]], { fill: 0x201c26, rim: 0xffffff, rimWidth: 2 }, s);
    // 寬簷帽：帽冠 + 寬帽簷 + 帽帶
    const hat = { fill: 0x1e1a22, rim, rimWidth: 3 };
    rimPoly(g, [[56, 58], [62, 24], [85, 16], [108, 24], [114, 58]], hat, s);
    rimPoly(g, [[6, 62], [40, 52], [130, 52], [164, 62], [150, 72], [20, 72]], hat, s);
    g.fillStyle(rim, 0.8);
    g.fillRect(60 * s, 46 * s, 52 * s, 4 * s);
  });

  // 伯恩：魁梧的老鐵匠／長老。極寬肩、濃密灰白大鬍子、皮革工作圍裙、肩後扛著鍛鎚，爐火色邊緣。
  make(scene, 'npc_bern', 170, 240, (g, s) => {
    const rim = 0xff9a5a;
    const o = { fill: 0x15111a, rim };
    // 鍛鎚（從右肩後方露出）
    g.lineStyle(6 * s, 0x2a2026, 1);
    g.lineBetween(140 * s, 140 * s, 156 * s, 30 * s);
    g.lineStyle(2 * s, rim, 0.8);
    g.lineBetween(137 * s, 140 * s, 153 * s, 30 * s);
    rimPoly(g, [[138, 14], [168, 20], [164, 44], [134, 38]], { fill: 0x2e2a34, rim: 0xffd2a8, rimWidth: 2 }, s);
    // 身體（非常寬的肩膀）
    rimPoly(g, [[34, 100], [136, 100], [164, 124], [170, 240], [0, 240], [6, 124]], o, s);
    // 肩部肌肉隆起
    rimPoly(g, [[6, 124], [26, 102], [56, 100], [52, 140], [10, 150]], { ...o, fill: 0x1d1720 }, s);
    rimPoly(g, [[114, 100], [144, 102], [164, 124], [160, 150], [118, 140]], { ...o, fill: 0x1d1720 }, s);
    // 皮革工作圍裙
    rimPoly(g, [[50, 146], [120, 146], [128, 240], [42, 240]], { fill: 0x2a1c18, rim, rimWidth: 2 }, s);
    // 頭（短髮／微禿的方頭）
    rimPoly(g, [[60, 30], [110, 30], [118, 70], [110, 92], [60, 92], [52, 70]], { fill: 0x201a24, rim: 0xffffff, rimWidth: 2 }, s);
    // 濃眉
    g.fillStyle(0x8a8088, 1);
    g.fillRect(64 * s, 58 * s, 16 * s, 5 * s);
    g.fillRect(90 * s, 58 * s, 16 * s, 5 * s);
    // 灰白大鬍子
    rimPoly(g, [[54, 74], [116, 74], [122, 104], [106, 140], [85, 154], [64, 140], [48, 104]], {
      fill: 0x6e6670, rim: 0xffffff, rimWidth: 1.5, offset: 1.5,
    }, s);
    g.fillStyle(0x4e4852, 1);
    g.fillPoints(poly([[85, 96], [92, 146], [78, 146]], s), true);
  });

  // 多恩：礦工公會工頭。安全帽＋頭燈、肩扛十字鎬、濃密八字鬍，礦燈琥珀色邊緣。
  make(scene, 'npc_dorn', 170, 240, (g, s) => {
    const rim = 0xffb565;
    const o = { fill: 0x16121a, rim };
    // 十字鎬（扛在右肩）
    g.lineStyle(6 * s, 0x2a2026, 1);
    g.lineBetween(118 * s, 150 * s, 160 * s, 40 * s);
    g.lineStyle(2 * s, rim, 0.8);
    g.lineBetween(115 * s, 150 * s, 157 * s, 40 * s);
    rimPoly(g, [[124, 30], [146, 34], [170, 54], [166, 58], [146, 46], [120, 40]], { fill: 0x3a3640, rim: 0xffe0b0, rimWidth: 2 }, s);
    rimPoly(g, [[150, 36], [168, 22], [172, 26], [158, 44]], { fill: 0x3a3640, rim: 0xffe0b0, rimWidth: 2 }, s);
    // 寬厚身體（工作背心）
    rimPoly(g, [[36, 106], [134, 106], [160, 130], [166, 240], [4, 240], [10, 130]], o, s);
    rimPoly(g, [[56, 112], [114, 112], [120, 240], [50, 240]], { fill: 0x2a2018, rim, rimWidth: 2 }, s);
    // 皮帶
    g.fillStyle(rim, 0.8);
    g.fillRect(14 * s, 196 * s, 142 * s, 5 * s);
    g.fillRect(78 * s, 192 * s, 14 * s, 13 * s);
    // 頭
    rimPoly(g, [[58, 52], [112, 52], [118, 82], [108, 104], [62, 104], [52, 82]], { fill: 0x201a24, rim: 0xffffff, rimWidth: 2 }, s);
    // 濃眉
    g.fillStyle(0x6a6068, 1);
    g.fillRect(64 * s, 68 * s, 16 * s, 4 * s);
    g.fillRect(90 * s, 68 * s, 16 * s, 4 * s);
    // 八字鬍
    rimPoly(g, [[60, 86], [72, 80], [85, 84], [98, 80], [110, 86], [116, 98], [100, 92], [85, 96], [70, 92], [54, 98]], {
      fill: 0x5e5660, rim: 0xffffff, rimWidth: 1.5, offset: 1.2,
    }, s);
    // 安全帽：帽殼＋帽簷
    const hat = { fill: 0x3a2e1e, rim, rimWidth: 2.5 };
    rimPoly(g, [[54, 56], [58, 30], [85, 18], [112, 30], [116, 56]], hat, s);
    rimPoly(g, [[40, 58], [130, 58], [126, 66], [44, 66]], hat, s);
    // 頭燈
    g.fillStyle(0xffd27a, 0.35);
    g.fillCircle(85 * s, 38 * s, 16 * s);
    g.fillStyle(0xfff0c0, 1);
    g.fillCircle(85 * s, 38 * s, 7 * s);
  }, { x: 85, y: 38, color: 0xffd27a, scale: 0.6 });

  // 年輕礦工：安全帽＋頭燈、瘦削身形、背帶工作褲。
  make(scene, 'npc_miner', 150, 230, (g, s) => {
    const rim = 0xffc27a;
    const o = { fill: 0x141218, rim };
    rimPoly(g, [[44, 118], [106, 118], [124, 142], [130, 230], [20, 230], [26, 142]], o, s);
    // 背帶
    g.lineStyle(3 * s, rim, 0.75);
    g.lineBetween(54 * s, 122 * s, 58 * s, 230 * s);
    g.lineBetween(96 * s, 122 * s, 92 * s, 230 * s);
    // 臉
    rimPoly(g, [[54, 70], [96, 70], [100, 96], [75, 116], [50, 96]], { fill: 0x1e1c26, rim: 0xffffff, rimWidth: 2 }, s);
    // 髮尾
    rimPoly(g, [[48, 70], [54, 84], [48, 92]], { fill: 0x2a2018, rim, rimWidth: 1.5, offset: 1 }, s);
    // 臉上的煤灰
    g.fillStyle(0x0a080c, 0.7);
    g.fillRect(84 * s, 96 * s, 8 * s, 3 * s);
    // 安全帽
    const hat = { fill: 0x3a301e, rim, rimWidth: 2.5 };
    rimPoly(g, [[48, 74], [52, 50], [75, 40], [98, 50], [102, 74]], hat, s);
    rimPoly(g, [[36, 76], [114, 76], [110, 83], [40, 83]], hat, s);
    g.fillStyle(0xffd27a, 0.35);
    g.fillCircle(75 * s, 58 * s, 13 * s);
    g.fillStyle(0xfff0c0, 1);
    g.fillCircle(75 * s, 58 * s, 5.5 * s);
  }, { x: 75, y: 58, color: 0xffd27a, scale: 0.5 });
}

export const heroArtKey = (id: string): string => `hero_${id}`;
export const enemyArtKey = (id: string): string => `enemy_${id}`;

// ======================================================================
// 主角對話立繪（Canvas 2D：漸層本體 + 柔和邊緣光 + 發光點綴）
// 材質：portrait_lian / portrait_io / portrait_rourke / portrait_serin / portrait_liora，210×300，底部置中顯示。
// ======================================================================
type Ctx = CanvasRenderingContext2D;
type PathFn = (c: Ctx) => void;
const PW = 210;
const PH = 300;

const rgba = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** 平滑封閉曲線（以中點做二次貝茲）。 */
const sm = (pts: P[]): PathFn => (c) => {
  const n = pts.length;
  const at = (i: number): P => pts[((i % n) + n) % n] as P;
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(at(n - 1), at(0));
  c.beginPath();
  c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const m = mid(p, at(i + 1));
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
};
/** 尖角多邊形。 */
const sh = (pts: P[]): PathFn => (c) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.closePath();
};

function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

/**
 * 邊緣光部件：先以邊緣光色填滿輪廓，再把本體往光源反方向偏移、分兩層疊上 →
 * 光源側留下一道由亮到暗的柔和亮邊。(dx,dy) 指向「遠離光源」的方向。
 */
function lit(c: Ctx, path: PathFn, fill: string | CanvasGradient, rim: string, dx: number, dy: number): void {
  c.save();
  path(c);
  c.clip();
  c.fillStyle = rim;
  c.fill();
  c.translate(dx * 0.45, dy * 0.45);
  c.globalAlpha = 0.55;
  path(c);
  c.fillStyle = fill;
  c.fill();
  c.translate(dx * 0.55, dy * 0.55);
  c.globalAlpha = 1;
  path(c);
  c.fill();
  c.restore();
}

function glow(c: Ctx, x: number, y: number, r: number, color: number, a: number): void {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function glowEye(c: Ctx, x: number, y: number, w: number, color: number, tilt = 0): void {
  glow(c, x, y, w * 2.6, color, 0.6);
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.fillStyle = rgba(color, 1);
  c.beginPath();
  c.ellipse(0, 0, w, w * 0.42, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.ellipse(w * 0.15, 0, w * 0.38, w * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function sparkle(c: Ctx, x: number, y: number, r: number, color: number, a = 1): void {
  glow(c, x, y, r * 2.2, color, 0.5 * a);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = rgba(0xffffff, 0.9 * a);
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r * 0.5, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r * 0.5, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
  c.restore();
}

function strokeLine(c: Ctx, pts: P[], color: string, w: number): void {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.stroke();
  c.restore();
}

/** 背後光暈 + 底部漸隱（讓半身像自然沒入對話框）。 */
function aura(c: Ctx, x: number, y: number, color: number, a = 0.22): void {
  const g = c.createRadialGradient(x, y, 10, x, y, 100);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.6, rgba(color, a * 0.3));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, PW, PH);
}

const SKIN = (c: Ctx, y0: number, y1: number): CanvasGradient =>
  vgrad(c, y0, y1, [[0, '#2c3150'], [0.6, '#1d2138'], [1, '#141729']]);
const BODY = (c: Ctx, top: string, bottom = '#0a0c16'): CanvasGradient =>
  vgrad(c, 150, PH, [[0, top], [1, bottom]]);

function canvasPortrait(scene: Phaser.Scene, key: string, draw: (c: Ctx) => void): void {
  ART[key] = { key, w: PW, h: PH, footY: PH / 2 };
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, PW, PH);
  if (!tex) return;
  const c = tex.getContext();
  c.clearRect(0, 0, PW, PH);
  draw(c);
  tex.refresh();
}

function generateHeroPortraits(scene: Phaser.Scene): void {
  // ---------------- 連恩：掌燈人（光源＝右下的提燈） ----------------
  canvasPortrait(scene, 'portrait_lian', (c) => {
    const rim = '#ffc27a';
    aura(c, 105, 160, 0xffa54a, 0.2);
    // 斗篷
    lit(c, sm([[14, 340], [20, 222], [38, 186], [76, 166], [105, 172], [134, 166], [172, 186], [190, 222], [198, 340]]),
      BODY(c, '#262a44'), rim, -4, -2);
    // 斗篷褶線
    strokeLine(c, [[58, 200], [50, 260], [46, 340]], 'rgba(0,0,0,0.35)', 3);
    strokeLine(c, [[150, 200], [158, 262], [160, 340]], 'rgba(255,180,100,0.18)', 2);
    // 內衣
    lit(c, sm([[78, 176], [132, 176], [140, 340], [70, 340]]), BODY(c, '#3a3040', '#140f18'), rim, -2, -1);
    // 脖子
    lit(c, sh([[94, 128], [116, 128], [118, 160], [92, 160]]), SKIN(c, 128, 160), rim, -2, 0);
    // 圍巾＋垂尾
    lit(c, sm([[58, 200], [44, 250], [36, 278], [56, 284], [70, 230], [82, 196]]),
      vgrad(c, 190, 284, [[0, '#6a2a2c'], [1, '#2a1018']]), rim, -2.5, -1);
    lit(c, sm([[70, 150], [104, 160], [140, 150], [150, 172], [136, 194], [104, 200], [70, 194], [60, 172]]),
      vgrad(c, 150, 200, [[0, '#7a3430'], [1, '#30121a']]), rim, -3, -2);
    strokeLine(c, [[72, 178], [104, 186], [138, 176]], 'rgba(0,0,0,0.3)', 2);
    // 頭
    lit(c, sm([[76, 92], [80, 70], [105, 58], [130, 70], [134, 92], [130, 122], [116, 140], [105, 144], [94, 140], [80, 122]]),
      SKIN(c, 60, 144), rim, -3, -1);
    // 亂翹短髮
    lit(c, sh([[72, 114], [68, 90], [56, 80], [70, 74], [64, 56], [82, 60], [86, 40], [100, 54], [112, 36], [120, 54],
      [138, 44], [136, 64], [154, 68], [142, 82], [148, 100], [140, 116], [134, 96], [124, 84], [116, 92], [104, 82], [94, 94], [86, 86], [80, 100]]),
      vgrad(c, 36, 116, [[0, '#3a2a2a'], [1, '#1a1218']]), rim, -3, -1.5);
    // 眉＋眼（看向右側）
    strokeLine(c, [[88, 104], [98, 102]], 'rgba(10,8,14,0.9)', 2.5);
    strokeLine(c, [[112, 102], [123, 104]], 'rgba(10,8,14,0.9)', 2.5);
    glowEye(c, 95, 112, 5, 0xffb565);
    glowEye(c, 118, 112, 5, 0xffb565);
    // 鼻、嘴的淡淡亮線
    strokeLine(c, [[110, 116], [112, 124], [108, 126]], 'rgba(255,190,120,0.35)', 1.5);
    strokeLine(c, [[100, 132], [111, 131]], 'rgba(0,0,0,0.4)', 1.5);
    // 斗篷扣
    glow(c, 104, 204, 10, 0xffa54a, 0.6);
    c.fillStyle = '#ffd27a';
    c.beginPath(); c.arc(104, 204, 3.5, 0, Math.PI * 2); c.fill();
    // 提燈的手與提燈
    lit(c, sm([[150, 340], [146, 252], [156, 238], [172, 240], [176, 260], [172, 340]]), BODY(c, '#2a2a44'), rim, -2, -1);
    strokeLine(c, [[163, 240], [163, 222]], '#4a3a30', 2.5);
    glow(c, 163, 202, 46, 0xffa54a, 0.6);
    // 燈頂
    lit(c, sh([[152, 186], [174, 186], [168, 176], [158, 176]]), '#3a2c24', '#ffd27a', 1, 1);
    c.strokeStyle = '#5a4434'; c.lineWidth = 2;
    c.beginPath(); c.arc(163, 172, 5, Math.PI, 0); c.stroke();
    // 燈罩（玻璃）
    const lg = c.createRadialGradient(163, 202, 2, 163, 202, 16);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.3, '#ffe2a0'); lg.addColorStop(1, '#ff8a3a');
    c.fillStyle = lg;
    sm([[153, 188], [173, 188], [176, 204], [172, 218], [154, 218], [150, 204]])(c);
    c.fill();
    strokeLine(c, [[163, 188], [163, 218]], 'rgba(90,60,40,0.7)', 1.5);
    lit(c, sh([[150, 218], [176, 218], [170, 226], [156, 226]]), '#3a2c24', '#ffd27a', 1, 1);
    glow(c, 163, 202, 28, 0xfff0c0, 0.8);
    // 飄浮的火星
    for (const [x, y, r] of [[140, 160, 2], [184, 150, 1.5], [176, 120, 2.5], [130, 236, 1.5], [194, 222, 1.8]] as [number, number, number][]) {
      glow(c, x, y, r * 4, 0xffa54a, 0.8);
    }
  });

  // ---------------- 伊歐：霧湖的白髮少女（光源＝上方月光，青色） ----------------
  canvasPortrait(scene, 'portrait_io', (c) => {
    const rim = '#a8ecff';
    aura(c, 105, 120, 0x7fd8ff, 0.26);
    // 後髮：長而飄動
    lit(c, sm([[64, 80], [60, 140], [40, 210], [28, 270], [14, 340], [196, 340], [186, 262], [170, 214], [150, 140], [146, 80], [105, 50]]),
      vgrad(c, 50, 300, [[0, '#c9d8ec'], [0.5, '#7f93b6'], [1, '#2a3354']]), '#e8fbff', 0, 3);
    // 髮絲
    for (const [x0, x1] of [[52, 30], [64, 52], [150, 176], [158, 190]] as [number, number][]) {
      strokeLine(c, [[x0, 170], [(x0 + x1) / 2, 230], [x1, 290]], 'rgba(230,250,255,0.35)', 1.5);
    }
    // 身體（洋裝）
    lit(c, sm([[42, 340], [46, 214], [62, 180], [90, 166], [105, 170], [120, 166], [148, 180], [164, 214], [168, 340]]),
      BODY(c, '#2a3352', '#0c0f1e'), rim, 0, 3);
    // 領口亮邊
    strokeLine(c, [[86, 170], [105, 192], [124, 170]], rgba(0x7fd8ff, 0.85), 2);
    glow(c, 105, 192, 12, 0x7fd8ff, 0.6);
    // 脖子
    lit(c, sh([[96, 136], [114, 136], [116, 180], [94, 180]]), SKIN(c, 136, 180), rim, 0, 2);
    // 臉
    lit(c, sm([[80, 96], [84, 72], [105, 62], [126, 72], [130, 96], [126, 124], [114, 142], [105, 146], [96, 142], [84, 124]]),
      vgrad(c, 62, 146, [[0, '#353d60'], [1, '#1b2038']]), rim, 0, 3);
    // 前髮（瀏海＋兩側長髮垂到胸前）
    lit(c, sm([[70, 100], [72, 66], [105, 48], [138, 66], [140, 100], [132, 92], [124, 84], [114, 96], [104, 84], [94, 96], [84, 86], [78, 98]]),
      vgrad(c, 48, 100, [[0, '#f2f8ff'], [1, '#9fb2d0']]), '#ffffff', 0, 2.5);
    lit(c, sm([[72, 82], [66, 140], [60, 200], [66, 236], [78, 206], [82, 150], [82, 104]]),
      vgrad(c, 82, 236, [[0, '#dce8f8'], [1, '#6f84aa']]), '#ffffff', 1.5, 2);
    lit(c, sm([[138, 82], [144, 140], [150, 200], [144, 236], [132, 206], [128, 150], [128, 104]]),
      vgrad(c, 82, 236, [[0, '#dce8f8'], [1, '#6f84aa']]), '#ffffff', -1.5, 2);
    // 眼（大而發光）
    glowEye(c, 94, 108, 6, 0x7fd8ff, 0.08);
    glowEye(c, 117, 108, 6, 0x7fd8ff, -0.08);
    strokeLine(c, [[101, 132], [109, 132]], 'rgba(0,0,0,0.35)', 1.2);
    // 臉頰星紋
    sparkle(c, 86, 122, 4, 0x7fd8ff, 0.9);
    // 星光粒子
    for (const [x, y, r] of [[30, 120, 5], [178, 96, 6], [168, 160, 3.5], [40, 190, 3], [186, 230, 4], [22, 60, 3], [150, 40, 3.5], [60, 36, 2.5]] as [number, number, number][]) {
      sparkle(c, x, y, r, 0x7fd8ff);
    }
  });

  // ---------------- 洛克：老練傭兵／賭徒（光源＝左側紅光） ----------------
  canvasPortrait(scene, 'portrait_rourke', (c) => {
    const rim = '#ff9a7a';
    aura(c, 105, 150, 0xe0705a, 0.2);
    // 斧槍（斜跨背後）
    strokeLine(c, [[22, 340], [182, 30]], '#1a1416', 8);
    strokeLine(c, [[20, 298], [180, 28]], rgba(0xe0705a, 0.55), 2);
    lit(c, sh([[164, 34], [204, 22], [200, 70], [176, 62]]), vgrad(c, 22, 70, [[0, '#4a4650'], [1, '#1c1a22']]), '#ffd0c0', 3, 2);
    lit(c, sh([[182, 30], [196, 0], [190, 34]]), '#3a3640', '#ffd0c0', 2, 1);
    // 寬厚的身體（皮大衣）
    lit(c, sm([[0, 340], [4, 214], [24, 182], [70, 160], [105, 166], [140, 160], [186, 182], [206, 214], [210, 340]]),
      BODY(c, '#33242a', '#0e0a0e'), rim, 4, 1);
    // 毛領
    lit(c, sh([[40, 186], [56, 166], [70, 172], [80, 160], [92, 176], [105, 168], [118, 176], [130, 160], [140, 172], [154, 166], [170, 186], [150, 206], [105, 196], [60, 206]]),
      vgrad(c, 160, 206, [[0, '#5a4a44'], [1, '#2a2024']]), rim, 3, 1);
    // 左肩護甲
    lit(c, sm([[8, 214], [20, 186], [52, 178], [66, 198], [58, 226], [20, 234]]),
      vgrad(c, 178, 234, [[0, '#4a4452'], [1, '#1e1a22']]), '#ffd0c0', 3, 2);
    strokeLine(c, [[18, 210], [56, 202]], rgba(0xe0705a, 0.7), 2);
    // 胸前皮帶＋骰子扣
    strokeLine(c, [[60, 206], [150, 340]], '#2a1a16', 9);
    lit(c, sh([[96, 238], [112, 238], [112, 254], [96, 254]]), '#e8dcd0', '#ffffff', 1, 1);
    c.fillStyle = '#2a1a16';
    for (const [x, y] of [[100, 242], [108, 250], [104, 246]] as P[]) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
    // 脖子
    lit(c, sh([[88, 130], [124, 130], [128, 170], [84, 170]]), SKIN(c, 130, 170), rim, 3, 0);
    // 方臉
    lit(c, sh([[72, 78], [80, 58], [106, 50], [132, 58], [140, 78], [140, 116], [130, 140], [106, 150], [82, 140], [72, 116]]),
      vgrad(c, 50, 150, [[0, '#33304a'], [1, '#1a1726']]), rim, 3.5, 1);
    // 鬍渣
    c.save();
    sh([[74, 112], [140, 112], [130, 140], [106, 150], [82, 140]])(c);
    c.clip();
    c.fillStyle = 'rgba(8,6,10,0.28)';
    c.fillRect(70, 112, 72, 40);
    c.fillStyle = 'rgba(160,140,150,0.2)';
    for (let i = 0; i < 60; i++) {
      const x = 76 + ((i * 37) % 62);
      const y = 116 + ((i * 53) % 32);
      c.fillRect(x, y, 1.2, 1.2);
    }
    c.restore();
    strokeLine(c, [[96, 132], [116, 130]], 'rgba(0,0,0,0.6)', 2);
    // 往後梳的亂髮
    lit(c, sh([[68, 92], [64, 64], [74, 44], [96, 32], [124, 30], [144, 42], [150, 66], [144, 90], [136, 70], [118, 62], [100, 60], [84, 66], [76, 80]]),
      vgrad(c, 30, 92, [[0, '#4a3434'], [1, '#1a1216']]), rim, 3.5, 1.5);
    strokeLine(c, [[84, 50], [118, 40]], rgba(0xe0705a, 0.4), 1.5);
    // 濃眉＋眼（右眼帶疤）
    strokeLine(c, [[82, 94], [98, 92]], '#0a080c', 4);
    strokeLine(c, [[114, 92], [132, 94]], '#0a080c', 4);
    glowEye(c, 92, 104, 4.5, 0xe0705a);
    glowEye(c, 122, 104, 4.5, 0xffc0a0);
    strokeLine(c, [[120, 84], [128, 118]], 'rgba(255,180,160,0.55)', 1.5);
    strokeLine(c, [[106, 106], [102, 120], [108, 122]], 'rgba(255,150,120,0.35)', 1.5);
    // 耳環
    glow(c, 140, 124, 8, 0xe0705a, 0.8);
    c.fillStyle = '#ffd0a0'; c.beginPath(); c.arc(140, 124, 2, 0, Math.PI * 2); c.fill();
  });

  // ---------------- 瑟琳：銀藍騎士（光源＝左上銀光） ----------------
  canvasPortrait(scene, 'portrait_serin', (c) => {
    const rim = '#e4ebff';
    aura(c, 100, 130, 0xc8d4ff, 0.22);
    // 馬尾（向右後方飄）
    lit(c, sm([[120, 64], [160, 60], [190, 90], [196, 140], [184, 190], [190, 230], [166, 200], [168, 150], [156, 108], [132, 92]]),
      vgrad(c, 60, 230, [[0, '#3a3460'], [1, '#14122a']]), '#e8d8ff', 3, 2);
    // 劍（立於右前方）
    const bl = c.createLinearGradient(170, 0, 184, 0);
    bl.addColorStop(0, '#ffffff'); bl.addColorStop(0.5, '#c8d4ff'); bl.addColorStop(1, '#5a6890');
    glow(c, 177, 140, 32, 0xc8d4ff, 0.3);
    c.fillStyle = bl;
    sh([[177, 26], [184, 44], [184, 236], [170, 236], [170, 44]])(c);
    c.fill();
    strokeLine(c, [[177, 44], [177, 230]], 'rgba(255,255,255,0.7)', 1);
    // 身體（鎧甲）
    lit(c, sm([[20, 340], [26, 220], [44, 188], [80, 170], [105, 174], [130, 170], [160, 188], [176, 220], [182, 340]]),
      BODY(c, '#3a4466', '#0c1020'), rim, 3, 3);
    // 胸甲
    lit(c, sm([[70, 196], [105, 186], [140, 196], [146, 250], [105, 280], [64, 250]]),
      vgrad(c, 186, 280, [[0, '#6a7aa8'], [0.5, '#3a4670'], [1, '#1a2040']]), '#ffffff', 2, 2.5);
    // 肩甲（雙層）
    for (const flip of [1, -1]) {
      const X = (x: number): number => (flip === 1 ? x : 210 - x - 6);
      lit(c, sm([[X(14), 222], [X(24), 190], [X(56), 178], [X(74), 196], [X(66), 222], [X(36), 232]]),
        vgrad(c, 178, 232, [[0, '#8a98c4'], [1, '#2a3256']]), '#ffffff', 2.5, 2.5);
      lit(c, sm([[X(20), 236], [X(30), 220], [X(62), 216], [X(64), 238], [X(36), 246]]),
        vgrad(c, 216, 246, [[0, '#6a78a4'], [1, '#222a48']]), '#ffffff', 2, 2);
    }
    // 星紋徽記
    glow(c, 105, 228, 30, 0xc8d4ff, 0.7);
    c.save();
    c.fillStyle = '#f4f7ff';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 13 : 5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(105 + Math.cos(a) * r, 228 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
    // 脖子＋護頸
    lit(c, sh([[94, 132], [116, 132], [118, 176], [92, 176]]), SKIN(c, 132, 176), rim, 2, 2);
    lit(c, sm([[82, 166], [105, 160], [128, 166], [132, 184], [105, 190], [78, 184]]), vgrad(c, 160, 190, [[0, '#7a88b4'], [1, '#2a3256']]), '#ffffff', 2, 2);
    // 臉
    lit(c, sm([[80, 94], [84, 70], [105, 60], [126, 70], [130, 94], [126, 122], [114, 140], [105, 144], [96, 140], [84, 122]]),
      SKIN(c, 60, 144), rim, 2.5, 3);
    // 頭髮（側分瀏海＋鬢髮）
    lit(c, sm([[70, 106], [70, 70], [90, 50], [118, 48], [140, 66], [142, 104], [134, 84], [120, 76], [104, 90], [96, 80], [84, 96], [78, 112]]),
      vgrad(c, 48, 112, [[0, '#4a4278'], [1, '#1c1834']]), '#e8d8ff', 2.5, 2.5);
    lit(c, sm([[72, 90], [68, 130], [74, 150], [82, 128], [80, 100]]), '#221e3c', '#e8d8ff', 2, 2);
    // 髮帶＋銀頭冠
    strokeLine(c, [[78, 66], [105, 56], [134, 64]], 'rgba(200,212,255,0.9)', 2);
    sparkle(c, 105, 56, 4, 0xc8d4ff);
    // 眼（銳利）
    strokeLine(c, [[86, 100], [100, 104]], '#0a0a16', 2.5);
    strokeLine(c, [[112, 104], [126, 100]], '#0a0a16', 2.5);
    glowEye(c, 94, 111, 5, 0xc8d4ff, 0.12);
    glowEye(c, 117, 111, 5, 0xc8d4ff, -0.12);
    strokeLine(c, [[100, 132], [110, 132]], 'rgba(0,0,0,0.4)', 1.4);
    // 護手握劍
    lit(c, sh([[164, 236], [190, 236], [188, 244], [166, 244]]), '#5a6890', '#ffffff', 1, 1);
    lit(c, sm([[162, 340], [160, 252], [170, 244], [186, 246], [192, 262], [190, 340]]), vgrad(c, 244, 300, [[0, '#6a78a4'], [1, '#1a2040']]), '#ffffff', 2, 2);
  });
  // ---------------- 莉歐拉：發明家少女（光源＝左下星燼燒瓶，焰橙色） ----------------
  canvasPortrait(scene, 'portrait_liora', (c) => {
    const rim = '#ff9a7a';
    aura(c, 100, 150, 0xff7a5a, 0.22);
    // 身體（短夾克）
    lit(c, sm([[22, 340], [28, 220], [46, 188], [80, 170], [105, 176], [130, 170], [164, 188], [182, 220], [188, 340]]),
      BODY(c, '#3a2c3a', '#0e0a12'), rim, 3, -1);
    // 內衫＋夾克翻領
    lit(c, sm([[80, 178], [130, 178], [136, 340], [74, 340]]), BODY(c, '#4a3a2e', '#18100e'), rim, 2, -1);
    strokeLine(c, [[80, 180], [96, 230], [92, 280]], 'rgba(255,140,100,0.35)', 2);
    strokeLine(c, [[130, 180], [116, 230], [120, 280]], 'rgba(0,0,0,0.35)', 2);
    // 斜背包帶（右肩 → 左腰）
    strokeLine(c, [[150, 186], [52, 300]], '#2a1a12', 9);
    strokeLine(c, [[148, 182], [50, 296]], 'rgba(255,170,110,0.45)', 1.5);
    // 工具腰帶＋小工具
    lit(c, sh([[34, 288], [176, 288], [178, 304], [32, 304]]), '#2a1a12', '#ffc09a', 1.5, -1);
    for (const [x, h] of [[132, 22], [146, 16], [160, 26]] as P[]) {
      lit(c, sh([[x - 3, 288 - h], [x + 3, 288 - h], [x + 4, 290], [x - 4, 290]]), '#5a4a50', '#ffe0c8', 1, 0);
    }
    lit(c, sh([[92, 286], [118, 286], [118, 306], [92, 306]]), '#5a4030', '#ffd0a0', 1, 0);
    // 脖子
    lit(c, sh([[94, 136], [116, 136], [118, 176], [92, 176]]), SKIN(c, 136, 176), rim, 2, 0);
    // 圍巾（短，飄向右）
    lit(c, sm([[74, 168], [105, 176], [138, 166], [160, 172], [150, 190], [105, 196], [70, 188]]),
      vgrad(c, 166, 196, [[0, '#d0603a'], [1, '#5a2018']]), '#ffc09a', 2, 1);
    // 波浪鮑伯短髮（後側）
    lit(c, sm([[66, 128], [60, 96], [66, 66], [90, 46], [120, 46], [144, 66], [150, 96], [146, 130], [136, 140], [134, 110], [76, 110], [74, 140]]),
      vgrad(c, 46, 140, [[0, '#5a2e28'], [1, '#2a1218']]), '#ff7a5a', 3, -1);
    // 臉
    lit(c, sm([[80, 96], [84, 72], [105, 62], [126, 72], [130, 96], [126, 122], [114, 140], [105, 144], [96, 140], [84, 122]]),
      SKIN(c, 62, 144), rim, 3, -1);
    // 瀏海（波浪）
    lit(c, sm([[72, 98], [74, 70], [96, 54], [124, 56], [140, 74], [140, 98], [130, 86], [120, 92], [110, 80], [98, 92], [88, 82], [80, 96]]),
      vgrad(c, 54, 98, [[0, '#7a3a30'], [1, '#3a1a1e']]), '#ff7a5a', 2.5, -1);
    // 兩側翹起的髮尾
    lit(c, sm([[62, 120], [52, 140], [70, 136], [76, 124]]), '#3a1a1e', '#ff7a5a', 1.5, 0);
    lit(c, sm([[148, 120], [160, 142], [142, 136], [136, 124]]), '#3a1a1e', '#ff7a5a', 1.5, 0);
    // 額上的護目鏡（帶子＋雙鏡片）
    strokeLine(c, [[66, 74], [105, 64], [144, 74]], '#2a1e1a', 7);
    for (const x of [90, 120]) {
      lit(c, sm([[x - 14, 66], [x, 58], [x + 14, 66], [x + 12, 80], [x, 84], [x - 12, 80]]), '#4a3a34', '#ffd0a0', 1.5, 1);
      const lg = c.createRadialGradient(x - 3, 68, 1, x, 71, 10);
      lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.35, '#ffd0a0'); lg.addColorStop(1, '#a84a30');
      c.fillStyle = lg;
      c.beginPath(); c.arc(x, 71, 8, 0, Math.PI * 2); c.fill();
      glow(c, x, 71, 14, 0xff7a5a, 0.35);
    }
    // 眉（上揚）＋眼
    strokeLine(c, [[86, 100], [99, 97]], '#140a0c', 2.5);
    strokeLine(c, [[112, 97], [125, 99]], '#140a0c', 2.5);
    glowEye(c, 94, 109, 5.5, 0xffa070, -0.05);
    glowEye(c, 117, 109, 5.5, 0xffa070, 0.05);
    // 雀斑
    c.fillStyle = 'rgba(255,170,130,0.45)';
    for (const [x, y] of [[86, 120], [90, 123], [94, 120], [116, 120], [120, 123], [124, 120]] as P[]) {
      c.beginPath(); c.arc(x, y, 1.1, 0, Math.PI * 2); c.fill();
    }
    // 調皮的歪嘴笑
    c.save();
    c.strokeStyle = 'rgba(20,8,10,0.75)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(97, 129);
    c.quadraticCurveTo(106, 136, 116, 127);
    c.stroke();
    c.restore();
    strokeLine(c, [[116, 127], [118, 124]], 'rgba(20,8,10,0.6)', 1.5);
    // 戴手套的左手＋星燼燒瓶
    lit(c, sm([[20, 340], [24, 262], [34, 248], [52, 250], [58, 268], [52, 340]]), BODY(c, '#3a2c3a'), rim, 2, -1);
    glow(c, 42, 222, 54, 0xff7a5a, 0.7);
    lit(c, sm([[30, 256], [56, 256], [58, 270], [28, 270]]), '#5a3a26', '#ffd0a0', 1, 0);
    // 燒瓶（瓶頸＋圓瓶身）
    const fg = c.createRadialGradient(40, 228, 2, 42, 230, 20);
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.3, '#ffe0a0'); fg.addColorStop(0.7, '#ff7a5a'); fg.addColorStop(1, '#a03a2a');
    c.fillStyle = fg;
    c.beginPath(); c.arc(42, 234, 18, 0, Math.PI * 2); c.fill();
    c.fillRect(37, 198, 10, 22);
    c.fillStyle = '#5a3a26';
    c.fillRect(35, 192, 14, 8);
    strokeLine(c, [[32, 226], [36, 220]], 'rgba(255,255,255,0.8)', 2);
    glow(c, 42, 234, 26, 0xfff0c0, 0.7);
    // 星燼火花
    for (const [x, y, r] of [[60, 196, 3], [24, 184, 2.5], [70, 160, 2], [16, 230, 2], [178, 120, 2.5], [186, 70, 2]] as [number, number, number][]) {
      sparkle(c, x, y, r * 1.6, 0xff7a5a, 0.9);
    }
  });
}
