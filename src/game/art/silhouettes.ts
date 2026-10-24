// 程式生成的角色／敵人剪影材質（05：剪影 + 邊緣光）。
// 做法：先用邊緣光色描邊整個輪廓，再把深色本體往右下偏移填上，只留下左上側的亮邊 → 便宜的 rim light。
import Phaser from 'phaser';
import { AH, AW, drawIo, drawLian } from './animePortraits';
import { drawLiora, drawRourke, drawSerin } from './animeCompanions';

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

  generateCh3Combatants(scene);
  generateCh4Combatants(scene);
  generateCh5Combatants(scene);
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

  generateCh3Portraits(scene);
  generateCh4Portraits(scene);
}

export const heroArtKey = (id: string): string => `hero_${id}`;
/** 共用美術的敵人（終局核心沿用蝕星者本體） */
const ENEMY_ART_ALIAS: Record<string, string> = { boss_starfall_core: 'boss_starfall' };
export const enemyArtKey = (id: string): string => `enemy_${ENEMY_ART_ALIAS[id] ?? id}`;

// ======================================================================
// Canvas 2D 共用小工具（NPC 立繪、第三章以後的敵人）。
// 主角群對話立繪改為動漫風高解析版：animePortraits.ts / animeCompanions.ts（600×900）。
// ======================================================================
type Ctx = CanvasRenderingContext2D;
type PathFn = (c: Ctx) => void;

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

/** 高解析動漫立繪（顯示尺寸與手繪立繪相同：約 600px 高）。 */
export const HD_PORTRAITS: ReadonlySet<string> = new Set(['portrait_lian', 'portrait_io', 'portrait_serin', 'portrait_liora', 'portrait_rourke']);

function hdPortrait(scene: Phaser.Scene, key: string, draw: (c: Ctx) => void): void {
  ART[key] = { key, w: AW, h: AH, footY: AH / 2 };
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, AW, AH);
  if (!tex) return;
  const c = tex.getContext();
  c.clearRect(0, 0, AW, AH);
  draw(c);
  // 底部漸隱：半身像自然沒入對話框
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const g = c.createLinearGradient(0, AH - 170, 0, AH);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = g;
  c.fillRect(0, AH - 170, AW, 170);
  c.restore();
  tex.refresh();
}

function generateHeroPortraits(scene: Phaser.Scene): void {
  // 男女主角：動漫風高解析立繪（animePortraits.ts，600×900）
  hdPortrait(scene, 'portrait_lian', drawLian);
  hdPortrait(scene, 'portrait_io', drawIo);
  hdPortrait(scene, 'portrait_serin', drawSerin);
  hdPortrait(scene, 'portrait_liora', drawLiora);
  hdPortrait(scene, 'portrait_rourke', drawRourke);

}

// ======================================================================
// 第三章「星冠」：王都的敵人與居民（Canvas 2D，2 倍解析度，與 make() 同尺寸規格）
// ======================================================================

/** 以 Canvas 繪製、2 倍解析度的材質（邏輯尺寸 w×h，與 make() 的 ART 規格一致）。 */
function canvasArt(
  scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, glowInfo?: ArtInfo['glow'],
): void {
  ART[key] = { key, w, h, footY: h / 2 - 6, glow: glowInfo };
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w * 2, h * 2);
  if (!tex) return;
  const c = tex.getContext();
  c.clearRect(0, 0, w * 2, h * 2);
  c.save();
  c.scale(2, 2);
  draw(c);
  c.restore();
  tex.refresh();
}

