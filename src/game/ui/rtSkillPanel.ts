// 即時戰鬥「技能樹」面板（D-110 → D-272）：每升一級 1 點，自由點、免費重置。
// Jacky 11/5：「技能樹應該要真的像樹狀比較好點擊（像暗黑破壞神）」→ 五個技能排成五欄，
// 上面是技能節點（點一下就加一點），往下長出三個分支（原招／變化／變化二），滿 5 級點分支就改用那種打法；
// 下方說明框顯示選到的節點，也有大大的「+1」按鈕。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { WEAPONS, type WeaponKind } from '../../core/battle/rt/data';
import { AUTO_SKILL_IDS } from '../../core/battle/rt/auto';
import { t as tr } from '../../i18n';
import { SKILL_MAX_RANK, SKILL_TREE, addRank, cleanVariants, dotOf, rankTotalText, setVariant, skillPoints, usedPoints, variantIndex, type SkillRanks } from '../rtSkills';

const COL_X = [-276, -138, 0, 138, 276];
const NODE_Y = -350;
const BRANCH_Y = [-196, -116, -36];

/** 玩家這次做了什麼（第 141 輪 V2：呼叫端把「意圖」送給伺服器，r／v 只是畫面先顯示的結果） */
export type SkillIntent = { kind: 'add'; skill: string } | { kind: 'variant'; skill: string; idx: 0 | 1 | 2 } | { kind: 'reset' };

