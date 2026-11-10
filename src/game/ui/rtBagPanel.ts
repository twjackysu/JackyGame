// 即時戰鬥「行囊」（P4-3，D-091）：6 格裝備、背包清單（▲＝比身上的好）、詳情與換上後的數值差、換上／卸下／丟棄。
import { t } from '../../i18n';
import Phaser from 'phaser';
import { gearName, gearTitleW, skillNames } from '../weapon';
import { SFX } from '../../audio/sfx';
import { SWORDSMAN } from '../../core/battle/rt/data';
import { ENH_MAX, GEAR_SLOTS, SLOT_NAME, enhanceCost, enhanceDiff, enhanceGain, gearLines, gearScore, salvageDust, gearColor, gearTierName, type GearSlot, type RtGear } from '../../core/battle/rt/gear';
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
  /** 這張地圖 Boss 的簡稱（第 100 輪：空行囊說明以前一律寫「狼王必掉」，在燼紅裂谷也是） */
  bw?: string;
  /** V2（D-285）：強化交給伺服器（扣材料＋擲骰）；回 null＝伺服器失敗，退回本機舊做法 */
  roll?: (g: RtGear) => Promise<{ ok: boolean; gear: RtGear } | null>;
  /** V2（D-285）：穿脫、分解也送給伺服器（規則確定，畫面先照舊做 apply，伺服器結果再寫回）；沒給就只做 apply */
  shadow?: (intent: BagIntent, apply: () => void) => void;
}

export type BagIntent = { kind: 'equip'; uids: string[] } | { kind: 'unequip'; slot: GearSlot } | { kind: 'salvage'; uid: string };

