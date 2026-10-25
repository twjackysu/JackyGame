// 即時戰鬥「行囊」（P4-3，D-091）：6 格裝備、背包清單（▲＝比身上的好）、詳情與換上後的數值差、換上／卸下／丟棄。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SWORDSMAN } from '../../core/battle/rt/data';
import { GEAR_SLOTS, RARITY_COLOR, RARITY_NAME, SLOT_NAME, gearLines, gearScore, type RtGear } from '../../core/battle/rt/gear';
import { BAG_MAX, bonusOf, equipWith, isUpgrade, unequip, type BagState } from '../rtBag';

export { BAG_MAX, bonusOf, isUpgrade, type BagState } from '../rtBag';

import { GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';

const PER_PAGE = 8;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/**
 * 開行囊。onChange 在每次換裝／丟棄後呼叫（呼叫端存檔並套用到戰鬥）；onClose 關閉。
 * 回傳的容器由呼叫端在 onClose 裡銷毀。
 */
export function openRtBagPanel(scene: Phaser.Scene, start: BagState, stats: () => string, onChange: (st: BagState) => void, onClose: () => void): Phaser.GameObjects.Container {
  let st = start;
  let page = 0;
  let detail: RtGear | null = null;
  const root = scene.add.container(GAME_WIDTH / 2, 640).setDepth(960);

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(18, 9, 18, 9).setInteractive({ useHandCursor: true });
    t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    return t;
  };
  const cell = (x: number, y: number, w: number, h: number, g: RtGear | undefined, label: string, fn: () => void, mark = ''): Phaser.GameObjects.GameObject[] => {
    const col = g ? RARITY_COLOR[g.rarity] : 0x555566;
    const bg = scene.add.rectangle(x, y, w, h, 0x1a140c, 0.95).setStrokeStyle(g && g.rarity > 1 ? 3 : 2, col, g ? 0.95 : 0.5).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    const t = scene.add.text(x - w / 2 + 14, y, label, { fontFamily: UI_FONT, fontSize: '21px', color: g ? hex(col) : '#777788' }).setOrigin(0, 0.5);
    const out: Phaser.GameObjects.GameObject[] = [bg, t];
    if (mark) out.push(scene.add.text(x + w / 2 - 14, y, mark, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#7dffb0' }).setOrigin(1, 0.5));
    return out;
  };

  function change(next: BagState): void {
    st = next;
    onChange(st);
    SFX.confirm();
  }

  function render(): void {
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, 1280, 0x000000, 0.86).setInteractive()];
    items.push(scene.add.text(0, -580, '行囊', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -528, stats(), { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc0' }).setOrigin(0.5));
    // 身上 6 格（3×2）
    GEAR_SLOTS.forEach((slot, i) => {
      const x = -230 + (i % 3) * 230;
      const y = -460 + Math.floor(i / 3) * 74;
      const g = st.equip[slot];
      items.push(...cell(x, y, 220, 64, g, g ? g.name : `${SLOT_NAME[slot]}（空）`, () => {
        if (g) {
          detail = g;
          render();
        }
      }));
    });
    // 背包清單
    const pages = Math.max(1, Math.ceil(st.bag.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    items.push(scene.add.text(0, -352, `背包 ${st.bag.length}/${BAG_MAX}　▲＝比身上的好`, { fontFamily: UI_FONT, fontSize: '21px', color: '#c8d0f0' }).setOrigin(0.5));
    const list = st.bag.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    if (!list.length) items.push(scene.add.text(0, -150, '還沒有裝備\n打倒怪物有機會掉落；首領常掉、狼王必掉', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    list.forEach((g, i) => {
      items.push(...cell(0, -290 + i * 68, 640, 60, g, `【${SLOT_NAME[g.slot]}】${g.name}　Lv${g.ilvl}`, () => {
        detail = g;
        render();
      }, isUpgrade(st, g) ? '▲' : ''));
    });
    if (pages > 1) {
      items.push(btn(-150, 270, '◀', () => {
        page = (page + pages - 1) % pages;
        render();
      }));
      items.push(scene.add.text(0, 270, `${page + 1} / ${pages}`, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
      items.push(btn(150, 270, '▶', () => {
        page = (page + 1) % pages;
        render();
      }));
    }
    items.push(btn(-150, 360, '全部換成最好的', () => {
      let next = st;
      for (const slot of GEAR_SLOTS) {
        const best = next.bag.filter((g) => g.slot === slot).sort((a, b) => gearScore(b, SWORDSMAN.hp, SWORDSMAN.atk) - gearScore(a, SWORDSMAN.hp, SWORDSMAN.atk))[0];
        if (best && isUpgrade(next, best)) next = equipWith(next, best);
      }
      if (next !== st) change(next);
      render();
    }));
    items.push(btn(150, 360, '完成', () => onClose(), true, 28));
    if (detail) items.push(...detailCard(detail));
    root.add(items);
  }

  function detailCard(g: RtGear): Phaser.GameObjects.GameObject[] {
    const worn = st.equip[g.slot]?.uid === g.uid;
    const col = RARITY_COLOR[g.rarity];
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, 1280, 0x000000, 0.5).setInteractive()];
    out.push(scene.add.rectangle(0, -60, 600, 560, 0x120c06, 0.97).setStrokeStyle(4, col, 1));
    out.push(scene.add.text(0, -300, g.name, { fontFamily: TITLE_FONT, fontSize: '36px', color: hex(col) }).setOrigin(0.5));
    out.push(scene.add.text(0, -255, `${RARITY_NAME[g.rarity]}・${SLOT_NAME[g.slot]}・物品等級 ${g.ilvl}${worn ? '・裝備中' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    out.push(scene.add.text(0, -160, gearLines(g).join('\n'), { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff', align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0.5));
    // 換上後的差異
    const now = bonusOf(st);
    const after = bonusOf(worn ? unequip(st, g.slot) : equipWith(st, g));
    const d = (k: 'atk' | 'hp' | 'def', name: string) => {
      const v = after[k] - now[k];
      return v === 0 ? `${name} ±0` : `${name} ${v > 0 ? '+' : ''}${v}`;
    };
    const cmp = `${worn ? '卸下後' : st.equip[g.slot] ? `換掉「${st.equip[g.slot]!.name}」` : '換上後'}：${d('atk', '攻擊')}・${d('hp', 'HP')}・${d('def', '防禦')}`;
    const better = after.atk * 4 + after.hp * 0.25 + after.def * 3 > now.atk * 4 + now.hp * 0.25 + now.def * 3;
    out.push(scene.add.text(0, 30, cmp, { fontFamily: UI_FONT, fontSize: '22px', color: worn ? '#c8d0f0' : better ? '#7dffb0' : '#ff9a8a', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    if (worn) {
      out.push(btn(-120, 140, '卸下', () => {
        if (st.bag.length >= BAG_MAX) return;
        change(unequip(st, g.slot));
        detail = null;
        render();
      }));
    } else {
      out.push(btn(-170, 140, '換上', () => {
        change(equipWith(st, g));
        detail = null;
        render();
      }, true, 28));
      out.push(btn(0, 140, '丟掉', () => {
        change({ ...st, bag: st.bag.filter((x) => x.uid !== g.uid) });
        detail = null;
        render();
      }));
    }
    out.push(btn(worn ? 120 : 170, 140, '返回', () => {
      detail = null;
      render();
    }));
    return out;
  }

  render();
  return root;
}