/** 五芒星路徑。 */
function starPath(c: Ctx, x: number, y: number, ro: number, ri: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

/** 發光的符文接縫（亮線＋沿線光暈）。 */
function seam(c: Ctx, pts: P[], color: number, w = 2): void {
  for (const [x, y] of pts) glow(c, x, y, 9, color, 0.35);
  strokeLine(c, pts, rgba(color, 0.95), w);
  strokeLine(c, pts, 'rgba(255,255,255,0.7)', w * 0.35);
}

function generateCh3Combatants(scene: Phaser.Scene): void {
  // ---------------- 下水道蝕鼠：臃腫的身軀爬滿紫色蝕紋 ----------------
  canvasArt(scene, 'enemy_sewer_rat', 190, 140, (c) => {
    const rim = '#c4a6ff';
    glow(c, 100, 84, 55, 0x8040c0, 0.2);
    strokeLine(c, [[162, 112], [180, 126], [188, 110], [182, 94]], '#1a1222', 6);
    strokeLine(c, [[160, 110], [178, 123], [186, 108]], 'rgba(196,166,255,0.55)', 1.5);
    lit(c, sm([[130, 112], [152, 114], [158, 136], [134, 136]]), '#110b18', rim, 2, 2);
    lit(c, sm([[56, 112], [78, 112], [78, 136], [52, 136]]), '#110b18', rim, 2, 2);
    lit(c, sm([[34, 96], [44, 64], [80, 42], [120, 36], [156, 50], [178, 80], [174, 112], [150, 126], [90, 130], [50, 122]]),
      vgrad(c, 36, 130, [[0, '#2c2040'], [1, '#090610']]), rim, 3, 3);
    // 背上的瘤與蝕紋
    for (const [x, y, rr] of [[96, 52, 7], [124, 50, 5], [140, 70, 6], [110, 72, 4]] as [number, number, number][]) {
      glow(c, x, y, rr * 3, 0xb050ff, 0.55);
      c.fillStyle = '#e0b0ff';
      c.beginPath(); c.arc(x, y, rr * 0.45, 0, Math.PI * 2); c.fill();
    }
    seam(c, [[70, 60], [84, 80], [78, 100], [92, 118]], 0xb860ff);
    seam(c, [[116, 44], [112, 70], [132, 92], [126, 116]], 0xb860ff);
    seam(c, [[152, 62], [146, 84], [162, 100]], 0xb860ff, 1.6);
    // 頭
    lit(c, sm([[4, 100], [14, 84], [36, 68], [62, 70], [74, 94], [58, 114], [26, 112]]),
      vgrad(c, 68, 114, [[0, '#2c2040'], [1, '#0b0814']]), rim, 2.5, 2.5);
    lit(c, sm([[38, 74], [32, 46], [54, 50], [60, 72]]), '#1a1226', rim, 2, 2);
    glow(c, 46, 60, 9, 0xff70c0, 0.4);
    // 鬍鬚、牙
    for (const [x1, y1] of [[-4, 90], [-2, 102], [2, 110]] as P[]) strokeLine(c, [[14, 98], [x1, y1]], 'rgba(220,200,255,0.45)', 1);
    c.fillStyle = '#f2e8da';
    for (const x of [12, 18]) { c.beginPath(); c.moveTo(x, 104); c.lineTo(x + 5, 104); c.lineTo(x + 2.5, 114); c.fill(); }
    c.fillStyle = '#ff9ad8';
    c.beginPath(); c.arc(6, 98, 2.6, 0, Math.PI * 2); c.fill();
    glowEye(c, 32, 86, 4.5, 0xff4ad0, 0.2);
    glowEye(c, 46, 83, 3, 0xff4ad0, 0.2);
  });

  // ---------------- 夜巷打手：兜帽、高舉釘棍、腰間提燈照亮半邊身 ----------------
  canvasArt(scene, 'enemy_alley_thug', 150, 200, (c) => {
    const rim = '#ffb565';
    glow(c, 46, 140, 44, 0xffa54a, 0.4);
    // 釘棍
    strokeLine(c, [[108, 100], [136, 20]], '#1a1210', 12);
    strokeLine(c, [[103, 98], [130, 20]], 'rgba(255,181,101,0.45)', 2);
    for (const [x, y] of [[130, 30], [138, 38], [126, 46], [136, 54]] as P[]) strokeLine(c, [[x, y], [x + (x > 132 ? 6 : -6), y - 3]], '#d8c8b0', 1.8);
    // 腿
    lit(c, sh([[46, 150], [72, 150], [70, 198], [40, 198]]), '#0e0a10', rim, 3, -1);
    lit(c, sh([[78, 150], [104, 150], [112, 198], [84, 198]]), '#0e0a10', rim, 3, -1);
    // 外套
    lit(c, sm([[34, 172], [28, 110], [42, 70], [76, 58], [108, 68], [124, 104], [120, 172], [76, 180]]),
      vgrad(c, 58, 180, [[0, '#2c2228'], [1, '#0a070a']]), rim, 3, -1);
    strokeLine(c, [[76, 84], [74, 176]], 'rgba(0,0,0,0.45)', 2);
    lit(c, sh([[34, 140], [118, 140], [118, 148], [34, 148]]), '#2a1a12', '#ffd09a', 1.5, -1);
    // 高舉的手臂
    lit(c, sm([[94, 82], [116, 60], [126, 90], [112, 108], [98, 100]]), '#1a1418', rim, 2, -1);
    lit(c, sm([[104, 92], [118, 88], [122, 102], [108, 106]]), '#2a2026', rim, 1.5, -1);
    // 下垂的手臂與提燈
    lit(c, sm([[38, 82], [22, 104], [18, 126], [30, 128], [46, 104]]), '#1a1418', rim, 3, -1);
    strokeLine(c, [[24, 126], [24, 134]], '#3a2a20', 2);
    lit(c, sh([[14, 134], [34, 134], [30, 130], [18, 130]]), '#3a2a20', '#ffd27a', 1, 1);
    const lg = c.createRadialGradient(24, 144, 1, 24, 144, 11);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.35, '#ffe0a0'); lg.addColorStop(1, '#ff8a3a');
    c.fillStyle = lg;
    sm([[15, 134], [33, 134], [35, 146], [31, 156], [17, 156], [13, 146]])(c);
    c.fill();
    lit(c, sh([[14, 156], [34, 156], [30, 161], [18, 161]]), '#3a2a20', '#ffd27a', 1, 1);
    glow(c, 24, 145, 22, 0xfff0c0, 0.75);
    // 兜帽與陰影中的臉
    lit(c, sm([[48, 74], [50, 40], [74, 22], [98, 34], [106, 66], [92, 82], [60, 84]]),
      vgrad(c, 22, 84, [[0, '#362a30'], [1, '#120c10']]), rim, 3, -1);
    c.fillStyle = '#050306';
    sm([[60, 52], [86, 50], [96, 66], [86, 80], [64, 80], [56, 66]])(c);
    c.fill();
    lit(c, sh([[58, 68], [94, 68], [90, 80], [62, 80]]), '#2a1e1a', '#ffb565', 1, -1);
    glowEye(c, 68, 61, 3.2, 0xffc060, 0.1);
    glowEye(c, 84, 61, 3.2, 0xffc060, -0.1);
  }, { x: 24, y: 145, color: 0xffa54a, scale: 0.6 });

  // ---------------- 研究院衛兵：冷光鎧甲、星紋偃月長刀、胸口符文 ----------------
  canvasArt(scene, 'enemy_academy_guard', 160, 230, (c) => {
    const rim = '#d6e8ff';
    const steel = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#4a5878'], [0.5, '#232c44'], [1, '#0c1020']]);
    glow(c, 80, 110, 78, 0x7fb8ff, 0.15);
    // 披風
    lit(c, sm([[34, 92], [126, 92], [140, 228], [20, 228]]), vgrad(c, 92, 228, [[0, '#18244a'], [1, '#070a18']]), '#9fc0ff', 2.5, 2.5);
    // 長刀（右側）
    strokeLine(c, [[132, 228], [132, 30]], '#141826', 6);
    strokeLine(c, [[130, 228], [130, 30]], 'rgba(214,232,255,0.6)', 1.5);
    glow(c, 140, 42, 20, 0x7fd8ff, 0.4);
    lit(c, sm([[134, 6], [156, 22], [158, 52], [146, 74], [134, 70], [140, 46]]),
      vgrad(c, 6, 74, [[0, '#e8f4ff'], [1, '#5a7aa8']]), '#ffffff', 1.5, 1.5);
    seam(c, [[144, 24], [150, 40], [146, 58]], 0x7fd8ff, 1.5);
    sparkle(c, 150, 40, 4, 0x9fe0ff);
    lit(c, sh([[124, 72], [140, 72], [138, 80], [126, 80]]), '#2a3048', rim, 1, 1);
    // 腿甲
    lit(c, sh([[50, 170], [76, 170], [74, 228], [46, 228]]), steel(170, 228), rim, 2, 2);
    lit(c, sh([[84, 170], [110, 170], [114, 228], [86, 228]]), steel(170, 228), rim, 2, 2);
    // 軀幹與裙甲
    lit(c, sm([[42, 96], [118, 96], [124, 140], [114, 178], [46, 178], [36, 140]]), steel(96, 178), rim, 2.5, 2.5);
    for (let k = 0; k < 4; k++) {
      lit(c, sh([[40 + k * 20, 168], [60 + k * 20, 168], [58 + k * 20, 196], [42 + k * 20, 196]]), steel(168, 196), rim, 1.5, 1.5);
    }
    // 胸口符文
    glow(c, 80, 128, 30, 0x7fd8ff, 0.8);
    starPath(c, 80, 128, 11, 4.5);
    c.fillStyle = '#e8f8ff';
    c.fill();
    c.strokeStyle = rgba(0x7fd8ff, 0.9);
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(80, 128, 16, 0, Math.PI * 2); c.stroke();
    // 肩甲
    lit(c, sm([[22, 104], [30, 86], [58, 82], [62, 104], [46, 118], [24, 120]]), steel(82, 120), '#ffffff', 2, 2);
    lit(c, sm([[98, 104], [102, 82], [130, 86], [138, 104], [136, 120], [114, 118]]), steel(82, 120), '#ffffff', 2, 2);
    // 握刀的手
    lit(c, sm([[120, 112], [138, 110], [140, 128], [122, 130]]), steel(110, 130), rim, 1.5, 1.5);
    // 頭盔＋高冠
    lit(c, sh([[74, 10], [86, 10], [92, 34], [68, 34]]), steel(10, 34), '#ffffff', 1.5, 1.5);
    lit(c, sm([[58, 50], [62, 30], [80, 22], [98, 30], [102, 50], [100, 80], [80, 90], [60, 80]]), steel(22, 90), '#ffffff', 2.5, 2.5);
    c.fillStyle = '#04060c';
    c.fillRect(64, 52, 32, 6);
    glow(c, 80, 55, 22, 0x7fd8ff, 0.7);
    c.fillStyle = '#bfeaff';
    c.fillRect(66, 54, 28, 2);
    strokeLine(c, [[80, 60], [80, 84]], 'rgba(0,0,0,0.4)', 1.5);
  }, { x: 80, y: 128, color: 0x7fd8ff, scale: 0.5 });

  // ---------------- 符文獵犬：板甲拼成的構裝獵犬，接縫透出星紋光 ----------------
  canvasArt(scene, 'enemy_rune_hound', 210, 150, (c) => {
    const rim = '#bfe0ff';
    const C = 0x6fd0ff;
    const plate = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#3a4660'], [1, '#0c1018']]);
    glow(c, 100, 90, 58, 0x4f9fff, 0.16);
    // 後腿、前腿（分節）
    for (const [x, d] of [[150, 1], [170, 1], [52, -1], [72, -1]] as [number, number][]) {
      lit(c, sh([[x - 8, 96], [x + 8, 96], [x + 4 + d * 4, 122], [x - 6 + d * 4, 122]]), plate(96, 122), rim, 1.5, 1.5);
      lit(c, sh([[x - 5 + d * 4, 122], [x + 5 + d * 4, 122], [x + 2, 144], [x - 10, 146], [x - 9, 140]]), plate(122, 146), rim, 1.5, 1.5);
      glow(c, x + d * 2, 122, 6, C, 0.8);
    }
    // 尾（鏈節）
    for (let k = 0; k < 4; k++) {
      const x = 184 + k * 6;
      const y = 74 - k * 10;
      lit(c, sh([[x - 4, y], [x + 4, y - 4], [x + 6, y + 4], [x - 2, y + 8]]), plate(y - 4, y + 8), rim, 1, 1);
    }
    // 軀幹
    lit(c, sh([[44, 70], [66, 48], [120, 44], [168, 54], [190, 76], [178, 102], [120, 108], [60, 104], [40, 90]]), plate(44, 108), rim, 2.5, 2.5);
    // 背甲片
    lit(c, sh([[70, 50], [100, 40], [108, 62], [76, 68]]), plate(40, 68), '#ffffff', 1.5, 1.5);
    lit(c, sh([[112, 42], [146, 46], [140, 68], [112, 64]]), plate(42, 68), '#ffffff', 1.5, 1.5);
    lit(c, sh([[150, 50], [176, 62], [168, 80], [146, 70]]), plate(50, 80), '#ffffff', 1.5, 1.5);
    // 星紋接縫
    seam(c, [[74, 70], [110, 66], [144, 72], [170, 84]], C);
    seam(c, [[108, 62], [104, 86], [118, 104]], C, 1.6);
    seam(c, [[144, 70], [150, 96]], C, 1.6);
    for (const [x, y] of [[110, 66], [144, 72], [104, 86]] as P[]) sparkle(c, x, y, 4, C);
    // 頭（楔形）
    lit(c, sh([[2, 84], [20, 66], [44, 54], [62, 64], [60, 88], [40, 98], [12, 96]]), plate(54, 98), '#ffffff', 2, 2);
    lit(c, sh([[44, 54], [52, 30], [60, 58]]), plate(30, 58), '#ffffff', 1.2, 1.2);
    seam(c, [[10, 88], [36, 86], [54, 78]], C, 1.4);
    c.fillStyle = '#04060c';
    c.beginPath(); c.moveTo(4, 90); c.lineTo(34, 92); c.lineTo(10, 98); c.fill();
    glowEye(c, 30, 72, 5, C, -0.2);
  }, { x: 110, y: 66, color: 0x6fd0ff, scale: 0.6 });

  // ---------------- 洛克（敵方）：重甲老兵、斧槍、圍巾，暖琥珀邊緣光 ----------------
  const drawRourke = (c: Ctx): void => {
    const rim = '#ffc27a';
    const A = 0xffa54a;
    const armor = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#4a4248'], [0.5, '#24202a'], [1, '#0c0a10']]);
    glow(c, 130, 150, 128, A, 0.14);
    // 圍巾飄尾（向右後方）
    lit(c, sm([[150, 96], [196, 92], [238, 110], [256, 150], [240, 146], [250, 182], [222, 160], [196, 128], [160, 118]]),
      vgrad(c, 92, 182, [[0, '#9a3a2a'], [1, '#3a1214']]), '#ffb07a', 3, 2);
    // 斧槍（左手側立）
    strokeLine(c, [[42, 300], [42, 18]], '#16100e', 8);
    strokeLine(c, [[39, 300], [39, 18]], 'rgba(255,194,122,0.6)', 2);
    glow(c, 40, 60, 38, A, 0.3);
    lit(c, sm([[40, 40], [14, 26], [2, 50], [4, 80], [16, 102], [40, 86]]),
      vgrad(c, 26, 102, [[0, '#5a525c'], [1, '#18141c']]), '#ffe0b0', 2.5, 2);
    strokeLine(c, [[6, 52], [8, 82], [16, 98]], 'rgba(255,240,210,0.85)', 1.5);
    lit(c, sh([[44, 46], [64, 56], [44, 66]]), '#2a2428', '#ffe0b0', 1.5, 1.5);
    lit(c, sh([[36, 22], [42, 0], [48, 22]]), '#3a3238', '#ffe0b0', 1.5, 1.5);
    lit(c, sh([[34, 86], [50, 86], [48, 94], [36, 94]]), '#3a2a20', rim, 1, 1);
    // 腿與戰靴
    lit(c, sh([[82, 220], [124, 220], [120, 300], [76, 300]]), armor(220, 300), rim, 3, 2.5);
    lit(c, sh([[136, 220], [178, 220], [186, 300], [142, 300]]), armor(220, 300), rim, 3, 2.5);
    // 腰甲（裙甲板）
    for (let k = 0; k < 5; k++) {
      lit(c, sm([[70 + k * 24, 200], [96 + k * 24, 200], [94 + k * 24, 246], [72 + k * 24, 244]]), armor(200, 246), rim, 2, 2);
    }
    // 軀幹（寬胸板）
    lit(c, sm([[66, 100], [194, 100], [206, 150], [190, 214], [70, 214], [54, 150]]), armor(100, 214), rim, 3.5, 3);
    strokeLine(c, [[130, 110], [130, 200]], 'rgba(255,194,122,0.35)', 2);
    strokeLine(c, [[80, 150], [180, 150]], 'rgba(0,0,0,0.4)', 2);
    lit(c, sh([[64, 196], [196, 196], [196, 208], [64, 208]]), '#2a1a14', '#ffd09a', 1.5, 1.5);
    glow(c, 130, 202, 14, A, 0.7);
    lit(c, sh([[122, 196], [138, 196], [138, 210], [122, 210]]), '#c89a5a', '#fff0c8', 1, 1);
    // 巨大肩甲（雙層）
    lit(c, sm([[30, 130], [40, 96], [76, 82], [100, 98], [96, 130], [62, 146]]), armor(82, 146), '#ffe0b0', 3, 2.5);
    lit(c, sm([[38, 150], [46, 128], [86, 124], [92, 146], [62, 162]]), armor(124, 162), rim, 2, 2);
    lit(c, sm([[160, 98], [184, 82], [220, 96], [230, 130], [198, 146], [164, 130]]), armor(82, 146), '#ffe0b0', 3, 2.5);
    lit(c, sm([[168, 146], [174, 124], [214, 128], [222, 150], [198, 162]]), armor(124, 162), rim, 2, 2);
    for (const [x0, x1] of [[48, 90], [170, 214]] as P[]) strokeLine(c, [[x0, 104], [x1, 100]], 'rgba(255,194,122,0.6)', 1.5);
    // 握槍的手臂（右臂 → 畫面左）
    lit(c, sm([[46, 150], [66, 150], [66, 176], [52, 186], [40, 178]]), armor(150, 186), rim, 2, 2);
    lit(c, sm([[30, 168], [54, 166], [56, 186], [32, 190]]), '#3a3238', '#ffe0b0', 1.5, 1.5);
    // 左臂下垂
    lit(c, sm([[200, 150], [218, 150], [222, 196], [206, 210], [196, 190]]), armor(150, 210), rim, 2, 2);
    // 圍巾（頸）
    lit(c, sm([[96, 84], [130, 94], [166, 84], [172, 104], [150, 120], [130, 122], [108, 120], [90, 104]]),
      vgrad(c, 84, 122, [[0, '#b04a32'], [1, '#4a1618']]), '#ffc89a', 2.5, 2);
    strokeLine(c, [[100, 104], [130, 112], [162, 102]], 'rgba(0,0,0,0.3)', 2);
    // 頭
    lit(c, sh([[108, 42], [114, 26], [130, 20], [146, 26], [152, 42], [152, 66], [144, 82], [130, 88], [116, 82], [108, 66]]),
      vgrad(c, 20, 88, [[0, '#3a3248'], [1, '#18141f']]), rim, 3, 2);
    c.save();
    sh([[108, 62], [152, 62], [144, 82], [130, 88], [116, 82]])(c);
    c.clip();
    c.fillStyle = 'rgba(8,6,10,0.32)';
    c.fillRect(104, 60, 52, 32);
    c.restore();
    lit(c, sh([[104, 52], [102, 30], [114, 16], [132, 10], [150, 16], [158, 32], [156, 52], [150, 38], [136, 32], [120, 34], [110, 42]]),
      vgrad(c, 10, 52, [[0, '#4a3434'], [1, '#1a1216']]), rim, 2.5, 1.5);
    strokeLine(c, [[114, 46], [126, 44]], '#0a080c', 3);
    strokeLine(c, [[134, 44], [146, 46]], '#0a080c', 3);
    glowEye(c, 121, 52, 3.4, A, 0.05);
    glowEye(c, 140, 52, 3.4, 0xffd0a0, -0.05);
    strokeLine(c, [[138, 38], [144, 64]], 'rgba(255,200,160,0.5)', 1.2);
    strokeLine(c, [[122, 74], [138, 73]], 'rgba(0,0,0,0.55)', 1.5);
    // 飄散的餘燼
    for (const [x, y, rr] of [[70, 60, 2.5], [210, 70, 2], [236, 200, 2.5], [18, 140, 2], [96, 30, 1.6], [176, 30, 2]] as [number, number, number][]) {
      sparkle(c, x, y, rr * 1.6, A, 0.9);
    }
  };
  for (const key of ['enemy_boss_rourke_1', 'enemy_boss_rourke_2', 'enemy_boss_rourke_3']) {
    canvasArt(scene, key, 260, 300, drawRourke, { x: 20, y: 60, color: 0xffa54a, scale: 0.8 });
  }
}

