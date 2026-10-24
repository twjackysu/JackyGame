// 背包選單（探索中 ☰）：裝備（選角色 → 選欄位 → 換裝）、道具一覽。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS } from '../../core/battle/skills';
import { canEquip, gearDelta, owns, unequip, equip } from '../../core/state/equip';
import type { MemberId } from '../../core/state/gameState';
import { ITEM_DEFS, PERK_INFO, RARITY_COLOR, RARITY_CSS, RARITY_NAME, SLOTS, SLOT_NAME, itemDef, type Slot } from '../../data/equipment';
import { TREE_BY_ID, branchName, effectText, type TreeNode } from '../../data/skillTree';
import { bossPoints, branchPoints, learn, learnState, learned, missingText, nodeDesc, pointsLeft, rankOf, resetCost, resetTree, treeFor } from '../../core/state/skillTree';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce, sparks } from '../fx/feel';
import { session, withNames } from '../session';
import { HERO_COLOR } from './partyPanel';
import { bonusText, deltaScore, deltaText, heroName, itemIcon, itemSubline, memberStats, itemNameColor } from './gearUi';

type Tab = 'gear' | 'skills' | 'items' | 'codex';

/** atCamp：在營火旁開啟 → 技能樹重置免費 */
export function openBag(scene: Phaser.Scene, depth = 300, start: Tab = 'gear', atCamp = false): Promise<void> {
  return new Promise((resolve) => {
    const s = session.state;
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setInteractive();
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(24, 70, GAME_WIDTH - 48, 1150, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(24, 70, GAME_WIDTH - 48, 1150, 24);
    const title = scene.add.text(GAME_WIDTH / 2, 120, '行囊', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5);
    const gold = scene.add.text(GAME_WIDTH - 60, 120, '', { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe6a0' }).setOrigin(1, 0.5);
    const TAB_X: Record<Tab, number> = { gear: 140, skills: 287, items: 433, codex: 580 };
    const tabs: Record<Tab, Phaser.GameObjects.Text> = {
      skills: scene.add.text(TAB_X.skills, 186, '技能', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#fff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true }),
      gear: scene.add.text(TAB_X.gear, 186, '裝備', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#fff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true }),
      items: scene.add.text(TAB_X.items, 186, '道具', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#fff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true }),
      codex: scene.add.text(TAB_X.codex, 186, '收藏', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#fff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true }),
    };
    const tabG = scene.add.graphics();
    ui.add([dim, g, title, gold, tabG, tabs.gear, tabs.skills, tabs.items, tabs.codex]);

    let tab: Tab = start;
    let who: MemberId = s.party[0] ?? 'lian';
    let slot: Slot | null = null;
    let page = 0;
    /** 技能樹：第一次點選取（看說明），再點一次才學 */
    let selNode: string | null = null;
    let body: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      ui.add(o);
      body.push(o);
      return o;
    };
    const onTap = (o: Phaser.GameObjects.GameObject, fn: () => void) => {
      o.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        fn();
      });
    };

    const render = (): void => {
      body.forEach((o) => o.destroy());
      body = [];
      gold.setText(`◎ ${s.gold}`);
      tabG.clear().fillStyle(0xffd27a, 1).fillRoundedRect(TAB_X[tab] - 60, 208, 120, 5, 2);
      (Object.keys(tabs) as Tab[]).forEach((k) => tabs[k].setColor(tab === k ? '#ffd27a' : '#6a7398'));
      if (tab === 'gear') renderGear();
      else if (tab === 'skills') renderSkills();
      else if (tab === 'codex') renderCodex();
      else renderItems();
    };

    const memberChips = (): void => {
      const party = s.party.filter((m) => s.members[m]);
      const cw = Math.min(150, (GAME_WIDTH - 100) / Math.max(1, party.length));
      party.forEach((m, i) => {
        const x = 50 + cw * i + cw / 2;
        const on = m === who;
        const chip = add(scene.add.container(x, 270));
        const cg = scene.add.graphics();
        const col = HERO_COLOR[m] ?? 0xffffff;
        cg.fillStyle(on ? 0x262c50 : 0x141830, 1).fillRoundedRect(-cw / 2 + 4, -30, cw - 8, 60, 14);
        cg.lineStyle(on ? 3 : 1.5, col, on ? 1 : 0.4).strokeRoundedRect(-cw / 2 + 4, -30, cw - 8, 60, 14);
        chip.add(cg);
        chip.add(scene.add.text(0, 0, withNames(heroName(m)), { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: on ? '#ffffff' : '#8a94b8' }).setOrigin(0.5));
        chip.setSize(cw - 8, 60).setInteractive({ useHandCursor: true });
        onTap(chip, () => {
          if (who === m) return;
          who = m;
          selNode = null;
          slot = null;
          SFX.uiTap();
          render();
        });
      });
    };

    const renderSkills = (): void => {
      memberChips();
      const left = pointsLeft(s, who);
      const bp = bossPoints(s);
      add(scene.add.text(60, 340, `技能點 ${left}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: left > 0 ? '#7dffb0' : '#8a94b8' }).setOrigin(0, 0.5));
      add(scene.add.text(214, 342, `Lv${s.members[who]?.level ?? 1}${bp ? `＋Boss ${bp}` : ''}`, { fontFamily: UI_FONT, fontSize: '17px', color: '#6a7398' }).setOrigin(0, 0.5));
      const have = learned(s, who);
      if (have.length > 0) {
        const cost = resetCost(s, who, atCamp);
        const rb = add(scene.add.text(GAME_WIDTH - 56, 340, `↺ 重置${cost ? `（${cost} 金）` : '（營火・免費）'}`, { fontFamily: UI_FONT, fontSize: '20px', color: cost > s.gold ? '#6a5a5a' : '#ffb0a0' }).setOrigin(1, 0.5).setPadding(12, 8, 12, 8).setInteractive({ useHandCursor: true }));
        onTap(rb, () => {
          if (!resetTree(s, who, atCamp)) {
            SFX.uiCancel();
            hint('金幣不夠——在營火旁重置免費');
            return;
          }
          SFX.uiCancel();
          session.save();
          render();
          hint(cost ? `已重置（花了 ${cost} 金）` : '已重置，點數全部退回', '#ffe6a0');
        });
      }
      const nodes = treeFor(who);
      const lines = add(scene.add.graphics());
      const pos = (n: TreeNode) => ({ x: (n.branch === 0 ? 196 : 524) + n.col * 80, y: 476 + n.row * 140 });
      ([0, 1] as const).forEach((br) => {
        const cx = br === 0 ? 196 : 524;
        add(scene.add.text(cx, 398, `— ${branchName(who, br)}　${branchPoints(s, who, br)} 點 —`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffd27a' }).setOrigin(0.5));
      });
      // 連線先畫（在節點下面）
      for (const n of nodes) {
        const p = pos(n);
        for (const [rid, r] of n.requires.nodes ?? []) {
          const q = TREE_BY_ID[rid];
          if (!q) continue;
          const a = pos(q);
          const met = rankOf(s, who, rid) >= r;
          lines.lineStyle(met ? 5 : 3, met ? 0xffd27a : 0x2a3050, met ? 0.9 : 1).lineBetween(a.x, a.y + 46, p.x, p.y - 46);
        }
      }
      for (const n of nodes) {
        const { x, y } = pos(n);
        const rank = rankOf(s, who, n.id);
        const st = learnState(s, who, n.id);
        const on = rank > 0;
        const ult = n.row === 4;
        const box = add(scene.add.container(x, y));
        const bg = scene.add.graphics();
        const edge = st === 'maxed' ? 0xffd27a : on ? 0xd8b060 : st === 'ok' ? 0x7dffb0 : 0x2a3050;
        bg.fillStyle(on ? (n.skill ? 0x3a2448 : 0x3a3018) : st === 'ok' ? 0x1a2440 : 0x10142a, 1).fillRoundedRect(-74, -46, 148, 92, 14);
        bg.lineStyle(on || st === 'ok' ? 3 : 2, n.skill && st !== 'locked' ? (on ? 0xffc84a : 0xc890ff) : edge, 1).strokeRoundedRect(-74, -46, 148, 92, 14);
        if (ult && st !== 'locked') {
          const glow = scene.add.circle(0, 0, 70, n.skill ? 0xc890ff : 0xffd27a, on ? 0.18 : 0.08).setBlendMode(Phaser.BlendModes.ADD);
          box.add(glow);
          scene.tweens.add({ targets: glow, alpha: on ? 0.06 : 0.02, duration: 1000, yoyo: true, repeat: -1 });
        }
        box.add(bg);
        const nameCol = on ? '#ffe6a0' : st === 'ok' ? '#ffffff' : '#5a6380';
        box.add(scene.add.text(0, -24, `${n.skill ? '★ ' : ''}${n.name}`, { fontFamily: UI_FONT, fontSize: n.name.length > 4 ? '18px' : '20px', fontStyle: '700', color: nameCol }).setOrigin(0.5));
        box.add(scene.add.text(0, 2, nodeDesc(n, rank || 1), { fontFamily: UI_FONT, fontSize: '13px', color: on ? '#ffd27a' : st === 'ok' ? '#9fe8c0' : '#4a5378', align: 'center', wordWrap: { width: 140, useAdvancedWrap: true } }).setOrigin(0.5));
        // 等級點點
        const pips = add(scene.add.graphics());
        pips.setPosition(x, y + 30);
        for (let k = 0; k < n.maxRank; k++) {
          const px = (k - (n.maxRank - 1) / 2) * 16;
          pips.fillStyle(k < rank ? 0xffd27a : 0x2a3050, 1).fillCircle(px, 0, 5);
        }
        if (n.cost > 1) box.add(scene.add.text(66, -38, `${n.cost}點`, { fontFamily: UI_FONT, fontSize: '12px', color: '#8a94b8' }).setOrigin(1, 0.5));
        if (st === 'locked') box.add(scene.add.text(-64, -36, '🔒', { fontFamily: UI_FONT, fontSize: '14px' }).setOrigin(0.5));
        if (selNode === n.id) {
          const sel = add(scene.add.graphics());
          sel.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(x - 78, y - 50, 156, 100, 16);
        }
        box.setSize(148, 92).setInteractive({ useHandCursor: true });
        onTap(box, () => {
          if (selNode !== n.id) {
            selNode = n.id;
            SFX.uiTap();
            render();
            const next = Math.min(n.maxRank, rank + 1);
            const eff = n.skill ? `主動技能：${SKILLS[n.skill]?.name ?? n.name}` : effectText(n.effect, next);
            const why = st === 'locked' ? `\n${missingText(s, who, n)}` : st === 'points' ? `\n技能點不夠（要 ${n.cost} 點）` : st === 'maxed' ? '\n已經滿級' : `\n再點一次學習（${n.cost} 點）`;
            hint(`${n.name}${n.maxRank > 1 ? ` Lv${next}/${n.maxRank}` : ''}：${eff}${why}`, st === 'ok' ? '#c8f0ff' : '#ffb0a0', 3200);
            return;
          }
          if (learn(s, who, n.id)) {
            SFX.levelUp();
            sparks(scene, x, y, n.skill ? 40 : 18, 'spark', n.skill ? 0xc890ff : 0xffd27a);
            session.save();
            render();
            const r = rankOf(s, who, n.id);
            hint(n.skill ? `學會主動技能「${n.name}」！戰鬥的技能選單裡可以用。` : `${n.name}${n.maxRank > 1 ? ` Lv${r}` : ''}：${effectText(n.effect, r)}`, '#ffe6a0');
            return;
          }
          SFX.uiCancel();
          pressBounce(scene, box);
          if (st === 'maxed') hint(`${n.name} 已經滿級`, '#ffe6a0');
          else if (st === 'locked') hint(missingText(s, who, n));
          else if (st === 'points') hint(`技能點不夠（要 ${n.cost} 點）——升級或首殺 Boss 都會給`);
        });
      }
      if (have.length === 0) add(scene.add.text(GAME_WIDTH / 2, 1124, '點節點看說明，再點一次學習。越深越強，最底下是主動技能。', { fontFamily: UI_FONT, fontSize: '19px', color: '#6a7398' }).setOrigin(0.5));
    };

    let hintT: Phaser.GameObjects.Text | undefined;
    const hint = (msg: string, color = '#ff9a9a', hold = 1600): void => {
      if (!msg) return;
      hintT?.destroy();
      const h = scene.add.text(GAME_WIDTH / 2, 1124, msg, { fontFamily: UI_FONT, fontSize: '21px', color, stroke: '#000', strokeThickness: 4, align: 'center', wordWrap: { width: GAME_WIDTH - 90, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(depth + 1);
      hintT = h;
      scene.tweens.add({ targets: h, alpha: 0, delay: hold, duration: 400, onComplete: () => h.destroy() });
    };

    const renderGear = (): void => {
      memberChips();
      // 數值
      const st = memberStats(s, who);
      const sy = 350;
      add(scene.add.text(60, sy, `Lv ${st.level}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0, 0.5));
      ([['HP', 'hp'], ['ATK', 'atk'], ['DEF', 'def'], ['SPD', 'spd']] as const).forEach(([l, k], i) => {
        const x = 190 + i * 120;
        const b = st.bonus[k];
        add(scene.add.text(x, sy - 14, l, { fontFamily: UI_FONT, fontSize: '16px', color: '#8a94b8' }).setOrigin(0, 0.5));
        add(scene.add.text(x, sy + 12, `${st.base[k] + b}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffffff' }).setOrigin(0, 0.5));
        if (b) add(scene.add.text(x + 56, sy + 14, `${b > 0 ? '+' : ''}${b}`, { fontFamily: UI_FONT, fontSize: '16px', color: b > 0 ? '#7dffb0' : '#ff9a9a' }).setOrigin(0, 0.5));
      });
      // 欄位
      const eq = s.members[who]?.equipment ?? {};
      SLOTS.forEach((sl, i) => {
        const y = 440 + i * 96;
        const id = eq[sl];
        const on = slot === sl;
        const row = add(scene.add.container(GAME_WIDTH / 2, y));
        const bg = scene.add.graphics();
        bg.fillStyle(on ? 0x2a2f52 : 0x151a30, 1).fillRoundedRect(-310, -42, 620, 84, 14);
        bg.lineStyle(on ? 3 : 1.5, on ? 0xffd27a : 0x4a5380, 1).strokeRoundedRect(-310, -42, 620, 84, 14);
        row.add(bg);
        row.add(scene.add.text(-290, 0, SLOT_NAME[sl], { fontFamily: UI_FONT, fontSize: '20px', color: '#8a94b8' }).setOrigin(0, 0.5));
        if (id) {
          row.add(itemIcon(scene, id, -186, 0, 62));
          row.add(scene.add.text(-146, -15, itemDef(id).name, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: itemNameColor(id) }).setOrigin(0, 0.5));
          row.add(scene.add.text(-146, 17, bonusText(itemDef(id).bonus) + (itemDef(id).perk ? `　✦${PERK_INFO[itemDef(id).perk!].name}` : ''), { fontFamily: UI_FONT, fontSize: '18px', color: '#7dffb0' }).setOrigin(0, 0.5));
        } else row.add(scene.add.text(-186, 0, '（空）', { fontFamily: UI_FONT, fontSize: '22px', color: '#4a5378' }).setOrigin(0, 0.5));
        const n = candidates(sl).length;
        row.add(scene.add.text(296, 0, n ? `可換 ${n} ▸` : '▸', { fontFamily: UI_FONT, fontSize: '20px', color: n ? '#ffd27a' : '#4a5378' }).setOrigin(1, 0.5));
        row.setSize(620, 84).setInteractive({ useHandCursor: true });
        onTap(row, () => {
          slot = on ? null : sl;
          page = 0;
          SFX.uiTap();
          render();
        });
      });
      // 候選清單
      const ly = 740;
      if (!slot) {
        add(scene.add.text(GAME_WIDTH / 2, ly + 120, '點欄位，從行囊挑一件換上。\n錢不夠？去打怪、開寶箱，或把用不到的賣掉。', { fontFamily: UI_FONT, fontSize: '21px', color: '#6a7398', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
        return;
      }
      const sl = slot;
      const opts: (string | null)[] = [...candidates(sl), ...(eq[sl] ? [null] : [])];
      if (opts.length === 0) {
        add(scene.add.text(GAME_WIDTH / 2, ly + 120, `行囊裡沒有${withNames(heroName(who))}能用的${SLOT_NAME[sl]}。`, { fontFamily: UI_FONT, fontSize: '22px', color: '#6a7398' }).setOrigin(0.5));
        return;
      }
      const per = 4;
      const pages = Math.ceil(opts.length / per);
      page = Math.min(page, pages - 1);
      opts.slice(page * per, page * per + per).forEach((id, i) => {
        const y = ly + i * 84 + 40;
        const row = add(scene.add.container(GAME_WIDTH / 2, y));
        const bg = scene.add.graphics();
        bg.fillStyle(0x10142a, 1).fillRoundedRect(-290, -36, 580, 72, 12);
        bg.lineStyle(1.5, 0x3a4270, 1).strokeRoundedRect(-290, -36, 580, 72, 12);
        row.add(bg);
        if (id) {
          const dt = gearDelta(s, who, id);
          const good = deltaScore(dt) > 0;
          row.add(itemIcon(scene, id, -250, 0, 54));
          row.add(scene.add.text(-212, -13, `${itemDef(id).name} ×${s.inventory[id] ?? 0}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: itemNameColor(id) }).setOrigin(0, 0.5));
          row.add(scene.add.text(-212, 16, bonusText(itemDef(id).bonus), { fontFamily: UI_FONT, fontSize: '16px', color: '#9aa4cc' }).setOrigin(0, 0.5));
          row.add(scene.add.text(276, 0, deltaText(dt) || '一樣', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: good ? '#7dffb0' : '#ff9a9a' }).setOrigin(1, 0.5));
        } else row.add(scene.add.text(0, 0, `卸下${SLOT_NAME[sl]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffb0a0' }).setOrigin(0.5));
        row.setSize(580, 72).setInteractive({ useHandCursor: true });
        onTap(row, () => {
          if (id) equip(s, who, id);
          else unequip(s, who, sl);
          SFX.confirm();
          pressBounce(scene, row);
          sparks(scene, GAME_WIDTH / 2, 440 + SLOTS.indexOf(sl) * 96, 12, 'spark', 0x7dffb0);
          slot = null;
          session.save();
          render();
        });
      });
      if (pages > 1) pager(ly + per * 84 + 30, pages);
    };

    const candidates = (sl: Slot): string[] =>
      Object.keys(s.inventory).filter((id) => (s.inventory[id] ?? 0) > 0 && itemDef(id).slot === sl && canEquip(who, itemDef(id)));

    const pager = (y: number, pages: number): void => {
      add(scene.add.text(GAME_WIDTH / 2, y, `${page + 1} / ${pages}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#aab4dd' }).setOrigin(0.5));
      ([[-110, '◀', -1], [110, '▶', 1]] as const).forEach(([dx, l, dir]) => {
        const b = add(scene.add.text(GAME_WIDTH / 2 + dx, y, l, { fontFamily: UI_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setPadding(20, 6, 20, 6).setInteractive({ useHandCursor: true }));
        onTap(b, () => {
          page = (page + dir + pages) % pages;
          SFX.uiTap();
          render();
        });
      });
    };

    // 收藏（§2.4b）：稀有／神級寶物一覽，未取得顯示剪影與掉落來源
    const renderCodex = (): void => {
      const all = Object.values(ITEM_DEFS).filter((d) => (d.rarity ?? 'common') !== 'common')
        .sort((a, b) => (a.rarity === b.rarity ? 0 : a.rarity === 'legendary' ? 1 : -1));
      const got = (id: string) => !!s.flags[`seen_${id}`] || owns(s, id);
      const n = all.filter((d) => got(d.id)).length;
      add(scene.add.text(GAME_WIDTH / 2, 250, `寶物收藏　${n} / ${all.length}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffe6a0' }).setOrigin(0.5));
      const per = 9;
      const pages = Math.ceil(all.length / per);
      page = Math.min(page, pages - 1);
      all.slice(page * per, page * per + per).forEach((d, i) => {
        const y = 320 + i * 88;
        const have = got(d.id);
        const rar = d.rarity ?? 'common';
        const bg = add(scene.add.graphics());
        bg.fillStyle(0x151a30, 1).fillRoundedRect(50, y - 38, GAME_WIDTH - 100, 76, 14);
        bg.lineStyle(1.5, RARITY_COLOR[rar], have ? 0.8 : 0.25).strokeRoundedRect(50, y - 38, GAME_WIDTH - 100, 76, 14);
        if (have) for (const o of itemIcon(scene, d.id, 96, y, 56)) add(o);
        else {
          add(scene.add.circle(96, y, 26, 0x0a0d1a, 1).setStrokeStyle(2, RARITY_COLOR[rar], 0.3));
          // 未取得：物品圖示的黑色剪影（沒有圖就畫問號）
          if (d.icon && scene.textures.exists(d.icon)) {
            const img = add(scene.add.image(96, y, d.icon));
            img.setScale(46 / Math.max(img.width, img.height)).setTintFill(0x232a44);
          } else add(scene.add.text(96, y, '?', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#3a4366' }).setOrigin(0.5));
        }
        add(scene.add.text(140, y - 15, have ? d.name : '？？？', { fontFamily: UI_FONT, fontSize: '23px', fontStyle: '700', color: have ? itemNameColor(d.id) : '#4a5378' }).setOrigin(0, 0.5));
        const sub = have ? itemSubline(d) : `掉落自：${d.source ?? '？？？'}`;
        add(scene.add.text(140, y + 16, sub, { fontFamily: UI_FONT, fontSize: '17px', color: have ? '#9aa4cc' : '#5a6380' }).setOrigin(0, 0.5));
        add(scene.add.text(GAME_WIDTH - 70, y - 15, RARITY_NAME[rar], { fontFamily: UI_FONT, fontSize: '18px', color: RARITY_CSS[rar] }).setOrigin(1, 0.5).setAlpha(have ? 1 : 0.5));
      });
      if (pages > 1) pager(320 + per * 88, pages);
    };

    const renderItems = (): void => {
      const order = { use: 0, gear: 1, gift: 2, key: 3 } as const;
      const ids = Object.keys(s.inventory).filter((id) => (s.inventory[id] ?? 0) > 0)
        .sort((a, b) => order[itemDef(a).kind] - order[itemDef(b).kind]);
      if (ids.length === 0) {
        add(scene.add.text(GAME_WIDTH / 2, 500, '行囊空空的。', { fontFamily: UI_FONT, fontSize: '24px', color: '#6a7398' }).setOrigin(0.5));
        return;
      }
      const per = 9;
      const pages = Math.ceil(ids.length / per);
      page = Math.min(page, pages - 1);
      ids.slice(page * per, page * per + per).forEach((id, i) => {
        const d = itemDef(id);
        const y = 270 + i * 92;
        const bg = add(scene.add.graphics());
        bg.fillStyle(0x151a30, 1).fillRoundedRect(50, y - 40, GAME_WIDTH - 100, 80, 14);
        for (const o of itemIcon(scene, id, 96, y, 60)) add(o);
        add(scene.add.text(140, y - 16, `${d.name}　×${s.inventory[id]}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: d.kind === 'key' ? '#ffe08a' : itemNameColor(id) }).setOrigin(0, 0.5));
        add(scene.add.text(140, y + 17, d.kind === 'gear' ? itemSubline(d) : d.desc, { fontFamily: UI_FONT, fontSize: '18px', color: '#9aa4cc' }).setOrigin(0, 0.5));
        const tag = d.kind === 'use' ? '戰鬥用' : d.kind === 'gear' ? SLOT_NAME[d.slot!] : d.kind === 'gift' ? '禮物' : '重要';
        add(scene.add.text(GAME_WIDTH - 70, y, tag, { fontFamily: UI_FONT, fontSize: '18px', color: '#7a84a8' }).setOrigin(1, 0.5));
      });
      if (pages > 1) pager(270 + per * 92, pages);
    };

    (Object.keys(tabs) as Tab[]).forEach((t) => onTap(tabs[t], () => {
      if (tab === t) return;
      tab = t;
      page = 0;
      slot = null;
      SFX.uiTap();
      render();
    }));
    const close = scene.add.text(GAME_WIDTH / 2, 1172, '關閉', { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#aab4dd' })
      .setOrigin(0.5).setPadding(40, 8, 40, 8).setInteractive({ useHandCursor: true });
    onTap(close, () => {
      SFX.uiCancel();
      session.save();
      ui.destroy();
      resolve();
    });
    ui.add(close);
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 180 });
    render();
  });
}
