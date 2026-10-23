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
}

/** 對話立繪用（剪影，正面半身）。 */
export function generatePortraitArt(scene: Phaser.Scene): void {
  make(scene, 'hero_serin', 150, 230, (g, s) => {
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
}

export const heroArtKey = (id: string): string => `hero_${id}`;
export const enemyArtKey = (id: string): string => `enemy_${id}`;
