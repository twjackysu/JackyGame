// 程式生成的角色／敵人剪影材質（05：剪影 + 邊緣光）。
// 做法：先用邊緣光色描邊整個輪廓，再把深色本體往右下偏移填上，只留下左上側的亮邊 → 便宜的 rim light。
import Phaser from 'phaser';
import { HAND_ART } from '../../data/handArt';
import { AH, AW, drawIo, drawLian } from './animePortraits';
import { drawAnnouncer, drawBern, drawDealer, drawDorn, drawGateCaptain, drawResearcher, drawVendor, drawFarrow, drawGwen, drawHanna, drawLiora, drawMara, drawMiner, drawToby, drawRourke, drawSerin, drawTia, drawValderan } from './animeCompanions';
import { backIo, backLian, backLiora, backRourke, backSerin } from './animeSprites';

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

/** 以 Canvas 2D 畫的我方背影（2 倍解析度，邏輯尺寸 w×h，規格與 make() 相同）。 */
function heroCanvas(
  scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, glow?: ArtInfo['glow'],
): void {
  // 手繪 Q 版圖（public/art）：燈的位置不同，不疊程式的發光點；尺寸以手繪圖為準（BattleScene 顯示 0.5 倍）
  const hand = HAND_ART.includes(key) && scene.textures.exists(key);
  const src = hand ? scene.textures.get(key).getSourceImage() : null;
  ART[key] = hand && src ? { key, w: src.width / 2, h: src.height / 2, footY: src.height / 4 - 6 } : { key, w, h, footY: h / 2 - 6, glow };
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w * 2, h * 2);
  if (!tex) return;
  const c = tex.getContext();
  c.save();
  c.scale(2, 2);
  draw(c);
  c.restore();
  tex.refresh();
}

function make(
  scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics, s: number) => void,
  glow?: ArtInfo['glow'],
): void {
  const s = 2; // 以 2 倍解析度繪製，顯示時縮 0.5 → 邊緣較銳利
  // 手繪圖（docs/ART_REQUESTS.md → public/art）：尺寸取自圖片，不疊程式發光點
  const hand = HAND_ART.includes(key) && scene.textures.exists(key);
  const src = hand ? scene.textures.get(key).getSourceImage() : null;
  ART[key] = hand && src ? { key, w: src.width / 2, h: src.height / 2, footY: src.height / 4 - 6 } : { key, w, h, footY: h / 2 - 6, glow };
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
  // ---------------- 我方（背影，動漫風：animeSprites.ts） ----------------
  heroCanvas(scene, 'hero_lian', 130, 200, backLian, { x: 112, y: 61, color: 0xffa54a, scale: 0.9 });
  heroCanvas(scene, 'hero_rourke', 160, 220, backRourke);
  heroCanvas(scene, 'hero_io', 110, 180, backIo, { x: 90, y: 100, color: 0x7fd8ff, scale: 0.5 });
  heroCanvas(scene, 'hero_liora', 120, 190, backLiora, { x: 17, y: 104, color: 0xff8a3d, scale: 0.6 });
  heroCanvas(scene, 'hero_serin', 150, 230, backSerin);

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

  // ---------------- 城鎮居民（通用立繪） ----------------




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
export const HD_PORTRAITS: ReadonlySet<string> = new Set(['portrait_lian', 'portrait_io', 'portrait_serin', 'portrait_liora', 'portrait_rourke', 'npc_valderan', 'npc_gwen', 'npc_bern', 'npc_tia', 'npc_dorn', 'npc_farrow', 'npc_mara', 'npc_hanna', 'npc_toby', 'npc_miner',
  'npc_announcer', 'npc_dealer', 'npc_researcher', 'npc_vendor', 'npc_gate_captain']);

const LAZY_PORTRAITS: Record<string, (c: Ctx) => void> = {};

/** 登記高解析立繪；實際繪製延後到第一次用到（ensurePortrait），避免場景建立時一次畫二十張卡頓。 */
function hdPortrait(_scene: Phaser.Scene, key: string, draw: (c: Ctx) => void): void {
  ART[key] = { key, w: AW, h: AH, footY: AH / 2 };
  LAZY_PORTRAITS[key] = draw;
}

/** 確保立繪材質存在（手繪圖已由 Boot 載入時直接沿用）。回傳材質是否可用。 */
export function ensurePortrait(scene: Phaser.Scene, key: string): boolean {
  if (scene.textures.exists(key)) return true;
  const draw = LAZY_PORTRAITS[key];
  if (!draw) return false;
  const tex = scene.textures.createCanvas(key, AW, AH);
  if (!tex) return false;
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
  return true;
}

function generateHeroPortraits(scene: Phaser.Scene): void {
  // 男女主角：動漫風高解析立繪（animePortraits.ts，600×900）
  hdPortrait(scene, 'portrait_lian', drawLian);
  hdPortrait(scene, 'portrait_io', drawIo);
  hdPortrait(scene, 'portrait_serin', drawSerin);
  hdPortrait(scene, 'portrait_liora', drawLiora);
  hdPortrait(scene, 'portrait_rourke', drawRourke);
  hdPortrait(scene, 'npc_gwen', drawGwen);
  hdPortrait(scene, 'npc_bern', drawBern);
  hdPortrait(scene, 'npc_dorn', drawDorn);
  hdPortrait(scene, 'npc_farrow', drawFarrow);
  hdPortrait(scene, 'npc_mara', drawMara);
  hdPortrait(scene, 'npc_hanna', drawHanna);
  hdPortrait(scene, 'npc_toby', drawToby);
  hdPortrait(scene, 'npc_miner', drawMiner);

}

// ======================================================================
// 第三章「星冠」：王都的敵人與居民（Canvas 2D，2 倍解析度，與 make() 同尺寸規格）
// ======================================================================

/** 以 Canvas 繪製、2 倍解析度的材質（邏輯尺寸 w×h，與 make() 的 ART 規格一致）。 */
function canvasArt(
  scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, glowInfo?: ArtInfo['glow'],
): void {
  const hand = HAND_ART.includes(key) && scene.textures.exists(key);
  const src = hand ? scene.textures.get(key).getSourceImage() : null;
  ART[key] = hand && src ? { key, w: src.width / 2, h: src.height / 2, footY: src.height / 4 - 6 } : { key, w, h, footY: h / 2 - 6, glow: glowInfo };
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

const faceGrad = (c: Ctx): CanvasGradient => vgrad(c, 38, 104, [[0, '#30324e'], [1, '#171a2c']]);

function generateCh3Portraits(scene: Phaser.Scene): void {
  // 大司星 瓦爾德蘭：動漫風高解析立繪（animeCompanions.ts）
  hdPortrait(scene, 'npc_valderan', drawValderan);
  hdPortrait(scene, 'npc_announcer', drawAnnouncer);
  hdPortrait(scene, 'npc_dealer', drawDealer);
  hdPortrait(scene, 'npc_researcher', drawResearcher);
  hdPortrait(scene, 'npc_vendor', drawVendor);
  hdPortrait(scene, 'npc_gate_captain', drawGateCaptain);
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
  // 緹雅：動漫風高解析立繪（animeCompanions.ts）
  hdPortrait(scene, 'npc_tia', drawTia);
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
