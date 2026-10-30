// 即時戰鬥「行囊」（P4-3，D-091）：6 格裝備、背包清單（▲＝比身上的好）、詳情與換上後的數值差、換上／卸下／丟棄。
import Phaser from 'phaser';
import { gearName, gearTitleW, skillNames } from '../weapon';
import { SFX } from '../../audio/sfx';
import { SWORDSMAN } from '../../core/battle/rt/data';
import { ENH_MAX, GEAR_SLOTS, RARITY_COLOR, RARITY_NAME, SLOT_NAME, enhanceCost, gearLines, gearScore, salvageDust, type GearSlot, type RtGear } from '../../core/battle/rt/gear';
import { gearIcon } from '../fx/gearIcons';
import { BAG_MAX, bonusOf, equipWith, isUpgrade, unequip, type BagState } from '../rtBag';

export { BAG_MAX, bonusOf, isUpgrade, type BagState } from '../rtBag';

import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';

const PER_PAGE = 8;
/** 身上格子比較窄：名字太長就截掉 */
const short = (s: string): string => (s.length > 7 ? `${s.slice(0, 6)}…` : s);
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/**
 * 開行囊。onChange 在每次換裝／丟棄後呼叫（呼叫端存檔並套用到戰鬥）；onClose 關閉。
 * 回傳的容器由呼叫端在 onClose 裡銷毀。
 */
/** 強化與分解需要的外部資訊（材料錢包、是否在營火旁） */
export interface BagCtx {
  wallet: () => { dust: number; crystal: number };
  atFire: () => boolean;
  /** 花材料（負數＝得到）；不夠回 false */
  spend: (dust: number, crystal: number) => boolean;
}

