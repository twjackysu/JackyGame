// 畫面外的箭頭（第 151 輪 Q5 拆場景，從 RtBattleScene.drawOffscreen 原封不動搬出來，純畫面）：
// - 精英／Boss（大箭頭＋距離字）、追過來的怪（小箭頭）；躲開技能鍵、小地圖、懸賞板、目標字條、地區名
// - 往下一張圖的光門（剛亮起 25 秒內或 40 公尺內：青色箭頭＋「光門 Nm」）
// - 畫面外地上的精良以上裝備（閃爍菱形）
// 距離字（labels、gateArrow）由這裡建立與重用；場景的 menuBanners 用 labels／gateArrow 判斷是不是 HUD 字。
import type Phaser from 'phaser';
import { ENEMIES } from '../../core/battle/rt/data';
import { enemiesOf, playerOf } from '../../core/battle/rt/engine';
import { RARITY_COLOR } from '../../core/battle/rt/gear';
import { UNIT, type BattleState } from '../../core/battle/rt/types';
import { belowBlessHud, showOffscreenArrow } from '../arrowRules';
import { GAME_WIDTH, TALL } from '../config';
import { UI_FONT } from '../fx/feel';

type Bounds = Phaser.Geom.Rectangle;

/** 場景提供的東西（每幀讀；鏡頭、按鈕位置都會變） */
export interface OffscreenHost {
  readonly scene: Phaser.Scene;
  /** 可視範圍上緣 */
  readonly viewTop: number;
  s(): BattleState;
  now(): number;
  k(): number;
  sx(x: number): number;
  sy(y: number): number;
  /** 上緣中間的「目標：…」字條（沒有就看 Boss 名字條）的範圍 */
  goalBounds(): Bounds | null;
  /** 懸賞板的範圍 */
  bountyBounds(): Bounds | null;
  mini(): { x: number; y: number; w: number; h: number } | null;
  btnPos(i: number): { x: number; y: number };
  btnR(i: number): number;
  zoneTexts(): readonly Phaser.GameObjects.Text[];
  clearOfHudPanels(x: number, y: number, ax: number, w?: number): number;
  gates(): readonly { x: number; y: number; back: boolean; revealAt?: number }[];
  menuOpen(): boolean;
  /** 右上角祝福火苗＋圖示那一組的範圍（沒有就 null） */
  blessHud(): { left: number; top: number; right: number; bottom: number } | null;
}

export class OffscreenArrows {
  /** 精英／Boss 箭頭旁的距離字（重用） */
  labels: Phaser.GameObjects.Text[] = [];
  /** 「光門 Nm」 */
  gateArrow: Phaser.GameObjects.Text | null = null;

  constructor(private readonly h: OffscreenHost) {}

  /** 重開一場（場景 create）：舊的字跟著場景清掉了，這裡只放手 */
  reset(): void {
    this.labels = [];
    this.gateArrow = null;
  }

