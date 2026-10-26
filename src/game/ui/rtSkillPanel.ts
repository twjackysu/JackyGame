// 即時戰鬥「技能點」面板（D-110）：每升一級 1 點，自由點、免費重置。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { BOW_DESC, BOW_SKILLS, BOW_VARIANTS, SKILL_VARIANTS, SKILL_VARIANTS_B } from '../../core/battle/rt/data';
import { SKILL_MAX_RANK, SKILL_TREE, addRank, cleanVariants, skillPoints, toggleVariant, usedPoints, variantIndex, type SkillRanks } from '../rtSkills';

/** 開面板；每次改動呼叫 change（呼叫端存檔＋套用；v＝選了變化的技能，D-112），關閉時呼叫 done。回傳的容器由呼叫端銷毀 */
export function openRtSkillPanel(scene: Phaser.Scene, start: SkillRanks, startVariants: readonly string[], level: number, change: (r: SkillRanks, v: string[]) => void, done: () => void, bow = false): Phaser.GameObjects.Container {
  let r = start;
  let v = cleanVariants(startVariants, r);
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
  function render(): void {
    root.removeAll(true);
    const left = skillPoints(level) - usedPoints(r);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.84).setInteractive()];
    items.push(scene.add.text(0, -520, '技能點', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -480, bow ? '長弓：技能點與劍共用・滿 5 級可以切換一種「變化」' : '技能滿 5 級可以切換兩種「變化」：同一顆按鈕換一種招式', { fontFamily: UI_FONT, fontSize: '19px', color: '#ffb6f0' }).setOrigin(0.5));
    items.push(scene.add.text(0, -448, `Lv ${level}・剩 ${left} 點（每升一級 +1，可以隨時免費重置）`, { fontFamily: UI_FONT, fontSize: '22px', color: left > 0 ? '#9fff9a' : '#c8d0f0' }).setOrigin(0.5));
    SKILL_TREE.forEach((t, i) => {
      const y = -360 + i * 140;
      const rank = r[t.id] ?? 0;
      items.push(scene.add.rectangle(0, y, 640, 120, 0x1a140c, 0.9).setStrokeStyle(2, rank ? 0xffd27a : 0x5a4a30, 0.8));
      // 長弓（D-147）：弓的招式沒有變化版
      const alt0 = bow ? BOW_VARIANTS[t.id] : SKILL_VARIANTS[t.id];
      const altB = bow ? undefined : SKILL_VARIANTS_B[t.id];
      const vi0 = variantIndex(v, t.id);
      const vi = bow && vi0 === 2 ? 0 : vi0; // 長弓沒有變化二（D-148）：劍選的變化二在弓這裡＝原招
      const alt = vi === 2 ? altB : alt0; // 現在選的變化（D-121：第二種變化）
      const on = vi > 0;
      items.push(scene.add.text(-300, y - 30, on && alt ? `${bow ? (BOW_SKILLS[t.id]?.name ?? t.name) : t.name} → ${alt.variantName}` : bow ? (BOW_SKILLS[t.id]?.name ?? t.name) : t.name, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: on ? '#ffb6f0' : '#ffffff' }).setOrigin(0, 0.5));
      if (alt0 && rank < SKILL_MAX_RANK) items.push(scene.add.text(200, y - 30, `5 級解鎖：${alt0.variantName}${altB ? `／${altB.variantName}` : ''}`, { fontFamily: UI_FONT, fontSize: '17px', color: '#c890c0' }).setOrigin(1, 0.5));
      items.push(scene.add.text(-300, y + (on || bow ? 4 : 12), on && alt ? alt.desc : bow ? (BOW_DESC[t.id] ?? '') : `每級：${t.per}`, { fontFamily: UI_FONT, fontSize: on || bow ? '16px' : '19px', color: on ? '#f0d0ea' : '#c8c0a8', wordWrap: { width: 480, useAdvancedWrap: true } }).setOrigin(0, 0.5));
      // 等級格
      const g = scene.add.graphics();
      for (let k = 0; k < SKILL_MAX_RANK; k++) {
        g.fillStyle(k < rank ? 0xffd27a : 0x3a3020, 1).fillRoundedRect(-300 + k * 34, y + 34, 28, 12, 4);
      }
      items.push(g);
      const can = !!addRank(r, t.id, level);
      if (rank >= SKILL_MAX_RANK && alt0) {
        // 原招 → 變化 → 變化二 → 原招（按鈕寫下一種的名字）
        const nextName = vi === 0 ? alt0.variantName : vi === 1 && altB ? altB.variantName : '原招';
        items.push(btn(250, y, nextName, () => {
          const n = toggleVariant(v, t.id, r, bow);
          if (!n) return;
          v = n;
          SFX.confirm();
          change(r, v);
          render();
        }, nextName !== '原招', 22));
      } else {
        items.push(btn(250, y, rank >= SKILL_MAX_RANK ? '滿' : '+1', () => {
          const n = addRank(r, t.id, level);
          if (!n) return;
          r = n;
          SFX.confirm();
          change(r, v);
          render();
          // 剛滿 5 級：提示可以切換變化（D-112）
          if (alt0 && (r[t.id] ?? 0) >= SKILL_MAX_RANK) {
            const tip = scene.add.text(0, y, `解鎖「${alt0.variantName}」${altB ? `「${altB.variantName}」` : ''}！點右邊切換`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffb6f0', stroke: '#2a0a20', strokeThickness: 6 }).setOrigin(0.5);
            root.add(tip);
            scene.tweens.add({ targets: tip, y: y - 50, alpha: 0, delay: 700, duration: 900, onComplete: () => tip.destroy() });
          }
        }, can, 30, !can));
      }
    });
    items.push(btn(-150, 400, '全部重置', () => {
      r = {};
      v = [];
      SFX.uiTap();
      change(r, v);
      render();
    }, false, 26, usedPoints(r) === 0));
    items.push(btn(150, 400, '關閉', () => done(), true));
    root.add(items);
  }
  render();
  return root;
}