// ---------------- 對話立繪（正面半身，170×240，與 npc_knight 同尺寸） ----------------
const NW = 170;
const NH = 240;

function npcHalo(c: Ctx, x: number, y: number, color: number, a = 0.22): void {
  const rr = Math.min(96, x, NW - x, y, NH - y);
  const g = c.createRadialGradient(x, y, 4, x, y, rr);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.6, rgba(color, a * 0.3));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, NW, NH);
}

const FACE: P[] = [[64, 64], [68, 46], [85, 38], [102, 46], [106, 64], [102, 86], [92, 100], [85, 103], [78, 100], [68, 86]];
const faceGrad = (c: Ctx): CanvasGradient => vgrad(c, 38, 104, [[0, '#30324e'], [1, '#171a2c']]);

function generateCh3Portraits(scene: Phaser.Scene): void {
  // 大司星 瓦爾德蘭：高瘦、垂墜長袍、高立領、星冠頭環；神情平靜，柔和紫金光。
  canvasArt(scene, 'npc_valderan', NW, NH, (c) => {
    const rim = '#dcc8ff';
    const G = 0xffd890;
    npcHalo(c, 85, 80, 0xa890ff, 0.28);
    // 長髮（銀白，垂到身後）
    lit(c, sm([[60, 60], [56, 110], [44, 170], [40, 240], [130, 240], [126, 170], [114, 110], [110, 60], [85, 34]]),
      vgrad(c, 34, 240, [[0, '#d8d8ec'], [0.5, '#8a88b0'], [1, '#2a2848']]), '#ffffff', 1.5, 2);
    // 高立領（左右扇形）
    for (const f of [1, -1]) {
      const X = (x: number): number => (f === 1 ? x : NW - x);
      lit(c, sm([[X(62), 116], [X(40), 104], [X(30), 64], [X(40), 50], [X(54), 84], [X(70), 100]]),
        vgrad(c, 50, 116, [[0, '#4a3a7a'], [1, '#160f2a']]), rim, f * 2, 2);
      strokeLine(c, [[X(40), 52], [X(32), 66], [X(42), 104], [X(62), 116]], rgba(G, 0.85), 1.4);
    }
    // 長袍
    lit(c, sm([[16, 260], [22, 160], [40, 126], [70, 112], [85, 116], [100, 112], [130, 126], [148, 160], [154, 260]]),
      vgrad(c, 112, 240, [[0, '#3a2c64'], [1, '#0c0818']]), rim, 2, 2.5);
    // 金邊聖帶
    for (const x of [70, 100]) {
      lit(c, sh([[x - 7, 116], [x + 7, 116], [x + 9, 250], [x - 9, 250]]), vgrad(c, 116, 240, [[0, '#5a4424'], [1, '#1e140c']]), '#ffe0a0', 1, 1.5);
      for (let y = 140; y < 240; y += 26) sparkle(c, x, y, 2.6, G, 0.8);
    }
    // 頸
    lit(c, sh([[78, 96], [92, 96], [94, 118], [76, 118]]), vgrad(c, 96, 118, [[0, '#262840'], [1, '#141626']]), rim, 1.5, 1);
    // 臉（修長）
    lit(c, sm([[66, 62], [70, 42], [85, 34], [100, 42], [104, 62], [100, 86], [92, 100], [85, 104], [78, 100], [70, 86]]),
      faceGrad(c), rim, 1.5, 2);
    // 前髮（中分）
    lit(c, sm([[60, 76], [62, 46], [85, 30], [108, 46], [110, 76], [104, 58], [94, 48], [85, 54], [76, 48], [66, 58]]),
      vgrad(c, 30, 76, [[0, '#f4f2ff'], [1, '#9a98c0']]), '#ffffff', 1, 1.5);
    // 星冠頭環
    strokeLine(c, [[64, 50], [85, 44], [106, 50]], rgba(G, 0.95), 1.8);
    for (const [x, y, h] of [[70, 47, 7], [77, 45, 9], [85, 44, 13], [93, 45, 9], [100, 47, 7]] as [number, number, number][]) {
      c.fillStyle = '#ffe6a8';
      c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x, y - h); c.lineTo(x + 2, y); c.fill();
      glow(c, x, y - h, 6, G, 0.7);
    }
    glow(c, 85, 46, 10, 0xb890ff, 0.8);
    c.fillStyle = '#e8d8ff';
    c.beginPath(); c.arc(85, 46, 2.2, 0, Math.PI * 2); c.fill();
    // 半闔的雙眼＋淺笑
    strokeLine(c, [[72, 66], [81, 65]], 'rgba(10,8,20,0.9)', 1.6);
    strokeLine(c, [[89, 65], [98, 66]], 'rgba(10,8,20,0.9)', 1.6);
    glowEye(c, 77, 70, 3.4, 0xc8a8ff, 0.05);
    glowEye(c, 93, 70, 3.4, 0xc8a8ff, -0.05);
    strokeLine(c, [[71, 68], [83, 68]], 'rgba(28,24,48,0.95)', 1.6);
    strokeLine(c, [[87, 68], [99, 68]], 'rgba(28,24,48,0.95)', 1.6);
    c.save();
    c.strokeStyle = 'rgba(10,6,16,0.7)';
    c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(80, 88); c.quadraticCurveTo(85, 91, 91, 87); c.stroke();
    c.restore();
    // 抬起的手托著一顆小星
    lit(c, sm([[124, 240], [122, 190], [130, 170], [146, 168], [150, 186], [144, 240]]), vgrad(c, 168, 240, [[0, '#3a2c64'], [1, '#0c0818']]), rim, 2, 2);
    lit(c, sm([[128, 172], [134, 158], [146, 156], [150, 168], [142, 176]]), faceGrad(c), rim, 1, 1);
    glow(c, 142, 140, 27, G, 0.6);
    glow(c, 142, 140, 18, 0xffffff, 0.6);
    starPath(c, 142, 140, 7, 2.8);
    c.fillStyle = '#fffaf0';
    c.fill();
    for (const [x, y, r] of [[22, 40, 3], [150, 60, 2.5], [30, 150, 2], [160, 110, 2], [120, 20, 2.5]] as [number, number, number][]) {
      sparkle(c, x, y, r, 0xb8a0ff);
    }
  });

  // 比武大會司儀：高禮帽、燕尾服、蝶形領結、八字鬍與招牌笑容（頂光）。
  canvasArt(scene, 'npc_announcer', NW, NH, (c) => {
    const rim = '#ffe0a0';
    npcHalo(c, 85, 70, 0xffd27a, 0.26);
    lit(c, sm([[12, 260], [18, 150], [40, 122], [70, 112], [85, 118], [100, 112], [130, 122], [152, 150], [158, 260]]),
      vgrad(c, 112, 240, [[0, '#3a1e2a'], [1, '#0e070c']]), rim, 0, 3);
    // 白襯衫 V 區＋翻領
    lit(c, sh([[70, 114], [100, 114], [92, 200], [78, 200]]), vgrad(c, 114, 200, [[0, '#d8d0c8'], [1, '#6a6460']]), '#ffffff', 0, 1.5);
    lit(c, sh([[60, 118], [74, 114], [84, 196], [66, 160]]), '#5a2232', rim, 0, 1.5);
    lit(c, sh([[110, 118], [96, 114], [86, 196], [104, 160]]), '#5a2232', rim, 0, 1.5);
    for (const y of [150, 168, 186]) { c.fillStyle = '#e8c070'; c.beginPath(); c.arc(85, y, 1.8, 0, Math.PI * 2); c.fill(); }
    // 胸花
    glow(c, 64, 140, 12, 0xff6a6a, 0.6);
    c.fillStyle = '#ff7a7a'; c.beginPath(); c.arc(64, 140, 4, 0, Math.PI * 2); c.fill();
    // 領結
    lit(c, sh([[70, 108], [84, 114], [70, 120]]), '#a02a3a', rim, 0, 1);
    lit(c, sh([[100, 108], [86, 114], [100, 120]]), '#a02a3a', rim, 0, 1);
    c.fillStyle = '#ffd27a'; c.fillRect(82, 111, 6, 6);
    lit(c, sh([[78, 96], [92, 96], [94, 110], [76, 110]]), faceGrad(c), rim, 0, 1);
    lit(c, sm(FACE), faceGrad(c), rim, 0, 2.5);
    // 眼＋眉（揚起）
    strokeLine(c, [[70, 60], [80, 56]], '#0a080c', 2.2);
    strokeLine(c, [[90, 56], [100, 60]], '#0a080c', 2.2);
    glowEye(c, 76, 66, 3.6, 0xffd27a, 0);
    glowEye(c, 94, 66, 3.6, 0xffd27a, 0);
    // 八字鬍＋大笑
    lit(c, sm([[66, 80], [76, 76], [85, 79], [94, 76], [104, 80], [108, 72], [110, 82], [96, 86], [85, 84], [74, 86], [60, 82], [62, 72]]),
      '#3a2a2a', '#ffe0a0', 0, 1);
    c.fillStyle = 'rgba(10,4,8,0.9)';
    c.beginPath(); c.moveTo(76, 88); c.quadraticCurveTo(85, 98, 94, 88); c.closePath(); c.fill();
    c.fillStyle = '#f0e8e0'; c.fillRect(79, 88, 12, 2);
    // 高禮帽
    lit(c, sh([[58, 46], [112, 46], [116, 52], [54, 52]]), '#1a0e14', rim, 0, 1.5);
    lit(c, sh([[66, 46], [68, 4], [102, 4], [104, 46]]), vgrad(c, 4, 46, [[0, '#3a2430'], [1, '#120a10']]), rim, 0, 2);
    lit(c, sh([[67, 34], [103, 34], [103, 42], [67, 42]]), '#a0783a', '#ffe8b0', 0, 1);
    sparkle(c, 94, 38, 3, 0xffd27a);
    // 舉起的手（白手套）
    lit(c, sm([[130, 240], [128, 170], [136, 142], [152, 138], [156, 160], [150, 240]]), vgrad(c, 138, 240, [[0, '#3a1e2a'], [1, '#0e070c']]), rim, 0, 2);
    lit(c, sm([[134, 142], [134, 124], [140, 112], [148, 116], [156, 124], [156, 142]]), '#d8d0c8', '#ffffff', 0, 1.5);
    for (const [x, y] of [[20, 30], [150, 30], [30, 100], [158, 80]] as P[]) sparkle(c, x, y, 3, 0xffd27a);
  });

  // 牌會荷官：油亮後梳髮、綠色遮光帽簷、背心袖箍；手持扇形牌，似笑非笑。
  canvasArt(scene, 'npc_dealer', NW, NH, (c) => {
    const rim = '#96ecd4';
    const T = 0x6fe0c0;
    npcHalo(c, 85, 90, T, 0.22);
    lit(c, sm([[14, 260], [20, 150], [42, 124], [70, 114], [85, 118], [100, 114], [128, 124], [150, 150], [156, 260]]),
      vgrad(c, 114, 240, [[0, '#d8d0c4'], [1, '#4a4644']]), '#ffffff', 2.5, 2);
    // 背心
    lit(c, sm([[40, 260], [38, 150], [62, 120], [85, 170], [108, 120], [132, 150], [130, 260]]),
      vgrad(c, 120, 240, [[0, '#183a34'], [1, '#06100e']]), rim, 2.5, 2);
    for (const y of [182, 200, 218]) { c.fillStyle = '#e8c070'; c.beginPath(); c.arc(85, y, 1.8, 0, Math.PI * 2); c.fill(); }
    // 細領帶
    lit(c, sh([[82, 116], [88, 116], [90, 168], [85, 176], [80, 168]]), '#1a1a20', rim, 1, 1);
    // 袖箍
    lit(c, sh([[20, 176], [38, 172], [38, 180], [20, 184]]), '#2a1a12', '#ffd09a', 1, 1);
    lit(c, sh([[78, 96], [92, 96], [94, 116], [76, 116]]), faceGrad(c), rim, 1.5, 1);
    lit(c, sm(FACE), faceGrad(c), rim, 2, 2);
    // 後梳油頭＋一撮垂髮
    lit(c, sm([[62, 60], [62, 40], [76, 30], [96, 30], [108, 42], [108, 60], [100, 46], [86, 42], [72, 46]]),
      vgrad(c, 30, 60, [[0, '#1e2a2a'], [1, '#0a0e10']]), rim, 2, 1.5);
    strokeLine(c, [[70, 40], [96, 34]], 'rgba(150,236,212,0.5)', 1.2);
    strokeLine(c, [[96, 44], [102, 56], [98, 64]], '#141c1e', 2);
    // 遮光帽簷（半透明綠）
    c.save();
    c.fillStyle = 'rgba(80,200,150,0.45)';
    c.beginPath(); c.moveTo(58, 52); c.quadraticCurveTo(85, 40, 112, 52); c.lineTo(118, 62); c.quadraticCurveTo(85, 54, 52, 62); c.closePath(); c.fill();
    c.restore();
    strokeLine(c, [[52, 62], [85, 55], [118, 62]], rgba(T, 0.9), 1.4);
    strokeLine(c, [[60, 50], [85, 44], [110, 50]], 'rgba(10,20,20,0.9)', 2.5);
    // 一眼瞇起、一眼斜睨
    strokeLine(c, [[71, 69], [81, 70]], '#081010', 1.8);
    glowEye(c, 76, 71, 3.4, T, 0.1);
    strokeLine(c, [[71, 70], [81, 71]], 'rgba(24,30,40,0.95)', 1.8);
    strokeLine(c, [[89, 64], [99, 66]], '#081010', 2);
    glowEye(c, 94, 70, 3.6, T, -0.1);
    // 歪嘴笑
    c.save();
    c.strokeStyle = 'rgba(8,10,12,0.8)';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(77, 88); c.quadraticCurveTo(88, 92, 97, 84); c.stroke();
    c.restore();
    // 扇形牌（右手，抬到下巴旁）
    lit(c, sm([[118, 240], [118, 190], [128, 170], [146, 168], [152, 186], [144, 240]]), vgrad(c, 168, 240, [[0, '#d8d0c4'], [1, '#4a4644']]), '#ffffff', 2, 2);
    glow(c, 136, 140, 32, T, 0.35);
    for (let k = 0; k < 5; k++) {
      c.save();
      c.translate(138, 168);
      c.rotate(-0.7 + k * 0.32);
      c.fillStyle = '#f4ece0';
      c.fillRect(-9, -46, 18, 28);
      c.strokeStyle = rgba(T, 0.9);
      c.lineWidth = 1;
      c.strokeRect(-9, -46, 18, 28);
      c.fillStyle = k % 2 ? '#c02a3a' : '#1a1a24';
      c.beginPath(); c.moveTo(0, -38); c.lineTo(4, -32); c.lineTo(0, -26); c.lineTo(-4, -32); c.fill();
      c.restore();
    }
    lit(c, sm([[126, 172], [132, 160], [146, 158], [150, 170], [140, 178]]), faceGrad(c), rim, 1, 1);
    sparkle(c, 120, 112, 3.2, T);
  });

  // 研究院研究員：圓眼鏡反光、亂髮夾著筆、高領學袍、懷抱筆記；冷藍光。
  canvasArt(scene, 'npc_researcher', NW, NH, (c) => {
    const rim = '#b4dcff';
    const B = 0x7fc8ff;
    npcHalo(c, 85, 80, B, 0.24);
    lit(c, sm([[16, 260], [22, 156], [42, 126], [70, 114], [85, 118], [100, 114], [128, 126], [148, 156], [154, 260]]),
      vgrad(c, 114, 240, [[0, '#24344e'], [1, '#080c16']]), rim, 2, 2.5);
    // 高領＋研究院星章
    lit(c, sm([[66, 104], [85, 110], [104, 104], [110, 124], [85, 130], [60, 124]]), vgrad(c, 104, 130, [[0, '#3a4c6a'], [1, '#141c2c']]), rim, 1.5, 1.5);
    glow(c, 60, 150, 14, B, 0.6);
    starPath(c, 60, 150, 5, 2);
    c.fillStyle = '#d8f0ff';
    c.fill();
    strokeLine(c, [[85, 130], [85, 240]], 'rgba(0,0,0,0.35)', 2);
    lit(c, sh([[78, 92], [92, 92], [94, 110], [76, 110]]), faceGrad(c), rim, 1.5, 1);
    lit(c, sm(FACE), faceGrad(c), rim, 1.5, 2);
    // 亂髮包頭＋插著的筆
    strokeLine(c, [[96, 22], [120, 4]], '#c8a060', 2.5);
    lit(c, sm([[86, 6], [100, 8], [104, 22], [92, 28], [80, 22], [78, 12]]), vgrad(c, 6, 28, [[0, '#4a3a4a'], [1, '#1a141c']]), rim, 1.5, 1.5);
    lit(c, sh([[60, 70], [58, 44], [70, 30], [86, 26], [102, 30], [112, 44], [112, 72], [106, 56], [98, 50], [92, 56], [84, 48], [76, 56], [68, 52], [64, 62]]),
      vgrad(c, 26, 72, [[0, '#4a3a4a'], [1, '#1a141c']]), rim, 1.5, 1.5);
    for (const [x, y] of [[60, 70], [112, 72], [64, 78]] as P[]) strokeLine(c, [[x, y - 10], [x + (x < 85 ? -4 : 4), y]], '#2a1e2a', 1.5);
    // 圓眼鏡（反光）
    for (const x of [76, 95]) {
      c.save();
      const lg = c.createLinearGradient(x - 8, 60, x + 8, 76);
      lg.addColorStop(0, 'rgba(220,240,255,0.85)');
      lg.addColorStop(0.5, 'rgba(120,190,255,0.45)');
      lg.addColorStop(1, 'rgba(60,110,200,0.25)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(x, 68, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#c8a060';
      c.lineWidth = 1.4;
      c.stroke();
      c.restore();
      glow(c, x - 2, 65, 10, B, 0.6);
    }
    strokeLine(c, [[84, 68], [87, 68]], '#c8a060', 1.4);
    strokeLine(c, [[80, 90], [90, 90]], 'rgba(0,0,0,0.45)', 1.3);
    // 抱在胸前的筆記與符文紙
    lit(c, sh([[50, 176], [120, 164], [126, 220], [56, 232]]), vgrad(c, 164, 232, [[0, '#5a4430'], [1, '#2a1e14']]), '#ffe0b0', 1.5, 1.5);
    lit(c, sh([[58, 180], [114, 170], [118, 214], [62, 224]]), '#e8e0d0', '#ffffff', 1, 1);
    seam(c, [[70, 192], [86, 186], [100, 196], [92, 208]], B, 1.2);
    lit(c, sm([[40, 240], [36, 200], [50, 188], [64, 196], [60, 240]]), vgrad(c, 188, 240, [[0, '#24344e'], [1, '#080c16']]), rim, 1.5, 1.5);
    lit(c, sm([[110, 240], [112, 196], [126, 186], [138, 198], [132, 240]]), vgrad(c, 186, 240, [[0, '#24344e'], [1, '#080c16']]), rim, 1.5, 1.5);
    for (const [x, y] of [[24, 60], [146, 40], [150, 120]] as P[]) sparkle(c, x, y, 2.6, B);
  });

  // 夜市攤販：頭巾、圓臉、圍裙，手提竹竿紙燈籠（暖橙光）。
  canvasArt(scene, 'npc_vendor', NW, NH, (c) => {
    const rim = '#ffb080';
    const O = 0xff8a4a;
    npcHalo(c, 64, 120, O, 0.3);
    lit(c, sm([[12, 260], [18, 158], [40, 126], [70, 116], [85, 120], [100, 116], [130, 126], [152, 158], [158, 260]]),
      vgrad(c, 116, 240, [[0, '#3a2a2a'], [1, '#0e0808']]), rim, -2.5, 1);
    // 圍裙
    lit(c, sm([[54, 132], [116, 132], [122, 260], [48, 260]]), vgrad(c, 132, 240, [[0, '#6a4a34'], [1, '#2a1a12']]), '#ffd0a0', -1.5, 1);
    strokeLine(c, [[54, 132], [70, 116]], '#4a3424', 2);
    strokeLine(c, [[116, 132], [100, 116]], '#4a3424', 2);
    lit(c, sh([[64, 180], [106, 180], [104, 204], [66, 204]]), '#4a3424', '#ffd0a0', -1, 1);
    lit(c, sh([[78, 100], [92, 100], [94, 120], [76, 120]]), faceGrad(c), rim, -1.5, 1);
    lit(c, sm([[62, 70], [66, 52], [85, 44], [104, 52], [108, 70], [104, 92], [92, 104], [85, 106], [78, 104], [66, 92]]), faceGrad(c), rim, -2, 1.5);
    // 頭巾（結在右側）
    lit(c, sm([[58, 70], [58, 46], [74, 32], [96, 32], [112, 46], [112, 70], [104, 58], [85, 54], [66, 58]]),
      vgrad(c, 32, 70, [[0, '#a03a2a'], [1, '#4a1614']]), rim, -2, 1);
    lit(c, sm([[108, 54], [126, 50], [130, 64], [118, 62], [124, 78], [110, 66]]), '#7a2a1e', rim, -1.5, 1);
    for (const [x, y] of [[72, 44], [86, 40], [100, 44], [80, 52], [94, 50]] as P[]) {
      c.fillStyle = 'rgba(255,220,160,0.6)'; c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
    }
    // 笑瞇瞇的眼＋酒窩笑
    c.save();
    c.strokeStyle = 'rgba(10,6,8,0.9)';
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    for (const x of [76, 94]) { c.beginPath(); c.arc(x, 74, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    c.beginPath(); c.moveTo(77, 90); c.quadraticCurveTo(85, 96, 93, 90); c.stroke();
    c.restore();
    glow(c, 76, 72, 6, O, 0.5);
    glow(c, 94, 72, 6, O, 0.5);
    c.fillStyle = 'rgba(255,140,120,0.3)';
    c.beginPath(); c.arc(68, 84, 4, 0, Math.PI * 2); c.arc(102, 84, 4, 0, Math.PI * 2); c.fill();
    // 提燈籠的手（左）＋竹竿＋紙燈籠
    lit(c, sm([[18, 240], [16, 190], [24, 168], [40, 166], [46, 186], [40, 240]]), vgrad(c, 166, 240, [[0, '#3a2a2a'], [1, '#0e0808']]), rim, -1.5, 1);
    lit(c, sm([[22, 170], [26, 158], [38, 156], [42, 168], [34, 176]]), faceGrad(c), rim, -1, 1);
    strokeLine(c, [[30, 166], [26, 96]], '#3a2a18', 3);
    strokeLine(c, [[26, 96], [22, 104]], '#3a2a18', 1.5);
    glow(c, 28, 126, 27, O, 0.75);
    const lg = c.createRadialGradient(19, 120, 1, 22, 126, 18);
    lg.addColorStop(0, '#fff6d8'); lg.addColorStop(0.45, '#ffa060'); lg.addColorStop(1, '#c03a20');
    c.fillStyle = lg;
    c.beginPath(); c.ellipse(22, 127, 13, 17, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(90,30,10,0.5)';
    c.lineWidth = 0.8;
    for (const k of [-0.6, 0, 0.6]) { c.beginPath(); c.ellipse(22, 127, 13 * Math.cos(k), 17, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#2a140c';
    c.fillRect(15, 108, 14, 4);
    c.fillRect(16, 142, 12, 3);
    strokeLine(c, [[22, 145], [22, 154]], '#c03a20', 1.5);
    for (const [x, y] of [[50, 90], [12, 70], [60, 140]] as P[]) sparkle(c, x, y, 2.4, O, 0.8);
  }, { x: 22, y: 127, color: 0xff8a4a, scale: 0.5 });

  // 城門衛隊長：全身板甲、開面盔＋羽飾、護頸、星冠紋章，鬍鬚嚴肅。
  canvasArt(scene, 'npc_gate_captain', NW, NH, (c) => {
    const rim = '#e4ecff';
    const G = 0xffd27a;
    const steel = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#6a7088'], [0.5, '#30344a'], [1, '#10121e']]);
    npcHalo(c, 85, 90, 0xc8d4ff, 0.2);
    // 披風（深紅）
    lit(c, sm([[4, 260], [10, 150], [30, 120], [140, 120], [160, 150], [166, 260]]), vgrad(c, 120, 240, [[0, '#6a1a22'], [1, '#1a060a']]), '#ff9a8a', 2, 2);
    // 胸甲
    lit(c, sm([[28, 260], [30, 150], [50, 124], [85, 116], [120, 124], [140, 150], [142, 260]]), steel(116, 240), rim, 2, 2.5);
    strokeLine(c, [[85, 130], [85, 240]], 'rgba(255,255,255,0.25)', 1.5);
    lit(c, sh([[34, 214], [136, 214], [136, 224], [34, 224]]), '#3a2a18', '#ffe0a0', 1, 1);
    // 紋章：星冠
    glow(c, 85, 170, 30, G, 0.55);
    c.fillStyle = '#ffe0a0';
    c.beginPath();
    c.moveTo(70, 180); c.lineTo(70, 166); c.lineTo(76, 172); c.lineTo(80, 160); c.lineTo(85, 168);
    c.lineTo(90, 160); c.lineTo(94, 172); c.lineTo(100, 166); c.lineTo(100, 180);
    c.closePath();
    c.fill();
    sparkle(c, 85, 152, 4, G);
    // 肩甲（三層）
    for (const f of [1, -1]) {
      const X = (x: number): number => (f === 1 ? x : NW - x);
      for (let k = 0; k < 3; k++) {
        const y = 124 + k * 16;
        lit(c, sm([[X(10 + k * 2), y + 20], [X(16 + k * 2), y], [X(56 - k * 2), y - 6], [X(64 - k * 2), y + 14], [X(36), y + 28]]), steel(y - 6, y + 28), '#ffffff', f * 2, 2);
        strokeLine(c, [[X(18 + k * 2), y + 2], [X(54 - k * 2), y - 4]], rgba(G, 0.7), 1.2);
      }
    }
    // 護頸
    lit(c, sm([[62, 106], [85, 100], [108, 106], [112, 126], [85, 132], [58, 126]]), steel(100, 132), '#ffffff', 1.5, 2);
    // 臉＋鬍
    lit(c, sm(FACE), faceGrad(c), rim, 1.5, 2);
    lit(c, sm([[66, 82], [76, 86], [85, 84], [94, 86], [104, 82], [104, 94], [94, 104], [85, 108], [76, 104], [66, 94]]),
      vgrad(c, 82, 108, [[0, '#6a6470'], [1, '#2a262e']]), '#ffffff', 1, 1);
    strokeLine(c, [[78, 92], [92, 92]], 'rgba(0,0,0,0.6)', 1.5);
    strokeLine(c, [[70, 62], [81, 64]], '#0a080c', 2.6);
    strokeLine(c, [[89, 64], [100, 62]], '#0a080c', 2.6);
    glowEye(c, 76, 70, 3.2, 0xc8d4ff, 0.08);
    glowEye(c, 94, 70, 3.2, 0xc8d4ff, -0.08);
    // 開面盔（含護鼻）＋羽飾
    lit(c, sm([[60, 30], [70, 6], [118, 0], [130, 12], [112, 28], [94, 26]]), vgrad(c, 0, 30, [[0, '#c03a3a'], [1, '#4a1014']]), '#ffc0b0', 1.5, 1.5);
    lit(c, sm([[60, 76], [58, 46], [70, 28], [85, 22], [100, 28], [112, 46], [110, 76], [104, 56], [94, 48], [76, 48], [66, 56]]), steel(22, 76), '#ffffff', 1.5, 2);
    lit(c, sh([[82, 46], [88, 46], [88, 74], [85, 78], [82, 74]]), steel(46, 78), '#ffffff', 1, 1);
    strokeLine(c, [[62, 50], [85, 44], [108, 50]], rgba(G, 0.85), 1.4);
    sparkle(c, 85, 30, 3, G);
  });
}

/** 第三章說話者 id → 立繪材質 key。 */
export const CH3_PORTRAITS: Record<string, string> = {
  valderan: 'npc_valderan',
  gate_captain: 'npc_gate_captain',
  announcer: 'npc_announcer',
  duelist_knight: 'npc_knight',
  duelist_miner: 'npc_miner',
  dealer: 'npc_dealer',
  researcher: 'npc_researcher',
  vendor: 'npc_vendor',
};

// ======================================================================
// 第四章「星核」：王立星學院地底的兵器與住民
// ======================================================================

/** 橢圓符文環（只畫 from→to 的弧段，方便分前後兩半繞過身體）。 */
function runeRing(c: Ctx, x: number, y: number, rx: number, ry: number, rot: number, color: number, from: number, to: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(color, 0.35);
  c.lineWidth = 6;
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, from, to); c.stroke();
  c.strokeStyle = rgba(color, 0.95);
  c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, from, to); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.75)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    const a = from + ((to - from) * (i + 0.5)) / 18;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    c.beginPath();
    c.moveTo(px - 2, py - 2.5);
    c.lineTo(px + 2, py + (i % 2 ? 2.5 : -1));
    c.stroke();
  }
  c.restore();
}

function generateCh4Combatants(scene: Phaser.Scene): void {
  // ---------------- 蝕化兵器原型：黃銅籠中的蝕影獸，紫色核心外露 ----------------
  canvasArt(scene, 'enemy_proto_weapon', 220, 200, (c) => {
    const V = 0xb060ff;
    const rim = '#d8b0ff';
    const brass = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#a8804a'], [0.5, '#5a4022'], [1, '#1e140a']]);
    glow(c, 110, 104, 100, 0x7030c0, 0.22);
    // 活塞機械腿
    for (const [x0, x1, d] of [[44, 18, -1], [74, 60, -1], [146, 160, 1], [176, 202, 1]] as [number, number, number][]) {
      strokeLine(c, [[x0, 140], [x0 + d * 14, 164], [x1, 196]], '#20160c', 9);
      strokeLine(c, [[x0, 140], [x0 + d * 14, 164], [x1, 196]], 'rgba(255,210,140,0.45)', 2);
      lit(c, sm([[x0 + d * 14 - 7, 158], [x0 + d * 14 + 7, 158], [x0 + d * 14 + 7, 170], [x0 + d * 14 - 7, 170]]), brass(158, 170), '#ffe0a0', 1, 1);
      lit(c, sh([[x1 - 10, 192], [x1 + 10, 192], [x1 + 6, 198], [x1 - 6, 198]]), brass(192, 198), '#ffe0a0', 1, 1);
    }
    // 籠底座
    lit(c, sh([[24, 132], [196, 132], [204, 148], [16, 148]]), brass(132, 148), '#ffe6b0', 2, 2);
    // 蝕影獸（籠內）
    lit(c, sm([[40, 128], [36, 92], [56, 60], [92, 42], [140, 44], [174, 66], [186, 100], [180, 130], [110, 136]]),
      vgrad(c, 42, 136, [[0, '#2a1640'], [1, '#0a0614']]), rim, 2.5, 2);
    // 外溢的蝕影觸鬚
    for (const pts of [[[40, 90], [14, 70], [8, 44]], [[180, 86], [208, 70], [214, 40]], [[70, 50], [56, 22], [64, 8]], [[150, 50], [166, 20], [158, 6]]] as P[][]) {
      strokeLine(c, pts, '#120a20', 6);
      strokeLine(c, pts, rgba(V, 0.6), 1.4);
    }
    // 紫色核心
    glow(c, 110, 94, 46, V, 0.75);
    c.fillStyle = '#f0d8ff';
    c.beginPath(); c.arc(110, 94, 11, 0, Math.PI * 2); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(V, 0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(110, 94, 18, 0, Math.PI * 2); c.stroke();
    c.restore();
    seam(c, [[110, 94], [84, 80], [64, 96]], V, 1.4);
    seam(c, [[110, 94], [138, 78], [160, 92]], V, 1.4);
    seam(c, [[110, 94], [112, 124]], V, 1.4);
    // 眼（多顆）
    glowEye(c, 74, 70, 5, V, -0.2);
    glowEye(c, 146, 70, 5, V, 0.2);
    glowEye(c, 110, 58, 3.2, 0xffffff, 0);
    // 黃銅籠條＋頂環
    for (let k = 0; k < 7; k++) {
      const x = 30 + k * 26.6;
      strokeLine(c, [[x, 134], [x + (110 - x) * 0.18, 30]], '#2a1c0c', 5);
      strokeLine(c, [[x - 1.2, 134], [x - 1.2 + (110 - x) * 0.18, 30]], 'rgba(255,214,150,0.8)', 1.4);
    }
    lit(c, sm([[40, 34], [110, 18], [180, 34], [176, 42], [110, 28], [44, 42]]), brass(18, 42), '#ffe6b0', 1.5, 1.5);
    lit(c, sh([[100, 4], [120, 4], [116, 22], [104, 22]]), brass(4, 22), '#ffe6b0', 1, 1);
    // 黃銅管線
    strokeLine(c, [[24, 140], [10, 120], [12, 100]], '#3a2810', 4);
    strokeLine(c, [[196, 140], [210, 118], [206, 96]], '#3a2810', 4);
    for (const [x, y] of [[12, 100], [206, 96], [20, 12], [200, 20]] as P[]) sparkle(c, x, y, 3, V);
  }, { x: 110, y: 94, color: 0xb060ff, scale: 0.9 });

  // ---------------- 星燼魔像：石與黃銅鑄成的巨軀，接縫透出星燼 ----------------
  canvasArt(scene, 'enemy_star_golem', 230, 260, (c) => {
    const E = 0xffa040;
    const rim = '#ffd09a';
    const stone = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#4a4450'], [0.5, '#2a2630'], [1, '#0e0c12']]);
    const brass = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#9a7444'], [1, '#2a1c0c']]);
    glow(c, 115, 130, 120, E, 0.16);
    // 腿
    lit(c, sh([[64, 180], [104, 180], [100, 252], [56, 252]]), stone(180, 252), rim, 3, 2);
    lit(c, sh([[126, 180], [166, 180], [174, 252], [130, 252]]), stone(180, 252), rim, 3, 2);
    lit(c, sh([[50, 244], [106, 244], [108, 258], [46, 258]]), brass(244, 258), '#ffe0b0', 1.5, 1.5);
    lit(c, sh([[124, 244], [180, 244], [184, 258], [122, 258]]), brass(244, 258), '#ffe0b0', 1.5, 1.5);
    // 軀幹（巨大胸塊）
    lit(c, sh([[50, 74], [180, 74], [198, 120], [176, 190], [54, 190], [32, 120]]), stone(74, 190), rim, 3.5, 3);
    lit(c, sh([[48, 150], [182, 150], [180, 164], [50, 164]]), brass(150, 164), '#ffe0b0', 1.5, 1.5);
    // 胸口星核
    glow(c, 115, 116, 40, E, 0.8);
    starPath(c, 115, 116, 14, 6);
    c.fillStyle = '#fff0c8';
    c.fill();
    seam(c, [[115, 130], [104, 150], [96, 186]], E, 1.8);
    seam(c, [[115, 102], [92, 88], [62, 84]], E, 1.8);
    seam(c, [[128, 120], [160, 110], [184, 124]], E, 1.8);
    seam(c, [[80, 180], [84, 210], [76, 240]], E, 1.4);
    seam(c, [[150, 182], [146, 214], [154, 240]], E, 1.4);
    // 巨臂
    lit(c, sm([[14, 82], [52, 70], [62, 110], [50, 170], [24, 176], [8, 130]]), stone(70, 176), rim, 2.5, 2.5);
    lit(c, sm([[178, 70], [216, 82], [222, 130], [206, 176], [180, 170], [168, 110]]), stone(70, 176), rim, 2.5, 2.5);
    lit(c, sm([[4, 168], [46, 164], [52, 206], [30, 216], [2, 204]]), stone(164, 216), rim, 2, 2);
    lit(c, sm([[184, 164], [226, 168], [228, 204], [200, 216], [178, 206]]), stone(164, 216), rim, 2, 2);
    for (const x of [26, 204]) lit(c, sh([[x - 22, 158], [x + 22, 158], [x + 22, 170], [x - 22, 170]]), brass(158, 170), '#ffe0b0', 1, 1);
    seam(c, [[20, 100], [34, 130], [28, 156]], E, 1.4);
    seam(c, [[210, 100], [196, 130], [202, 156]], E, 1.4);
    // 肩上黃銅護圈
    lit(c, sm([[20, 64], [60, 50], [76, 76], [40, 96], [14, 88]]), brass(50, 96), '#ffe6b0', 2, 2);
    lit(c, sm([[154, 76], [170, 50], [210, 64], [216, 88], [190, 96]]), brass(50, 96), '#ffe6b0', 2, 2);
    // 頭（小、低、方）
    lit(c, sh([[94, 30], [136, 30], [144, 52], [138, 78], [92, 78], [86, 52]]), stone(30, 78), rim, 2.5, 2);
    c.fillStyle = '#06050a';
    c.fillRect(96, 48, 38, 10);
    glowEye(c, 106, 53, 5, E, 0);
    glowEye(c, 124, 53, 5, E, 0);
    // 頭頂的星燼裂口
    seam(c, [[104, 30], [112, 18], [120, 28], [128, 14]], E, 1.4);
    for (const [x, y, rr] of [[112, 8, 2.5], [60, 30, 2], [180, 28, 2.5], [222, 60, 2], [8, 50, 2]] as [number, number, number][]) {
      sparkle(c, x, y, rr * 1.6, E, 0.9);
    }
  }, { x: 115, y: 116, color: 0xffa040, scale: 0.9 });

  // ---------------- 大司星 瓦爾德蘭（頭目）：浮空的長袍大法師，符文環繞身 ----------------
  canvasArt(scene, 'enemy_boss_valderan', 300, 320, (c) => {
    const Vi = 0xa070ff;
    const G = 0xffd890;
    const rim = '#e0ccff';
    const robe = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#3a2a66'], [0.45, '#1c1438'], [1, '#07050e']]);
    glow(c, 150, 150, 150, Vi, 0.2);
    glow(c, 150, 306, 70, Vi, 0.4);
    // 符文環後半
    runeRing(c, 150, 170, 132, 34, -0.18, G, Math.PI, Math.PI * 2);
    runeRing(c, 150, 112, 96, 22, 0.22, Vi, Math.PI, Math.PI * 2);
    // 披風（向兩側展開）
    lit(c, sm([[100, 92], [40, 120], [12, 200], [26, 280], [60, 262], [80, 296], [110, 200]]), robe(92, 296), rim, 3, 2);
    lit(c, sm([[200, 92], [260, 120], [288, 200], [274, 280], [240, 262], [220, 296], [190, 200]]), robe(92, 296), rim, -3, 2);
    // 長袍本體（下擺收細、破碎，不著地）
    lit(c, sm([[108, 96], [192, 96], [204, 170], [214, 250], [196, 290], [176, 272], [160, 304], [146, 276], [126, 300], [114, 268], [92, 286], [88, 240], [96, 170]]),
      robe(96, 300), rim, 3, 2.5);
    // 金色前襟紋
    strokeLine(c, [[150, 116], [146, 200], [152, 280]], rgba(G, 0.8), 2);
    for (const [x, y] of [[148, 140], [146, 176], [148, 214], [150, 250]] as P[]) {
      starPath(c, x, y, 4, 1.6);
      c.fillStyle = rgba(G, 0.9);
      c.fill();
    }
    strokeLine(c, [[110, 104], [100, 176], [96, 250]], rgba(G, 0.45), 1.2);
    strokeLine(c, [[190, 104], [200, 176], [206, 250]], rgba(G, 0.45), 1.2);
    // 雙臂展開＋長袖
    lit(c, sm([[112, 104], [70, 120], [40, 150], [30, 182], [52, 176], [80, 150], [118, 134]]), robe(104, 182), rim, 2, 2);
    lit(c, sm([[188, 104], [230, 120], [260, 150], [270, 182], [248, 176], [220, 150], [182, 134]]), robe(104, 182), rim, -2, 2);
    lit(c, sm([[28, 176], [40, 170], [46, 186], [34, 192]]), faceGrad(c), rim, 1, 1);
    lit(c, sm([[272, 176], [260, 170], [254, 186], [266, 192]]), faceGrad(c), rim, -1, 1);
    // 掌中星燼與蝕光
    glow(c, 30, 198, 30, G, 0.8);
    sparkle(c, 30, 198, 7, G);
    glow(c, 270, 198, 30, Vi, 0.9);
    sparkle(c, 270, 198, 7, Vi);
    // 銀白長髮
    lit(c, sm([[128, 50], [122, 100], [112, 150], [150, 140], [188, 150], [178, 100], [172, 50], [150, 30]]),
      vgrad(c, 30, 150, [[0, '#dcdcf0'], [0.6, '#7a78a0'], [1, '#2a2848']]), '#ffffff', 1.5, 2);
    // 高立領
    for (const f of [1, -1]) {
      const X = (x: number): number => (f === 1 ? x : 300 - x);
      lit(c, sm([[X(132), 104], [X(104), 92], [X(92), 46], [X(102), 30], [X(118), 66], [X(138), 88]]),
        vgrad(c, 30, 104, [[0, '#4e3c86'], [1, '#160f2a']]), rim, f * 2, 2);
      strokeLine(c, [[X(102), 32], [X(94), 48], [X(104), 92], [X(132), 104]], rgba(G, 0.9), 1.5);
    }
    // 臉（冷峻、蒼白陰影）
    lit(c, sm([[134, 54], [138, 38], [150, 32], [162, 38], [166, 54], [162, 74], [150, 86], [138, 74]]),
      vgrad(c, 32, 86, [[0, '#3a3858'], [1, '#191a2e']]), rim, 1.5, 1.5);
    c.save();
    sm([[134, 60], [166, 60], [162, 74], [150, 86], [138, 74]])(c);
    c.clip();
    c.fillStyle = 'rgba(6,4,14,0.35)';
    c.fillRect(130, 58, 40, 32);
    c.restore();
    glowEye(c, 143, 56, 3.4, Vi, 0.12);
    glowEye(c, 157, 56, 3.4, Vi, -0.12);
    strokeLine(c, [[144, 74], [156, 74]], 'rgba(0,0,0,0.5)', 1.2);
    // 星冠頭環
    strokeLine(c, [[132, 42], [150, 36], [168, 42]], rgba(G, 0.95), 2);
    glow(c, 150, 28, 22, G, 0.6);
    starPath(c, 150, 26, 9, 3.6);
    c.fillStyle = '#fff4d0';
    c.fill();
    for (const [x, y] of [[136, 34], [164, 34]] as P[]) {
      starPath(c, x, y, 4.5, 1.8);
      c.fillStyle = rgba(G, 0.95);
      c.fill();
    }
    // 胸前紫核墜飾
    glow(c, 150, 112, 18, Vi, 0.8);
    c.fillStyle = '#efe0ff';
    c.beginPath(); c.moveTo(150, 104); c.lineTo(156, 112); c.lineTo(150, 122); c.lineTo(144, 112); c.closePath(); c.fill();
    // 符文環前半
    runeRing(c, 150, 170, 132, 34, -0.18, G, 0, Math.PI);
    runeRing(c, 150, 112, 96, 22, 0.22, Vi, 0, Math.PI);
    for (const [x, y, rr, col] of [[24, 60, 2.5, G], [276, 52, 2.5, Vi], [60, 300, 2, Vi], [244, 300, 2, G], [150, 4, 2, G]] as [number, number, number, number][]) {
      sparkle(c, x, y, rr * 1.6, col, 0.9);
    }
  }, { x: 150, y: 112, color: 0xa070ff, scale: 1.1 });
}

function generateCh4Portraits(scene: Phaser.Scene): void {
  // 緹雅：九歲的小女孩，一條長辮垂在肩前、素色連身裙；溫柔的暖光。
  canvasArt(scene, 'npc_tia', NW, NH, (c) => {
    const rim = '#ffe0c0';
    const W0 = 0xffc890;
    npcHalo(c, 85, 120, W0, 0.28);
    // 身體（窄肩、小）＋連身裙
    lit(c, sm([[34, 260], [40, 186], [56, 164], [74, 156], [85, 160], [96, 156], [114, 164], [130, 186], [136, 260]]),
      vgrad(c, 156, 240, [[0, '#4a5a7a'], [1, '#121626']]), rim, 2, 2);
    // 白色小圓領
    lit(c, sm([[70, 158], [85, 168], [100, 158], [104, 168], [85, 178], [66, 168]]), vgrad(c, 158, 178, [[0, '#d8d4e0'], [1, '#8a8698']]), '#ffffff', 1, 1);
    strokeLine(c, [[85, 178], [85, 240]], 'rgba(0,0,0,0.25)', 1.5);
    for (const y of [190, 206, 222]) {
      c.fillStyle = 'rgba(255,230,200,0.6)';
      c.beginPath(); c.arc(85, y, 1.6, 0, Math.PI * 2); c.fill();
    }
    // 頸
    lit(c, sh([[80, 140], [90, 140], [91, 160], [79, 160]]), faceGrad(c), rim, 1, 1);
    // 臉（圓、小）
    const F: P[] = [[64, 112], [67, 94], [85, 84], [103, 94], [106, 112], [102, 132], [92, 144], [85, 146], [78, 144], [68, 132]];
    lit(c, sm(F), vgrad(c, 84, 146, [[0, '#3a3650'], [1, '#1c1a2c']]), rim, 1.5, 1.5);
    // 頭髮＋瀏海
    lit(c, sh([[60, 118], [58, 92], [68, 76], [85, 70], [102, 76], [112, 92], [110, 118], [106, 102], [98, 94], [92, 100], [84, 92], [76, 100], [68, 96], [64, 106]]),
      vgrad(c, 70, 118, [[0, '#6a4a3a'], [1, '#2a1a14']]), rim, 1.5, 1.5);
    // 長辮（從右耳後垂到胸前）
    for (let k = 0; k < 6; k++) {
      const y = 120 + k * 14;
      const x = 108 + Math.sin(k * 0.6) * 3 - k * 1.5;
      lit(c, sm([[x - 7, y], [x, y - 3], [x + 7, y], [x + 5, y + 10], [x, y + 13], [x - 5, y + 10]]),
        vgrad(c, y - 3, y + 13, [[0, '#6a4a3a'], [1, '#2a1a14']]), rim, 1, 1);
    }
    lit(c, sm([[94, 206], [104, 204], [106, 214], [96, 216]]), '#b04a4a', '#ffc0b0', 0.8, 0.8);
    strokeLine(c, [[98, 214], [96, 228]], 'rgba(106,74,58,0.9)', 2);
    strokeLine(c, [[102, 214], [104, 228]], 'rgba(106,74,58,0.9)', 2);
    // 小髮飾
    sparkle(c, 66, 88, 3, 0x9fe0ff);
    // 溫柔的眼睛（彎彎的）
    for (const x of [77, 93]) {
      glow(c, x, 114, 7, 0xa0d8ff, 0.4);
      strokeLine(c, [[x - 4, 114], [x, 111.5], [x + 4, 114]], '#e0f0ff', 1.6);
    }
    c.fillStyle = 'rgba(255,150,150,0.25)';
    for (const x of [72, 98]) { c.beginPath(); c.arc(x, 124, 4, 0, Math.PI * 2); c.fill(); }
    strokeLine(c, [[82, 132], [85, 133.5], [88, 132]], 'rgba(255,200,190,0.55)', 1.2);
    // 小手交握在胸前
    lit(c, sm([[70, 214], [84, 208], [98, 214], [92, 226], [76, 226]]), faceGrad(c), rim, 1, 1);
    for (const [x, y] of [[28, 70], [146, 60], [142, 150], [22, 160]] as P[]) sparkle(c, x, y, 2.4, W0, 0.8);
  });
}

/** 第四章說話者 id → 立繪材質 key。 */
export const CH4_PORTRAITS: Record<string, string> = { tia: 'npc_tia', contact: 'npc_researcher' };

// ======================================================================
// 終章「燈火」：墜星裂谷
// ======================================================================
function generateCh5Combatants(scene: Phaser.Scene): void {
  // ---------------- 刪除之眼：裂縫中睜開的巨眼，虹膜是一圈被抹去的星座 ----------------
  canvasArt(scene, 'enemy_boss_starfall_eye', 260, 220, (c) => {
    const V = 0xa060ff;
    const cx = 130;
    const cy = 104;
    glow(c, cx, cy, 130, 0x5a20b0, 0.35);
    // 裂縫（眼瞼）：上下兩道鋸齒黑殼
    c.save();
    c.fillStyle = '#07040f';
    c.beginPath();
    c.moveTo(4, cy);
    for (let i = 0; i <= 12; i++) c.lineTo(4 + i * 21, cy - 58 * Math.sin((i / 12) * Math.PI) - (i % 2 ? 10 : 0));
    for (let i = 12; i >= 0; i--) c.lineTo(4 + i * 21, cy + 52 * Math.sin((i / 12) * Math.PI) + (i % 2 ? 9 : 0));
    c.closePath();
    c.fill();
    c.restore();
    // 眼白（病態的淡紫）
    c.save();
    c.beginPath();
    c.ellipse(cx, cy, 104, 44, 0, 0, Math.PI * 2);
    c.clip();
    const sclera = c.createRadialGradient(cx, cy, 10, cx, cy, 110);
    sclera.addColorStop(0, '#f4e8ff');
    sclera.addColorStop(0.7, '#b89ad8');
    sclera.addColorStop(1, '#3a1c60');
    c.fillStyle = sclera;
    c.fillRect(0, 0, 260, 220);
    // 血絲般的紫色裂紋
    c.strokeStyle = rgba(V, 0.6);
    c.lineWidth = 1.4;
    const r = rng5(11);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 108, cy + Math.sin(a) * 46);
      c.quadraticCurveTo(cx + Math.cos(a + 0.3) * 70, cy + Math.sin(a + 0.3) * 30, cx + Math.cos(a) * 44, cy + Math.sin(a) * 20);
      c.stroke();
    }
    // 虹膜：黑紫漸層 + 一圈星點
    const iris = c.createRadialGradient(cx, cy, 6, cx, cy, 40);
    iris.addColorStop(0, '#000000');
    iris.addColorStop(0.45, '#1a0630');
    iris.addColorStop(0.8, '#6a2ab8');
    iris.addColorStop(1, '#2a0a4a');
    c.fillStyle = iris;
    c.beginPath(); c.arc(cx, cy, 40, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sparkle(c, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 2.2, i % 3 ? 0xd9b8ff : 0xffe2a8, 0.9);
    }
    // 瞳孔：豎直細縫
    c.fillStyle = '#000';
    c.beginPath(); c.ellipse(cx, cy, 6, 30, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    // 高光
    glow(c, cx - 14, cy - 14, 12, 0xffffff, 0.6);
    // 下方滴落的黑色殘響
    c.save();
    c.strokeStyle = '#0c0618';
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 50 + i * 32;
      c.lineWidth = 6 - (i % 3);
      c.beginPath(); c.moveTo(x, cy + 40); c.lineTo(x + (i % 2 ? 6 : -6), cy + 70 + (i % 3) * 22); c.stroke();
      sparkle(c, x + (i % 2 ? 6 : -6), cy + 70 + (i % 3) * 22, 2.5, V, 0.8);
    }
    c.restore();
  }, { x: 130, y: 104, color: 0xb46bff, scale: 1.1 });


  // ---------------- 裂谷墜影：墜星碎片拼成的影獸，裂隙透出紫焰與餘燼 ----------------
  canvasArt(scene, 'enemy_rift_spawn', 200, 200, (c) => {
    const V = 0xa060ff;
    const E = 0xff8a40;
    const rim = '#e0c4ff';
    const shard = (y0: number, y1: number): CanvasGradient => vgrad(c, y0, y1, [[0, '#2c1e48'], [0.55, '#120c22'], [1, '#05030a']]);
    glow(c, 100, 104, 96, 0x6a2cc0, 0.25);
    glow(c, 100, 190, 60, E, 0.25);
    // 漂浮的碎片尾（下半身不著地）
    for (const [x, y, w, h, t] of [[60, 160, 14, 30, -0.4], [88, 176, 12, 22, -0.1], [116, 178, 12, 24, 0.15], [142, 162, 14, 28, 0.45], [100, 194, 8, 10, 0]] as [number, number, number, number, number][]) {
      c.save(); c.translate(x, y); c.rotate(t);
      lit(c, sh([[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]]), shard(-h / 2, h / 2), rim, 1.2, 1.2);
      c.restore();
      glow(c, x, y + 6, 10, E, 0.3);
    }
    // 主軀：嶙峋碎晶聚合
    lit(c, sh([[50, 150], [34, 116], [40, 80], [64, 58], [100, 46], [138, 56], [164, 82], [168, 118], [150, 152], [100, 166]]), shard(46, 166), rim, 2.5, 2);
    // 背脊上翹起的星石尖刺
    for (const [x, y, h, t] of [[56, 70, 40, -0.7], [78, 54, 52, -0.35], [104, 46, 60, 0.02], [130, 52, 50, 0.38], [154, 70, 42, 0.72], [36, 100, 30, -1.1], [168, 102, 30, 1.1]] as [number, number, number, number][]) {
      c.save(); c.translate(x, y); c.rotate(t);
      lit(c, sh([[-9, 6], [-3, -h * 0.6], [0, -h], [5, -h * 0.55], [9, 6]]), shard(-h, 6), rim, 1.5, 1.5);
      c.restore();
      const tx = x + Math.sin(t) * h;
      const ty = y - Math.cos(t) * h;
      sparkle(c, tx, ty, 2.6, V, 0.9);
    }
    // 前爪（碎片鉤）
    lit(c, sh([[48, 130], [22, 150], [10, 178], [26, 170], [36, 182], [44, 160], [62, 146]]), shard(130, 182), rim, 1.5, 1.5);
    lit(c, sh([[152, 130], [178, 150], [190, 178], [174, 170], [164, 182], [156, 160], [138, 146]]), shard(130, 182), rim, -1.5, 1.5);
    // 裂隙：紫焰與餘燼
    seam(c, [[100, 60], [92, 84], [104, 104], [96, 132], [102, 158]], V, 1.6);
    seam(c, [[64, 80], [78, 100], [66, 124]], E, 1.2);
    seam(c, [[140, 78], [126, 102], [140, 128]], E, 1.2);
    seam(c, [[44, 112], [60, 118]], V, 1);
    seam(c, [[156, 112], [140, 118]], V, 1);
    // 胸口墜星核
    glow(c, 100, 112, 34, V, 0.8);
    starPath(c, 100, 112, 10, 4);
    c.fillStyle = '#f4e4ff';
    c.fill();
    // 頭部（尖顎）＋三眼
    lit(c, sh([[72, 84], [86, 66], [100, 62], [114, 66], [128, 84], [116, 98], [100, 104], [84, 98]]), shard(62, 104), rim, 1.5, 1.5);
    glowEye(c, 88, 82, 4.4, E, 0.3);
    glowEye(c, 112, 82, 4.4, E, -0.3);
    glowEye(c, 100, 72, 3, V, 0);
    // 周身飄散的星屑
    for (const [x, y, rr, col] of [[18, 40, 2.4, V], [182, 34, 2.4, E], [12, 120, 1.8, E], [190, 130, 1.8, V], [100, 12, 2, V], [150, 10, 1.6, E]] as [number, number, number, number][]) {
      sparkle(c, x, y, rr * 1.6, col, 0.9);
    }
  }, { x: 100, y: 112, color: 0xa060ff, scale: 0.9 });

  // ---------------- 蝕星者（終章頭目）：被蝕的星辰，燃燒日冕、龜裂外殼、獨眼 ----------------
  canvasArt(scene, 'enemy_boss_starfall', 340, 340, (c) => {
    const V = 0x9a5cff;
    const E = 0xffa050;
    const cx = 170;
    const cy = 160;
    const R = 92;
    // 外圍蝕光
    glow(c, cx, cy, 170, 0x5a20b0, 0.32);
    glow(c, cx, cy, 130, E, 0.18);
    // 觸鬚（後層，向下與兩側垂落）
    const tendril = (pts: P[], w: number): void => {
      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#0c0618';
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i]![0] + pts[i + 1]![0]) / 2;
        const my = (pts[i]![1] + pts[i + 1]![1]) / 2;
        c.quadraticCurveTo(pts[i]![0], pts[i]![1], mx, my);
      }
      const last = pts[pts.length - 1]!;
      c.lineTo(last[0], last[1]);
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(V, 0.55);
      c.lineWidth = w * 0.22;
      c.stroke();
      c.restore();
      sparkle(c, last[0], last[1], 3, V, 0.8);
    };
    const T: [P[], number][] = [
      [[[120, 230], [90, 280], [60, 300], [30, 334]], 14],
      [[[146, 244], [134, 290], [110, 316], [96, 338]], 12],
      [[[170, 250], [176, 296], [160, 320], [170, 338]], 13],
      [[[196, 244], [212, 290], [236, 314], [244, 338]], 12],
      [[[222, 228], [256, 270], [290, 292], [318, 330]], 14],
      [[[86, 200], [44, 220], [20, 260], [8, 292]], 11],
      [[[256, 196], [296, 216], [320, 254], [334, 284]], 11],
      [[[84, 120], [44, 100], [22, 70], [12, 40]], 9],
      [[[256, 118], [298, 96], [318, 66], [330, 34]], 9],
    ];
    for (const [pts, w] of T) tendril(pts, w);
    // 燃燒日冕（射線）
    c.save();
    c.globalCompositeOperation = 'lighter';
    const r0 = rng5(7);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + r0() * 0.05;
      const len = R + 20 + r0() * 52 + (i % 4 === 0 ? 30 : 0);
      const g = c.createLinearGradient(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.addColorStop(0, rgba(i % 3 === 0 ? 0xffe0a0 : E, 0.75));
      g.addColorStop(1, rgba(V, 0));
      c.strokeStyle = g;
      c.lineWidth = 2 + r0() * 4;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      c.lineTo(cx + Math.cos(a + 0.04) * len, cy + Math.sin(a + 0.04) * len);
      c.stroke();
    }
    const cor = c.createRadialGradient(cx, cy, R - 6, cx, cy, R + 34);
    cor.addColorStop(0, 'rgba(255,240,200,0.95)');
    cor.addColorStop(0.18, rgba(E, 0.85));
    cor.addColorStop(0.55, rgba(0xc04060, 0.35));
    cor.addColorStop(1, rgba(V, 0));
    c.fillStyle = cor;
    c.beginPath(); c.arc(cx, cy, R + 34, 0, Math.PI * 2); c.fill();
    c.restore();
    // 黑暗球體（蝕殼）
    const body = c.createRadialGradient(cx - 26, cy - 30, 10, cx, cy, R);
    body.addColorStop(0, '#2a1c44');
    body.addColorStop(0.6, '#110a20');
    body.addColorStop(1, '#040208');
    c.fillStyle = body;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    // 殼緣亮邊
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,220,170,0.9)';
    c.lineWidth = 2.2;
    c.beginPath(); c.arc(cx, cy, R - 1, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = rgba(V, 0.6);
    c.lineWidth = 5;
    c.beginPath(); c.arc(cx, cy, R - 5, Math.PI * 0.9, Math.PI * 1.6); c.stroke();
    c.restore();
    // 外殼浮起的碎片板
    for (const [a, d, s] of [[-2.4, R + 10, 14], [-0.7, R + 14, 12], [0.5, R + 8, 10], [2.5, R + 12, 12], [1.6, R + 16, 9]] as [number, number, number][]) {
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d;
      c.save(); c.translate(px, py); c.rotate(a + Math.PI / 2);
      lit(c, sh([[-s, 0], [-s * 0.4, -s * 0.6], [s * 0.6, -s * 0.5], [s, 0.2 * s], [0, s * 0.5]]),
        vgrad(c, -s, s, [[0, '#2a1c40'], [1, '#08050e']]), '#ffd8a8', 1, 1.5);
      c.restore();
    }
    // 龜裂（透出熔燼光）
    seam(c, [[cx - 80, cy - 40], [cx - 58, cy - 34], [cx - 50, cy - 12], [cx - 30, cy - 4]], E, 1.6);
    seam(c, [[cx + 70, cy - 56], [cx + 54, cy - 38], [cx + 58, cy - 18], [cx + 38, cy - 4]], E, 1.6);
    seam(c, [[cx - 60, cy + 66], [cx - 40, cy + 44], [cx - 22, cy + 40]], E, 1.4);
    seam(c, [[cx + 62, cy + 64], [cx + 44, cy + 46], [cx + 26, cy + 40]], E, 1.4);
    seam(c, [[cx - 10, cy - 90], [cx - 4, cy - 66], [cx - 14, cy - 50]], V, 1.4);
    seam(c, [[cx + 12, cy + 90], [cx + 4, cy + 66], [cx + 12, cy + 52]], V, 1.4);
    seam(c, [[cx - 86, cy + 20], [cx - 64, cy + 18], [cx - 56, cy + 30]], V, 1.2);
    seam(c, [[cx + 88, cy + 14], [cx + 66, cy + 18], [cx + 58, cy + 30]], V, 1.2);
    // 巨大獨眼：眼窩 → 虹膜 → 縱瞳
    c.fillStyle = '#020104';
    c.beginPath(); c.ellipse(cx, cy + 4, 58, 34, 0, 0, Math.PI * 2); c.fill();
    glow(c, cx, cy + 4, 80, V, 0.6);
    c.save();
    c.beginPath(); c.ellipse(cx, cy + 4, 54, 30, 0, 0, Math.PI * 2); c.clip();
    const iris = c.createRadialGradient(cx, cy + 4, 4, cx, cy + 4, 34);
    iris.addColorStop(0, '#fff6e0');
    iris.addColorStop(0.25, '#ffc070');
    iris.addColorStop(0.55, rgba(V, 1));
    iris.addColorStop(1, '#2a0c50');
    c.fillStyle = iris;
    c.beginPath(); c.arc(cx, cy + 4, 34, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,220,160,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 12, cy + 4 + Math.sin(a) * 12);
      c.lineTo(cx + Math.cos(a) * 32, cy + 4 + Math.sin(a) * 32);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#05020a';
    c.beginPath(); c.ellipse(cx, cy + 4, 6, 24, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.ellipse(cx - 14, cy - 8, 6, 3.6, -0.4, 0, Math.PI * 2); c.fill();
    c.restore();
    // 上下眼瞼的亮緣
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(0xffd8a0, 0.9);
    c.lineWidth = 1.8;
    c.beginPath(); c.ellipse(cx, cy + 4, 58, 34, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = rgba(V, 0.8);
    c.beginPath(); c.ellipse(cx, cy + 4, 58, 34, 0, Math.PI * 0.08, Math.PI * 0.92); c.stroke();
    c.restore();
    // 前層觸鬚（從球體下緣捲出）
    tendril([[134, 236], [118, 266], [128, 290], [110, 312]], 8);
    tendril([[206, 236], [222, 266], [212, 290], [230, 312]], 8);
    // 環繞的墜星
    for (const [x, y, rr, col] of [[40, 150, 3, E], [300, 150, 3, E], [170, 16, 3.4, 0xffe0a0], [70, 40, 2.4, V], [270, 40, 2.4, V], [24, 214, 2, V], [316, 214, 2, V]] as [number, number, number, number][]) {
      sparkle(c, x, y, rr * 1.6, col, 0.95);
    }
  }, { x: 170, y: 164, color: 0x9a5cff, scale: 1.25 });
}

function rng5(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
