// 即時戰鬥「技能點」面板（D-110）：每升一級 1 點，自由點、免費重置。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { SKILL_VARIANTS } from '../../core/battle/rt/data';
import { SKILL_MAX_RANK, SKILL_TREE, addRank, cleanVariants, skillPoints, toggleVariant, usedPoints, type SkillRanks } from '../rtSkills';

/** 開面板；每次改動呼叫 change（呼叫端存檔＋套用；v＝選了變化的技能，D-112），關閉時呼叫 done。回傳的容器由呼叫端銷毀 */
export function openRtSkillPanel(scene: Phaser.Scene, start: SkillRanks, startVariants: readonly string[], level: number, change: (r: SkillRanks, v: string[]) => void, done: () => void): Phaser.GameObjects.Container {
  let r = start;
  let v = cleanVariants(startVariants, r);
  const root = scene.add.container(GAME_WIDTH / 2, 640).setDepth(960);
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
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, 1280, 0x000000, 0.84).setInteractive()];
    items.push(scene.add.text(0, -520, '技能點', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -480, '技能滿 5 級可以切換「變化」：同一顆按鈕換一種招式', { fontFamily: UI_FONT, fontSize: '19px', color: '#ffb6f0' }).setOrigin(0.5));
    items.push(scene.add.text(0, -448, `Lv ${level}・剩 ${left} 點（每升一級 +1，可以隨時免費重置）`, { fontFamily: UI_FONT, fontSize: '22px', color: left > 0 ? '#9fff9a' : '#c8d0f0' }).setOrigin(0.5));
    SKILL_TREE.forEach((t, i) => {
      const y = -360 + i * 140;
      const rank = r[t.id] ?? 0;
      items.push(scene.add.rectangle(0, y, 640, 120, 0x1a140c, 0.9).setStrokeStyle(2, rank ? 0xffd27a : 0x5a4a30, 0.8));
      const alt = SKILL_VARIANTS[t.id];
      const on = v.includes(t.id);
      items.push(scene.add.text(-300, y - 30, on && alt ? `${t.name} → ${alt.variantName}` : t.name, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: on ? '#ffb6f0' : '#ffffff' }).setOrigin(0, 0.5));
      if (alt && rank < SKILL_MAX_RANK) items.push(scene.add.text(200, y - 30, `5 級解鎖：${alt.variantName}`, { fontFamily: UI_FONT, fontSize: '17px', color: '#c890c0' }).setOrigin(1, 0.5));
      items.push(scene.add.text(-300, y + (on ? 4 : 12), on && alt ? alt.desc : `每級：${t.per}`, { fontFamily: UI_FONT, fontSize: on ? '17px' : '19px', color: on ? '#f0d0ea' : '#c8c0a8', wordWrap: { width: 480, useAdvancedWrap: true } }).setOrigin(0, 0.5));
      // 等級格
      const g = scene.add.graphics();
      for (let k = 0; k < SKILL_MAX_RANK; k++) {
        g.fillStyle(k < rank ? 0xffd27a : 0x3a3020, 1).fillRoundedRect(-300 + k * 34, y + 34, 28, 12, 4);
      }
      items.push(g);
      const can = !!addRank(r, t.id, level);
      if (rank >= SKILL_MAX_RANK && alt) {
        items.push(btn(250, y, on ? '原招' : '變化', () => {
          const n = toggleVariant(v, t.id, r);
          if (!n) return;
          v = n;
          SFX.confirm();
          change(r, v);
          render();
        }, !on, 26));
      } else {
        items.push(btn(250, y, rank >= SKILL_MAX_RANK ? '滿' : '+1', () => {
          const n = addRank(r, t.id, level);
          if (!n) return;
          r = n;
          SFX.confirm();
          change(r, v);
          render();
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