/** 開面板；每次改動呼叫 change（呼叫端存檔＋套用；v＝選了變化的技能，D-112），關閉時呼叫 done。回傳的容器由呼叫端銷毀 */
export function openRtSkillPanel(scene: Phaser.Scene, start: SkillRanks, startVariants: readonly string[], level: number, change: (r: SkillRanks, v: string[], intent: SkillIntent) => void, done: () => void, weapon: WeaponKind = 'sword', auto?: { ids: readonly string[]; change: (ids: string[]) => void }): Phaser.GameObjects.Container {
  const W = WEAPONS[weapon];
  let r = start;
  let v = cleanVariants(startVariants, r);
  /** 說明框顯示哪個節點：欄、-1＝技能本身、0/1/2＝分支 */
  let sel: { col: number; node: -1 | 0 | 1 | 2 } = { col: 0, node: -1 };
  let justUnlocked = -1;
  /** 自動施放的技能欄（P1，D-342）；沒給 auto＝不顯示開關 */
  let autoIds = [...(auto?.ids ?? [])];
  let pulse: Phaser.Tweens.Tween | null = null;
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 26, off = false): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: off ? '#8a8070' : hi ? '#1a0f08' : '#ffffff', backgroundColor: off ? '#2a2218' : hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(18, 9, 18, 9);
    if (!off) {
      t.setInteractive({ useHandCursor: true });
      t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        fn();
      });
    }
    return t;
  };
  const tap = (o: Phaser.GameObjects.Shape, fn: () => void): void => {
    o.setInteractive({ useHandCursor: true });
    o.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      fn();
    });
  };
  const skillName = (id: string, fallback: string): string => W.skills[id]?.name ?? fallback;
  const altOf = (id: string, k: 1 | 2) => (k === 1 ? W.variants[id] : W.variantsB[id]);

  function addPoint(col: number): void {
    const t = SKILL_TREE[col]!;
    const n = addRank(r, t.id, level);
    if (!n) return;
    r = n;
    SFX.confirm();
    change(r, v, { kind: 'add', skill: t.id });
    if ((r[t.id] ?? 0) >= SKILL_MAX_RANK && W.variants[t.id]) justUnlocked = col;
  }
  function pickBranch(col: number, k: 0 | 1 | 2): void {
    const t = SKILL_TREE[col]!;
    const n = setVariant(v, t.id, k, r, weapon);
    if (!n) return;
    if (variantIndex(v, t.id) !== k) SFX.confirm();
    v = n;
    change(r, v, { kind: 'variant', skill: t.id, idx: k });
  }

  function render(): void {
    pulse?.remove();
    pulse = null;
    root.removeAll(true);
    const left = skillPoints(level) - usedPoints(r);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.93).setInteractive()];
    items.push(scene.add.text(0, -530, '技能樹', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -486, `Lv ${level}・剩 ${left} 點（每升一級 +1，隨時免費重置）`, { fontFamily: UI_FONT, fontSize: '22px', color: left > 0 ? '#9fff9a' : '#c8d0f0' }).setOrigin(0.5));
    items.push(scene.add.text(0, -454, '點技能加點・滿 5 級往下選一種打法・點數三把武器共用', { fontFamily: UI_FONT, fontSize: '18px', color: '#ffb6f0' }).setOrigin(0.5));
    const g = scene.add.graphics();
    items.push(g);
    const pulses: Phaser.GameObjects.GameObject[] = [];
    /** 要畫在樹幹上面的東西（開關藥丸） */
    const late: Phaser.GameObjects.GameObject[] = [];
    SKILL_TREE.forEach((t, col) => {
      const x = COL_X[col]!;
      const rank = r[t.id] ?? 0;
      const full = rank >= SKILL_MAX_RANK;
      const hasAlt = !!W.variants[t.id];
      const vi = variantIndex(v, t.id);
      const isSel = sel.col === col;
      // 樹幹：技能 → 三個分支（滿級才亮）
      if (hasAlt) {
        g.lineStyle(6, full ? 0xffd27a : 0x3a3020, 1).lineBetween(x, NODE_Y + 60, x, BRANCH_Y[2]!);
        if (full) g.lineStyle(10, 0xffd27a, 0.15).lineBetween(x, NODE_Y + 60, x, BRANCH_Y[2]!);
      }
      // 技能節點
      if (isSel && sel.node === -1) g.fillStyle(0xffd27a, 0.18).fillCircle(x, NODE_Y, 66);
      const node = scene.add.circle(x, NODE_Y, 54, rank ? 0x3a2a10 : 0x1a140c, 1).setStrokeStyle(rank ? 5 : 3, full ? 0xffd27a : rank ? 0xc8a060 : 0x5a4a30, 1);
      tap(node, () => {
        sel = { col, node: -1 };
        addPoint(col);
        render();
      });
      items.push(node);
      const nm = skillName(t.id, t.name);
      items.push(scene.add.text(x, NODE_Y - 10, nm, { fontFamily: UI_FONT, fontSize: nm.length > 3 ? '21px' : '25px', fontStyle: '700', color: rank ? '#ffffff' : '#b0a890' }).setOrigin(0.5));
      items.push(scene.add.text(x, NODE_Y + 22, `${rank}/${SKILL_MAX_RANK}`, { fontFamily: UI_FONT, fontSize: '19px', color: full ? '#ffd27a' : '#c8c0a8' }).setOrigin(0.5));
      // 等級點（節點下方 5 顆）
      for (let k = 0; k < SKILL_MAX_RANK; k++) g.fillStyle(k < rank ? 0xffd27a : 0x3a3020, 1).fillCircle(x - 32 + k * 16, NODE_Y + 70, 5);
      // 自動／手動開關（P1）：等級點下面一顆小藥丸（第 4 欄換成攻守一體後也能自動，D-345）
      if (auto) {
        const can = AUTO_SKILL_IDS.includes(t.id);
        const on = can && autoIds.includes(t.id);
        const pill = scene.add.text(x, NODE_Y + 98, `${on ? '⟳ ' : ''}${tr(can ? (on ? 'auto.on' : 'auto.off') : 'auto.locked')}`, { fontFamily: UI_FONT, fontSize: '19px', fontStyle: '700', color: on ? '#0a2a14' : can ? '#e8dcc0' : '#7a705c', backgroundColor: on ? '#7dffb0' : can ? '#3a2a14' : '#1a140c' }).setOrigin(0.5).setPadding(14, 5, 14, 5);
        if (can) {
          // 點擊範圍比看到的大一圈（手機上藥丸只有 20px 高）
          pill.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-22, -9, pill.width + 44, pill.height + 18), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
          pill.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            autoIds = on ? autoIds.filter((id) => id !== t.id) : [...autoIds, t.id];
            SFX.uiTap();
            auto.change(autoIds);
            sel = { col, node: -1 };
            render();
          });
        }
        late.push(pill);
      }
      // 還能加點：右上角綠色 +
      if (addRank(r, t.id, level)) {
        const plus = scene.add.text(x + 42, NODE_Y - 44, '+', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#0a2a0a', backgroundColor: '#7dffb0' }).setOrigin(0.5).setPadding(7, 0, 7, 0);
        items.push(plus);
        pulses.push(plus);
      }
      if (!hasAlt) return;
      // 分支：原招／變化／變化二
      ([0, 1, 2] as const).forEach((k) => {
        const by = BRANCH_Y[k]!;
        const alt = k === 0 ? null : altOf(t.id, k);
        if (k > 0 && !alt) return;
        const on = full && vi === k;
        const box = scene.add.rectangle(x, by, 128, 60, on ? 0x4a1a40 : full ? 0x241a10 : 0x141008, 1).setStrokeStyle(on ? 4 : 2, on ? 0xffb6f0 : full ? 0xc8a060 : 0x3a3020, 1);
        if (sel.col === col && sel.node === k) g.fillStyle(0xffb6f0, 0.2).fillRoundedRect(x - 72, by - 38, 144, 76, 12);
        tap(box, () => {
          sel = { col, node: k };
          pickBranch(col, k);
          render();
        });
        items.push(box);
        const label = k === 0 ? '原招' : alt!.variantName;
        items.push(scene.add.text(x, by, label, { fontFamily: UI_FONT, fontSize: label.length > 3 ? '20px' : '22px', fontStyle: on ? '700' : 'normal', color: on ? '#ffb6f0' : full ? '#e8dcc0' : '#6a604c' }).setOrigin(0.5));
        if (!full) items.push(scene.add.text(x + 52, by - 22, '🔒', { fontSize: '14px' }).setOrigin(0.5).setAlpha(0.7));
        if (justUnlocked === col) {
          const flash = scene.add.rectangle(x, by, 128, 60, 0xffb6f0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
          items.push(flash);
          scene.tweens.add({ targets: flash, alpha: 0, delay: k * 120, duration: 700, onComplete: () => flash.destroy() });
        }
      });
    });
    // 說明框
    const bx = 0;
    const by = 160;
    items.push(scene.add.rectangle(bx, by, 660, 300, 0x1a140c, 0.95).setStrokeStyle(2, 0x5a4a30, 1));
    const t = SKILL_TREE[sel.col]!;
    const rank = r[t.id] ?? 0;
    const full = rank >= SKILL_MAX_RANK;
    const nm = skillName(t.id, t.name);
    let title: string;
    let desc: string;
    let sub: string;
    let action: Phaser.GameObjects.Text;
    if (sel.node === -1) {
      title = `${nm}　Lv ${rank}/${SKILL_MAX_RANK}`;
      desc = W.desc?.[t.id] ?? '';
      // RF-05b：寫出「現在加了多少」（和實際套用的同一份數字），不只寫每級多少
      sub = `每級 ${t.per}${W.variants[t.id] && !full ? '・5 級開放下面的分支' : ''}${rank > 0 ? `\n現在（Lv ${rank}）：${rankTotalText(t.id, rank)}` : ''}${auto ? `\n${tr(!AUTO_SKILL_IDS.includes(t.id) ? 'auto.descLocked' : autoIds.includes(t.id) ? 'auto.descOn' : 'auto.descOff')}` : ''}`;
      const can = !!addRank(r, t.id, level);
      action = btn(0, by + 114, full ? '已滿級' : can ? '+1 加點' : '沒有技能點了', () => {
        addPoint(sel.col);
        render();
      }, can, 28, !can);
    } else {
      const k = sel.node;
      const alt = k === 0 ? null : altOf(t.id, k);
      title = k === 0 ? `${nm}（原招）` : `${nm} → ${alt?.variantName ?? ''}`;
      desc = k === 0 ? (W.desc?.[t.id] ?? '') : (alt?.desc ?? '');
      const using = full && variantIndex(v, t.id) === k;
      sub = full ? (using ? '使用中' : '點「改用」就換成這種打法（隨時可以換回來）') : `${nm}滿 5 級才能選（現在 ${rank}/${SKILL_MAX_RANK}）`;
      // 持續傷害不吃「傷害 +%」（只加在直接命中）：有灼燒／中毒的打法講清楚
      const def = k === 0 ? W.skills[t.id] : alt;
      const dot = def ? dotOf(def) : null;
      if (dot && t.mod(1).dmgPct) sub += `\n技能點的傷害加成只算直接命中，${dot === 'burn' ? '灼燒' : '中毒'}的傷害不變`;
      action = btn(0, by + 114, using ? '使用中' : full ? '改用這招' : '還沒解鎖', () => {
        pickBranch(sel.col, k);
        render();
      }, full && !using, 28, !full || using);
    }
    items.push(scene.add.text(-300, by - 122, title, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: sel.node > 0 ? '#ffb6f0' : '#ffffff' }).setOrigin(0, 0));
    items.push(scene.add.text(-300, by - 78, desc, { fontFamily: UI_FONT, fontSize: '19px', color: '#e8dcc0', wordWrap: { width: 600, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0, 0));
    items.push(scene.add.text(-300, by + 34, sub, { fontFamily: UI_FONT, fontSize: '19px', color: '#e0b870', wordWrap: { width: 600, useAdvancedWrap: true }, lineSpacing: 3 }).setOrigin(0, 0.5));
    items.push(action);
    if (justUnlocked >= 0) {
      const j = SKILL_TREE[justUnlocked]!;
      const tip = scene.add.text(0, -420, `「${skillName(j.id, j.name)}」滿級！往下選一種打法`, { fontFamily: TITLE_FONT, fontSize: '26px', color: '#ffb6f0', stroke: '#2a0a20', strokeThickness: 5 }).setOrigin(0.5);
      items.push(tip);
      scene.tweens.add({ targets: tip, alpha: 0, delay: 1400, duration: 500, onComplete: () => tip.destroy() });
      justUnlocked = -1;
    }
    items.push(btn(-150, 400, '全部重置', () => {
      r = {};
      v = [];
      SFX.uiTap();
      change(r, v, { kind: 'reset' });
      render();
    }, false, 26, usedPoints(r) === 0));
    items.push(btn(150, 400, '關閉', () => done(), true));
    root.add(items);
    root.add(late);
    if (pulses.length) pulse = scene.tweens.add({ targets: pulses, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  root.once('destroy', () => pulse?.remove());
  render();
  return root;
}