  /** 畫面外的敵人：邊緣箭頭（正在預告攻擊的閃紅）；光門；地上的好裝備 */
  draw(g: Phaser.GameObjects.Graphics): void {
    const s = this.h.s();
    const now = this.h.now();
    const p = playerOf(s);
    let li = 0;
    const placed: { x: number; y: number; ax: number; ay: number }[] = [];
    const gb = this.h.goalBounds();
    for (const e of enemiesOf(s)) {
      const px = this.h.sx(e.x);
      const py = this.h.sy(e.y);
      const M = 30;
      if (px >= 0 && px <= GAME_WIDTH && py >= this.h.viewTop + 40 && py <= 960 + TALL) continue;
      const boss = !!ENEMIES[e.defId]?.boss;
      const elite = e.tier === 'elite' || boss;
      // 有小地圖的大地圖：待機的一般怪只在小地圖上，箭頭只留給追過來的怪、附近的精英與 Boss（design/20 B6、D-176）
      if (!showOffscreenArrow({ mini: !!this.h.mini(), elite, boss, combat: e.mode === 'combat', distM: Math.hypot(e.x - p.x, e.y - p.y) / UNIT })) continue;
      let cx = Math.max(M, Math.min(GAME_WIDTH - M, px));
      // 技能鍵／藥水鍵（照操作設定的位置，左手模式也算）：箭頭與距離字不要壓在按鈕上，挪到按鈕上方（第 46 輪）
      let yMax = 960 + TALL;
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i <= 6; i++) {
          const b = this.h.btnPos(i);
          const r = this.h.btnR(i) + 34;
          if (Math.abs(cx - b.x) < r && yMax > b.y - r) yMax = b.y - r;
        }
      let cy = Math.max(this.h.viewTop + M, Math.min(yMax, py));
      // 落在左上小地圖上的箭頭挪到小地圖右邊（第 41 輪：以前箭頭和距離字壓在小地圖上）
      const mm = this.h.mini();
      if (mm && cx < mm.x + mm.w + M && cy < mm.y + mm.h + M) cx = mm.x + mm.w + M;
      // 小地圖下面的懸賞板也一樣（第 49 輪：左邊的箭頭距離字「17m」壓在「野狼 0/12」上）
      const bb = this.h.bountyBounds();
      if (bb && cx < bb.right + M && cy > bb.top - M && cy < bb.bottom + M) cx = bb.right + M;
      // 上緣中間的「目標：…」字條（第 44 輪：以前大箭頭蓋在字條上，「打倒霧角狼王」看不清楚）→ 箭頭挪到字條下面
      let top = this.h.viewTop + M;
      const gy = gb ? gb.bottom + (elite ? 36 : 22) : 0; // 大箭頭尖端離中心約 31px
      if (gb && cx > gb.left - M && cx < gb.right + M && cy < gy) cy = top = gy;
      // 第 57 輪：剛走進一區的地區名稱（「— 熔渣坡 —」，y 約 235～290）被上緣的 Boss 大箭頭與距離字壓住 → 箭頭挪到字的旁邊
      for (const z of this.h.zoneTexts()) {
        if (!z.active || z.alpha < 0.05) continue;
        const zb = z.getBounds();
        if (cx > zb.left - M && cx < zb.right + M && cy > zb.top - M - 30 && cy < zb.bottom + M + 30) {
          const cx0 = cx;
          cx = cx < zb.centerX ? Math.max(M, zb.left - M) : Math.min(GAME_WIDTH - M, zb.right + M);
          // 第 84 輪：往左讓開又躲回小地圖／懸賞板底下（360×640 深夜裂谷「岔路：…」字從畫面左邊開始）→ 箭頭被板子蓋住、只剩距離字 → 改成留在原處、讓到字的下面
          const underMini = mm && cx < mm.x + mm.w + M && cy < mm.y + mm.h + M;
          const underBounty = bb && cx < bb.right + M && cy > bb.top - M && cy < bb.bottom + M;
          if (underMini || underBounty) {
            cx = cx0;
            cy = Math.min(yMax, zb.bottom + M + 31);
          }
        }
      }
      // 右上角的祝福火苗與圖示（第 171 輪）：箭頭挪到那一組下面
      const bh = this.h.blessHud();
      const cyB = Math.min(yMax, belowBlessHud(cx, cy, bh, elite ? 34 : 22));
      if (cyB !== cy) { cy = cyB; top = Math.max(top, cy); }
      // 同方向好幾隻精英／Boss：大箭頭沿著邊緣錯開，不疊成一團
      if (elite) {
        const onTop = cy <= top + 1;
        // 第 49 輪：40／44 → 56／60（大箭頭含光圈直徑約 52，被小地圖推過來的兩個箭頭以前幾乎貼在一起）
        for (let k = 0; k < 4 && placed.some((q) => Math.abs(q.ax - cx) < 56 && Math.abs(q.ay - cy) < 56); k++) {
          if (onTop) {
            cx = Math.min(GAME_WIDTH - M, cx + 60);
            // 第 61 輪：錯開後滑進「目標：…」字條底下（第二個箭頭和距離字蓋在字條上）→ 一樣挪到字條下面
            if (gb && cx > gb.left - M && cx < gb.right + M && cy < gy) cy = gy;
          } else cy = Math.min(yMax, cy + 60);
        }
      }
      const an = Math.atan2(py - cy || 0.001, px - cx || 0.001);
      const hot = s.telegraphs.some((t) => t.ownerId === e.id);
      const col = hot ? (Math.floor(now / 100) % 2 ? 0xff3a3a : 0xffffff) : ENEMIES[e.defId]?.boss ? 0xffb0d0 : 0xffd27a;
      const c = Math.cos(an);
      const sn = Math.sin(an);
      // 精英／Boss：大一號的橘金箭頭＋脈動光圈（值得特地去打）
      const big = elite;
      const z = big ? 1.7 : 1;
      if (big && !hot) g.fillStyle(0xff9a3a, 0.25 + 0.15 * Math.sin(now / 180)).fillCircle(cx, cy, 26);
      g.fillStyle(big && !hot ? 0xffa040 : col, 0.9).fillTriangle(cx + c * 18 * z, cy + sn * 18 * z, cx - c * 10 * z - sn * 12 * z, cy - sn * 10 * z + c * 12 * z, cx - c * 10 * z + sn * 12 * z, cy - sn * 10 * z - c * 12 * z);
      if (big && this.h.mini()) {
        // 距離（1 格＝1 公尺），字放在箭頭內側
        let tx = this.labels[li];
        if (!tx) {
          tx = this.h.scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(51);
          this.labels.push(tx);
        }
        li++;
        // 兩個箭頭靠太近時距離字往下錯開，不疊成「50m10m」
        let lx = cx - c * 40;
        let ly = cy - sn * 40;
        // 第 84 輪：箭頭被推到小地圖／懸賞板右邊後，距離字放在「箭頭內側」＝又回到板子上（360×640「44m」壓小地圖、「21m」壓「懸賞」）→ 改放箭頭外側
        lx = Math.max(26, Math.min(GAME_WIDTH - 26, this.h.clearOfHudPanels(lx, ly, cx)));
        for (let k = 0; k < 4 && placed.some((q) => Math.abs(q.x - lx) < 46 && Math.abs(q.y - ly) < 22); k++) ly += 24;
        placed.push({ x: lx, y: ly, ax: cx, ay: cy });
        tx.setVisible(true).setText(`${Math.round(Math.hypot(e.x - p.x, e.y - p.y) / UNIT)}m`).setPosition(lx, ly);
      }
    }
    for (let i = li; i < this.labels.length; i++) this.labels[i]!.setVisible(false);
    // 往下一張的光門在畫面外（第 55 輪）：剛亮起的 25 秒內、或 40 公尺內，邊緣一個青色箭頭＋「光門 Nm」
    let gateShown = false;
    const bossFight = enemiesOf(s).some((e) => e.mode === 'combat' && !!ENEMIES[e.defId]?.boss);
    for (const gt of this.h.gates()) {
      if (bossFight) break;
      if (gt.back || this.h.menuOpen()) continue;
      const px = this.h.sx(gt.x);
      const py = this.h.sy(gt.y) - 60 * this.h.k();
      if (px >= 0 && px <= GAME_WIDTH && py >= this.h.viewTop + 40 && py <= 960 + TALL) continue;
      const dm = Math.hypot(gt.x - p.x, gt.y - p.y) / UNIT;
      if (dm > 40 && !(gt.revealAt !== undefined && now - gt.revealAt < 25000)) continue;
      const M = 34;
      let cx = Math.max(M, Math.min(GAME_WIDTH - M, px));
      let cy = Math.max(this.h.viewTop + M, Math.min(900 + TALL, py));
      const mm = this.h.mini();
      if (mm && cx < mm.x + mm.w + M && cy < mm.y + mm.h + M) cx = mm.x + mm.w + M;
      const gy = gb ? gb.bottom + 36 : 0;
      if (gb && cx > gb.left - M && cx < gb.right + M && cy < gy) cy = gy;
      cy = belowBlessHud(cx, cy, this.h.blessHud(), 34);
      for (let k = 0; k < 3 && placed.some((q) => Math.abs(q.ax - cx) < 56 && Math.abs(q.ay - cy) < 56); k++) cx = cx > GAME_WIDTH / 2 ? cx - 60 : cx + 60;
      const an = Math.atan2(py - cy || 0.001, px - cx || 0.001);
      const c = Math.cos(an);
      const sn = Math.sin(an);
      const z = 1.6;
      g.fillStyle(0x7ad8ff, 0.22 + 0.14 * Math.sin(now / 200)).fillCircle(cx, cy, 26);
      g.fillStyle(0xbff0ff, 0.95).fillTriangle(cx + c * 18 * z, cy + sn * 18 * z, cx - c * 10 * z - sn * 12 * z, cy - sn * 10 * z + c * 12 * z, cx - c * 10 * z + sn * 12 * z, cy - sn * 10 * z - c * 12 * z);
      if (!this.gateArrow) this.gateArrow = this.h.scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: '#bff0ff', stroke: '#06121e', strokeThickness: 4 }).setOrigin(0.5).setDepth(51);
      // 第 73 輪：360×640 上緣「光門 31m」和精英／Boss 的「25m」以前貼在一起、又貼著目標字條 → 碰到別的距離字就往下錯開，也不進字條
      let gly = cy - sn * 40;
      const glx = this.h.clearOfHudPanels(Math.max(46, Math.min(GAME_WIDTH - 46, cx - c * 46)), gly, cx, 72);
      if (gb && glx > gb.left - 40 && glx < gb.right + 40 && gly - 11 < gb.bottom + 4) gly = gb.bottom + 15;
      for (let k = 0; k < 4 && placed.some((q) => Math.abs(q.x - glx) < 72 && Math.abs(q.y - gly) < 24); k++) gly += 26;
      this.gateArrow.setVisible(true).setText(`光門 ${Math.round(dm)}m`).setPosition(glx, gly);
      gateShown = true;
      break;
    }
    if (!gateShown) this.gateArrow?.setVisible(false);
    // 畫面外地上的精良以上裝備（D-100）：邊緣閃爍菱形（稀有度顏色），提醒回去撿
    for (const it of s.ground ?? []) {
      if (it.kind !== 'gear' || (it.rarity ?? 1) < 2) continue;
      const px = this.h.sx(it.x);
      const py = this.h.sy(it.y);
      if (px >= 0 && px <= GAME_WIDTH && py >= this.h.viewTop + 40 && py <= 960 + TALL) continue;
      const cx = Math.max(24, Math.min(GAME_WIDTH - 24, px));
      const cy = belowBlessHud(cx, Math.max(this.h.viewTop + 24, Math.min(950 + TALL, py)), this.h.blessHud(), 22);
      const r = 11 + 2 * Math.sin(now / 140);
      g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 0.3).fillCircle(cx, cy, r + 8);
      g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 1).fillPoints([{ x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.7, y: cy }], true);
      g.lineStyle(2, 0xffffff, 0.8).strokePoints([{ x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.7, y: cy }], true);
    }
  }
}