export function openRtBagPanel(scene: Phaser.Scene, start: BagState, stats: () => string, onChange: (st: BagState) => void, onClose: () => void, ctx?: BagCtx): Phaser.GameObjects.Container {
  let st = start;
  let page = 0;
  let detail: RtGear | null = null;
  /** 強化確認框（Jacky 11/5）：按「強化！」先跳框列出每項數值 10→13（綠＝變強、紅＝變弱），確定才強化 */
  let confirmEnh = false;
  /** 獨特效果裝備分解前要再點一次（P3-d）：記住已經點過第一次的那件 */
  let confirmDrop = '';
  /** 等伺服器回強化結果（連點不重送） */
  let rolling = false;
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  // 第 106 輪（D-254）：強化結果字／火花放在場景上（depth 990～995，不在 root 裡）——點完「強化！」馬上按「完成」，
  // 從 ☰ 開的行囊會立刻回到 ☰，「強化成功！+3」還浮在暫停選單上 1.4 秒 → 面板關掉就一起收掉
  const fx: Phaser.GameObjects.GameObject[] = [];
  const keepFx = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    fx.push(o);
    o.once('destroy', () => fx.splice(fx.indexOf(o) >>> 0, 1));
    return o;
  };
  root.once('destroy', () => {
    for (const o of fx.splice(0)) {
      scene.tweens.killTweensOf(o);
      o.destroy();
    }
  });

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
    const col = g ? gearColor(g) : 0x555566;
    const bg = scene.add.rectangle(x, y, w, h, 0x1a140c, 0.95).setStrokeStyle(g && g.rarity > 1 ? 3 : 2, col, g ? 0.95 : 0.5).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    const sl = g?.slot ?? slot;
    const icon = sl ? gearIcon(scene, x - w / 2 + 8 + h * 0.4, y, sl, g ? g.rarity : 0, h * 0.78, !!g?.unique) : [];
    const t = scene.add.text(x - w / 2 + 14 + (sl ? h * 0.8 : 0), y, label, { fontFamily: UI_FONT, fontSize: '21px', color: g ? hex(col) : '#777788' }).setOrigin(0, 0.5);
    const out: Phaser.GameObjects.GameObject[] = [bg, ...icon, t];
    // 獨特效果裝備（P3-a2）：左上角一顆橘色星（不只靠外框顏色分）
    if (g?.unique) out.push(scene.add.text(x - w / 2 + 3, y - h / 2 + 1, '★', { fontFamily: UI_FONT, fontSize: '19px', color: hex(col), stroke: '#140a04', strokeThickness: 4 }).setOrigin(0, 0));
    if (mark) out.push(scene.add.text(x + w / 2 - 14, y, mark, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#7dffb0' }).setOrigin(1, 0.5));
    return out;
  };

  const shadow = (intent: BagIntent, apply: () => void): void => (ctx?.shadow ? ctx.shadow(intent, apply) : apply());
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
          confirmEnh = false;
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
    if (!list.length) items.push(scene.add.text(0, -150, `還沒有裝備\n打倒怪物有機會掉落；首領常掉、${ctx?.bw ?? '狼王'}必掉`, { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    list.forEach((g, i) => {
      items.push(...cell(0, -290 + i * 68, 640, 60, g, `【${SLOT_NAME[g.slot]}】${gearTitleW(g)}　Lv${g.ilvl}`, () => {
        detail = g;
        confirmEnh = false;
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
      const uids: string[] = [];
      for (const slot of GEAR_SLOTS) {
        const best = next.bag.filter((g) => g.slot === slot).sort((a, b) => gearScore(b, SWORDSMAN.hp, SWORDSMAN.atk) - gearScore(a, SWORDSMAN.hp, SWORDSMAN.atk))[0];
        if (best && isUpgrade(next, best)) {
          next = equipWith(next, best);
          uids.push(best.uid);
        }
      }
      if (next !== st) shadow({ kind: 'equip', uids }, () => change(next));
      render();
    }));
    items.push(btn(150, 360 + dy, '完成', () => onClose(), true, 28));
    if (detail) items.push(...detailCard(detail));
    root.add(items);
  }

  function detailCard(g: RtGear): Phaser.GameObjects.GameObject[] {
    const worn = st.equip[g.slot]?.uid === g.uid;
    const col = gearColor(g);
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive()];
    out.push(...gearIcon(scene, -240, -300, g.slot, g.rarity, 72, !!g.unique));
    const title = scene.add.text(0, -300, gearTitleW(g), { fontFamily: TITLE_FONT, fontSize: '36px', color: hex(col) }).setOrigin(0.5);
    // 第 62 輪：長名字（「+4 嗜血的王牙大劍・霧語」）縮字＋往右挪，不壓到左邊的圖示（圖示右緣 x≈−204）
    if (title.width > 400) title.setFontSize(Math.max(24, Math.floor((36 * 400) / title.width)));
    if (title.width / 2 > 180) title.setX(Math.min(84, title.width / 2 - 180)); // 太寬就往右挪（卡片右緣 300）
    out.push(title);
    out.push(scene.add.text(0, -255, `${gearTierName(g)}・${SLOT_NAME[g.slot]}・物品等級 ${g.ilvl}${worn ? '・裝備中' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    // 第 48 輪：從上面往下排（以前置中在 -170，5 行以上的稀有裝第一行會壓到副標）
    const gl = gearLines(g, skillNames());
    const lines = scene.add.text(0, -226, gl.join('\n'), { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff', align: 'center', lineSpacing: gl.length > 4 ? 4 : 10 }).setOrigin(0.5, 0);
    out.push(lines);
    // 第 50 輪：比較／強化／按鈕跟著數值行數往上收（以前固定 y，普通裝只有 1 行時中間空一大塊；行商第 49 輪已改）
    const cmpY = Math.max(-150, -226 + lines.height + 44);
    const btnY = cmpY + (ctx ? ((g.enh ?? 0) >= ENH_MAX ? 160 : 190) : 90);
    const cardBottom = btnY + 50;
    out.splice(1, 0, scene.add.rectangle(0, (-340 + cardBottom) / 2, 600, cardBottom + 340, 0x120c06, 0.97).setStrokeStyle(4, col, 1));
    // 強化（D-092）：營火旁才能強化；+5 以內必成，之後有成功率，失敗只扣材料
    const overlay: Phaser.GameObjects.GameObject[] = [];
    if (ctx) {
      const enh = g.enh ?? 0;
      if (enh >= ENH_MAX) out.push(scene.add.text(0, cmpY + 75, `已強化到 +${ENH_MAX}（最高）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd27a' }).setOrigin(0.5));
      else {
        const c = enhanceCost(enh);
        const wl = ctx.wallet();
        const ok = wl.dust >= c.dust && wl.crystal >= c.crystal;
        const fire = ctx.atFire();
        out.push(scene.add.text(0, cmpY + 50, `強化 +${enh}→+${enh + 1}：粉塵 ${c.dust}${c.crystal ? `・結晶 ${c.crystal}` : ''}・成功率 ${c.rate}%${c.rate < 100 ? '（失敗只扣材料）' : ''}`, { fontFamily: UI_FONT, fontSize: '20px', color: ok ? '#e8dcc0' : '#ff9a8a' }).setOrigin(0.5));
        // 成功後哪些數值變多少（Jacky 11/5）
        const gain = enhanceGain(g, skillNames());
        if (gain.length) {
          const gt = scene.add.text(0, cmpY + 80, `成功後：${gain.join('・')}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#ffd27a', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
          if (gt.height > 30) gt.setFontSize(16);
          out.push(gt);
        }
        if (!fire) out.push(scene.add.text(0, cmpY + 122, '到營火旁才能強化', { fontFamily: UI_FONT, fontSize: '20px', color: '#9fd8ff' }).setOrigin(0.5));
        else
          out.push(btn(0, cmpY + 134, ok ? '強化！' : '材料不夠', () => {
            if (!ok) return;
            confirmEnh = true;
            render();
          }, ok, 24));
        if (fire && ok && confirmEnh) overlay.push(...enhanceConfirm(g, enh, c, doEnhance));
        function doEnhance(): void {
            confirmEnh = false;
            const roll = ctx!.roll;
            if (roll) {
              if (rolling) return;
              rolling = true;
              void roll(g).then((res) => {
                rolling = false;
                if (!root.active) return; // 面板關了：場景已經照伺服器結果更新行囊
                if (!res) return localEnhance();
                // 場景已經照伺服器結果改好行囊與錢包；finish 換上的那件和伺服器的一樣（+1）
                finish(res.ok);
              });
              return;
            }
            localEnhance();
        }
        function localEnhance(): void {
            if (!ctx!.spend(c.dust, c.crystal)) return render();
            finish(Math.random() * 100 < c.rate);
        }
        function finish(success: boolean): void {
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
              confirmEnh = false;
            }
            render();
            // 第 62 輪：結果字放在卡片正下方（以前固定 +360，落在「全部換成最好的／完成」上面、透出底下按鈕）
            const msgY = GAME_HEIGHT / 2 + cardBottom + 56;
            const msg = keepFx(scene.add.text(GAME_WIDTH / 2, msgY, success ? `強化成功！+${enh + 1}` : '強化失敗……材料沒了', { fontFamily: TITLE_FONT, fontSize: '40px', color: success ? '#ffd27a' : '#c0c0d0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(990));
            scene.tweens.add({ targets: msg, y: msgY - 30, alpha: 0, delay: 700, duration: 700, onComplete: () => msg.destroy() });
            // 第 62 輪：成功時金色火花從裝備圖示迸出（+6 以上要賭成功率的，火花更多更遠）
            if (success) {
              const ix = GAME_WIDTH / 2 - 240;
              const iy = GAME_HEIGHT / 2 - 300;
              const n = enh + 1 > 5 ? 22 : 12;
              for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
                const d = (enh + 1 > 5 ? 110 : 70) + Math.random() * 50;
                const sp = keepFx(scene.add.circle(ix, iy, 3 + Math.random() * 4, i % 3 ? 0xffd27a : 0xfff4d0, 1).setDepth(995).setBlendMode(Phaser.BlendModes.ADD));
                scene.tweens.add({ targets: sp, x: ix + Math.cos(a) * d, y: iy + Math.sin(a) * d, alpha: 0, scale: 0.3, duration: 450 + Math.random() * 250, ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
              }
              const ring = keepFx(scene.add.circle(ix, iy, 30, 0xffd27a, 0).setStrokeStyle(4, 0xffd27a, 1).setDepth(995));
              scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
            }
        }
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
        shadow({ kind: 'unequip', slot: g.slot }, () => change(unequip(st, g.slot)));
        detail = null;
        render();
      }));
    } else {
      out.push(btn(-190, btnY, '換上', () => {
        shadow({ kind: 'equip', uids: [g.uid] }, () => change(equipWith(st, g)));
        detail = null;
        render();
      }, true, 28));
      const armed = confirmDrop === g.uid;
      const drop = btn(0, btnY, armed ? t('bag.uniqueConfirm') : ctx ? `分解 +${salvageDust(g)} 粉塵` : '丟掉', () => {
        // 獨特效果裝備：第一次點只變成紅色的確認鍵（手滑一下就沒了的話，十隻 Boss 才一件）
        if (g.unique && !armed) {
          confirmDrop = g.uid;
          render();
          return;
        }
        confirmDrop = '';
        shadow({ kind: 'salvage', uid: g.uid }, () => {
          if (ctx) ctx.spend(-salvageDust(g), 0);
          change({ ...st, bag: st.bag.filter((x) => x.uid !== g.uid) });
        });
        detail = null;
        render();
      });
      if (armed) drop.setBackgroundColor('#a8281a');
      out.push(drop);
    }
    out.push(btn(worn ? 120 : 200, btnY, '返回', () => {
      detail = null;
      confirmDrop = '';
      confirmEnh = false;
      render();
    }));
    return out.concat(overlay);
  }

  /** 強化確認框：每項「原值 → 新值」，變強綠、變弱紅、不變灰 */
  function enhanceConfirm(g: RtGear, enh: number, c: { dust: number; crystal: number; rate: number }, go: () => void): Phaser.GameObjects.GameObject[] {
    const rows = enhanceDiff(g, skillNames());
    const o: Phaser.GameObjects.GameObject[] = [];
    const h = 250 + rows.length * 44;
    o.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive());
    o.push(scene.add.rectangle(0, 0, 520, h, 0x1a1208, 0.98).setStrokeStyle(4, 0xffd27a, 1));
    let y = -h / 2 + 40;
    o.push(scene.add.text(0, y, `強化 +${enh} → +${enh + 1}？`, { fontFamily: TITLE_FONT, fontSize: '32px', color: '#ffd27a' }).setOrigin(0.5));
    y += 56;
    for (const r of rows) {
      const col = r.delta > 0 ? '#7dffb0' : r.delta < 0 ? '#ff7a6a' : '#a0a0b0';
      const fs = r.label.length > 6 ? '20px' : '24px';
      o.push(scene.add.text(-220, y, r.label, { fontFamily: UI_FONT, fontSize: fs, color: '#e8dcc0' }).setOrigin(0, 0.5));
      o.push(scene.add.text(70, y, r.from, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5));
      o.push(scene.add.text(100, y, '→', { fontFamily: UI_FONT, fontSize: '24px', color: col }).setOrigin(0.5));
      o.push(scene.add.text(130, y, r.delta === 0 ? `${r.to}（不變）` : r.to, { fontFamily: UI_FONT, fontSize: '24px', color: col, fontStyle: r.delta ? 'bold' : 'normal' }).setOrigin(0, 0.5));
      y += 44;
    }
    y += 8;
    o.push(scene.add.text(0, y, `粉塵 ${c.dust}${c.crystal ? `・結晶 ${c.crystal}` : ''}・成功率 ${c.rate}%`, { fontFamily: UI_FONT, fontSize: '21px', color: c.rate < 100 ? '#ffb08a' : '#e8dcc0' }).setOrigin(0.5));
    if (c.rate < 100) o.push(scene.add.text(0, y + 28, '失敗只扣材料，不會掉級', { fontFamily: UI_FONT, fontSize: '18px', color: '#a0a0b0' }).setOrigin(0.5));
    const by = h / 2 - 44;
    o.push(btn(-110, by, '確定強化', go, true, 26));
    o.push(btn(110, by, '取消', () => {
      confirmEnh = false;
      render();
    }));
    return o;
  }

  render();
  return root;
}