export function openRtBagPanel(scene: Phaser.Scene, start: BagState, stats: () => string, onChange: (st: BagState) => void, onClose: () => void, ctx?: BagCtx): Phaser.GameObjects.Container {
  let st = start;
  let page = 0;
  let detail: RtGear | null = null;
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(18, 9, 18, 9).setInteractive({ useHandCursor: true });
    t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    return t;
  };
  const cell = (x: number, y: number, w: number, h: number, g: RtGear | undefined, label: string, fn: () => void, mark = '', slot?: GearSlot): Phaser.GameObjects.GameObject[] => {
    const col = g ? RARITY_COLOR[g.rarity] : 0x555566;
    const bg = scene.add.rectangle(x, y, w, h, 0x1a140c, 0.95).setStrokeStyle(g && g.rarity > 1 ? 3 : 2, col, g ? 0.95 : 0.5).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    const sl = g?.slot ?? slot;
    const icon = sl ? gearIcon(scene, x - w / 2 + 8 + h * 0.4, y, sl, g ? g.rarity : 0, h * 0.78) : [];
    const t = scene.add.text(x - w / 2 + 14 + (sl ? h * 0.8 : 0), y, label, { fontFamily: UI_FONT, fontSize: '21px', color: g ? hex(col) : '#777788' }).setOrigin(0, 0.5);
    const out: Phaser.GameObjects.GameObject[] = [bg, ...icon, t];
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
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.93).setInteractive()];
    items.push(scene.add.text(0, -580, '行囊', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -528, stats(), { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc0' }).setOrigin(0.5));
    // 身上 6 格（3×2）
    GEAR_SLOTS.forEach((slot, i) => {
      const x = -230 + (i % 3) * 230;
      const y = -466 + Math.floor(i / 3) * 72;
      const g = st.equip[slot];
      items.push(...cell(x, y, 220, 64, g, g ? short(gearTitleW(g)) : `${SLOT_NAME[slot]}（空）`, () => {
        if (g) {
          detail = g;
          render();
        }
      }, '', slot));
    });
    // 背包清單
    // 長螢幕（第 47 輪）：多放幾列，翻頁鍵與按鈕跟著往下（以前 390×844 中間空一大塊、按鈕浮在畫面中央）
    const per = PER_PAGE + Math.max(0, Math.floor((TALL * 0.9) / 68));
    const dy = (per - PER_PAGE) * 68;
    const pages = Math.max(1, Math.ceil(st.bag.length / per));
    page = Math.min(page, pages - 1);
    const w = ctx?.wallet();
    items.push(scene.add.text(0, -338, `背包 ${st.bag.length}/${BAG_MAX}　▲＝比身上的好${w ? `　粉塵 ${w.dust}・結晶 ${w.crystal}` : ''}`, { fontFamily: UI_FONT, fontSize: '21px', color: '#c8d0f0' }).setOrigin(0.5));
    const list = st.bag.slice(page * per, page * per + per);
    if (!list.length) items.push(scene.add.text(0, -150, '還沒有裝備\n打倒怪物有機會掉落；首領常掉、狼王必掉', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    list.forEach((g, i) => {
      items.push(...cell(0, -290 + i * 68, 640, 60, g, `【${SLOT_NAME[g.slot]}】${gearTitleW(g)}　Lv${g.ilvl}`, () => {
        detail = g;
        render();
      }, isUpgrade(st, g) ? '▲' : ''));
    });
    if (pages > 1) {
      items.push(btn(-150, 270 + dy, '◀', () => {
        page = (page + pages - 1) % pages;
        render();
      }));
      items.push(scene.add.text(0, 270 + dy, `${page + 1} / ${pages}`, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
      items.push(btn(150, 270 + dy, '▶', () => {
        page = (page + 1) % pages;
        render();
      }));
    }
    items.push(btn(-150, 360 + dy, '全部換成最好的', () => {
      let next = st;
      for (const slot of GEAR_SLOTS) {
        const best = next.bag.filter((g) => g.slot === slot).sort((a, b) => gearScore(b, SWORDSMAN.hp, SWORDSMAN.atk) - gearScore(a, SWORDSMAN.hp, SWORDSMAN.atk))[0];
        if (best && isUpgrade(next, best)) next = equipWith(next, best);
      }
      if (next !== st) change(next);
      render();
    }));
    items.push(btn(150, 360 + dy, '完成', () => onClose(), true, 28));
    if (detail) items.push(...detailCard(detail));
    root.add(items);
  }

  function detailCard(g: RtGear): Phaser.GameObjects.GameObject[] {
    const worn = st.equip[g.slot]?.uid === g.uid;
    const col = RARITY_COLOR[g.rarity];
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive()];
    out.push(...gearIcon(scene, -240, -300, g.slot, g.rarity, 72));
    const title = scene.add.text(0, -300, gearTitleW(g), { fontFamily: TITLE_FONT, fontSize: '36px', color: hex(col) }).setOrigin(0.5);
    // 第 62 輪：長名字（「+4 嗜血的王牙大劍・霧語」）縮字＋往右挪，不壓到左邊的圖示（圖示右緣 x≈−204）
    if (title.width > 400) title.setFontSize(Math.max(24, Math.floor((36 * 400) / title.width)));
    if (title.width / 2 > 180) title.setX(Math.min(84, title.width / 2 - 180)); // 太寬就往右挪（卡片右緣 300）
    out.push(title);
    out.push(scene.add.text(0, -255, `${RARITY_NAME[g.rarity]}・${SLOT_NAME[g.slot]}・物品等級 ${g.ilvl}${worn ? '・裝備中' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    // 第 48 輪：從上面往下排（以前置中在 -170，5 行以上的稀有裝第一行會壓到副標）
    const gl = gearLines(g, skillNames());
    const lines = scene.add.text(0, -226, gl.join('\n'), { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff', align: 'center', lineSpacing: gl.length > 4 ? 4 : 10 }).setOrigin(0.5, 0);
    out.push(lines);
    // 第 50 輪：比較／強化／按鈕跟著數值行數往上收（以前固定 y，普通裝只有 1 行時中間空一大塊；行商第 49 輪已改）
    const cmpY = Math.max(-150, -226 + lines.height + 44);
    const btnY = cmpY + (ctx ? 160 : 90);
    const cardBottom = btnY + 50;
    out.splice(1, 0, scene.add.rectangle(0, (-340 + cardBottom) / 2, 600, cardBottom + 340, 0x120c06, 0.97).setStrokeStyle(4, col, 1));
    // 強化（D-092）：營火旁才能強化；+5 以內必成，之後有成功率，失敗只扣材料
    if (ctx) {
      const enh = g.enh ?? 0;
      if (enh >= ENH_MAX) out.push(scene.add.text(0, cmpY + 75, `已強化到 +${ENH_MAX}（最高）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd27a' }).setOrigin(0.5));
      else {
        const c = enhanceCost(enh);
        const wl = ctx.wallet();
        const ok = wl.dust >= c.dust && wl.crystal >= c.crystal;
        const fire = ctx.atFire();
        out.push(scene.add.text(0, cmpY + 50, `強化 +${enh}→+${enh + 1}：粉塵 ${c.dust}${c.crystal ? `・結晶 ${c.crystal}` : ''}・成功率 ${c.rate}%${c.rate < 100 ? '（失敗只扣材料）' : ''}`, { fontFamily: UI_FONT, fontSize: '20px', color: ok ? '#e8dcc0' : '#ff9a8a' }).setOrigin(0.5));
        if (!fire) out.push(scene.add.text(0, cmpY + 92, '到營火旁才能強化', { fontFamily: UI_FONT, fontSize: '20px', color: '#9fd8ff' }).setOrigin(0.5));
        else
          out.push(btn(0, cmpY + 104, ok ? '強化！' : '材料不夠', () => {
            if (!ok || !ctx.spend(c.dust, c.crystal)) return;
            const success = Math.random() * 100 < c.rate;
            if (success) {
              const up: RtGear = { ...g, enh: enh + 1 };
              const swap = (x: RtGear) => (x.uid === g.uid ? up : x);
              const eq = { ...st.equip };
              if (eq[g.slot]?.uid === g.uid) eq[g.slot] = up;
              change({ bag: st.bag.map(swap), equip: eq });
              detail = up;
              scene.cameras.main.flash(160, 255, 220, 140);
              SFX.perfect();
            } else {
              SFX.uiTap();
              scene.cameras.main.shake(160, 0.006);
              detail = g;
            }
            render();
            // 第 62 輪：結果字放在卡片正下方（以前固定 +360，落在「全部換成最好的／完成」上面、透出底下按鈕）
            const msgY = GAME_HEIGHT / 2 + cardBottom + 56;
            const msg = scene.add.text(GAME_WIDTH / 2, msgY, success ? `強化成功！+${enh + 1}` : '強化失敗……材料沒了', { fontFamily: TITLE_FONT, fontSize: '40px', color: success ? '#ffd27a' : '#c0c0d0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(990);
            scene.tweens.add({ targets: msg, y: msgY - 30, alpha: 0, delay: 700, duration: 700, onComplete: () => msg.destroy() });
          }, ok, 24));
      }
    }
    // 換上後的差異
    const now = bonusOf(st);
    const after = bonusOf(worn ? unequip(st, g.slot) : equipWith(st, g));
    const d = (k: 'atk' | 'hp' | 'def', name: string) => {
      const v = after[k] - now[k];
      return v === 0 ? `${name} ±0` : `${name} ${v > 0 ? '+' : ''}${v}`;
    };
    const cmp = `${worn ? '卸下後' : st.equip[g.slot] ? `換掉「${gearName(st.equip[g.slot]!)}」` : '換上後'}：${d('atk', '攻擊')}・${d('hp', 'HP')}・${d('def', '防禦')}`;
    const better = after.atk * 4 + after.hp * 0.25 + after.def * 3 > now.atk * 4 + now.hp * 0.25 + now.def * 3;
    const cmpT = scene.add.text(0, cmpY, cmp, { fontFamily: UI_FONT, fontSize: '22px', color: worn ? '#c8d0f0' : better ? '#7dffb0' : '#ff9a8a', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    // 第 62 輪：長名字換行會剩「±0」一個人在第二行、貼到強化說明 → 改寫「換掉身上的」
    if (cmpT.height > 40 && !worn && st.equip[g.slot]) cmpT.setText(`換掉身上的：${d('atk', '攻擊')}・${d('hp', 'HP')}・${d('def', '防禦')}`);
    out.push(cmpT);
    if (worn) {
      out.push(btn(-120, btnY, '卸下', () => {
        if (st.bag.length >= BAG_MAX) return;
        change(unequip(st, g.slot));
        detail = null;
        render();
      }));
    } else {
      out.push(btn(-190, btnY, '換上', () => {
        change(equipWith(st, g));
        detail = null;
        render();
      }, true, 28));
      out.push(btn(0, btnY, ctx ? `分解 +${salvageDust(g)} 粉塵` : '丟掉', () => {
        if (ctx) ctx.spend(-salvageDust(g), 0);
        change({ ...st, bag: st.bag.filter((x) => x.uid !== g.uid) });
        detail = null;
        render();
      }));
    }
    out.push(btn(worn ? 120 : 200, btnY, '返回', () => {
      detail = null;
      render();
    }));
    return out;
  }

  render();
  return root;
}
