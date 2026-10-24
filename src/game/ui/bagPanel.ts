// 背包選單（探索中 ☰）：裝備（選角色 → 選欄位 → 換裝）、道具一覽。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS } from '../../core/battle/skills';
import { canEquip, gearDelta, owns } from '../../core/state/equip';
import { bagCount, bagIds, wornIds, type EquipmentInstance } from '../../core/state/gear';
import { BLESSING_MAX, MAX_ENHANCE, failText } from '../../data/enhancement';
import { preview } from '../../server/enhancement';
import { canSalvage, salvageYield } from '../../server/crafting';
import type { MemberId } from '../../core/state/gameState';
import { EQUIP_SLOT_NAME, ITEM_DEFS, PERK_INFO, RARITY_COLOR, RARITY_CSS, RARITY_NAME, SLOT_NAME, itemDef } from '../../data/equipment';
import { EQUIP_SLOTS, slotType, type EquipSlot } from '../../data/rules';
import { TREE_BY_ID, branchName, effectText, type TreeNode } from '../../data/skillTree';
import { bossPoints, branchPoints, learn, learnState, learned, missingText, nodeDesc, pointsLeft, rankOf, resetCost, treeFor } from '../../core/state/skillTree';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText, pressBounce, shockRing, sparks } from '../fx/feel';
import { gameApi, opId, session, withNames } from '../session';
import { HERO_COLOR } from './partyPanel';
import { bonusText, deltaScore, deltaText, heroName, instBonus, instName, itemIcon, itemSubline, memberStats, itemNameColor } from './gearUi';

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
    let slot: EquipSlot | null = null;
    let page = 0;
    /** 技能樹：第一次點選取（看說明），再點一次才學 */
    let selNode: string | null = null;
    /** 道具頁：選取的裝備模板；armed：二次確認中的分解（'quick' 或 'one:<模板>'） */
    let selItem: string | null = null;
    let armed: string | null = null;
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
          if (!gameApi.resetTree(opId('resetTree'), { member: who, atCamp }).ok) {
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
      // 欄位（6 格：武器、防具、頭飾、飾品 ×2、星燼核心；design/14 階段 2.2）
      const ROW0 = 412;
      const RH = 62;
      const wornInst = (sl: EquipSlot): EquipmentInstance | undefined => {
        const iid = s.members[who]?.equipment[sl];
        return iid ? s.gear[iid] : undefined;
      };
      EQUIP_SLOTS.forEach((sl, i) => {
        const y = ROW0 + i * RH;
        const inst = wornInst(sl);
        const id = inst?.templateId;
        const on = slot === sl;
        const row = add(scene.add.container(GAME_WIDTH / 2, y));
        const bg = scene.add.graphics();
        bg.fillStyle(on ? 0x2a2f52 : 0x151a30, 1).fillRoundedRect(-310, -28, 620, 56, 12);
        bg.lineStyle(on ? 3 : 1.5, on ? 0xffd27a : 0x4a5380, 1).strokeRoundedRect(-310, -28, 620, 56, 12);
        row.add(bg);
        row.add(scene.add.text(-292, 0, EQUIP_SLOT_NAME[sl], { fontFamily: UI_FONT, fontSize: '18px', color: '#8a94b8' }).setOrigin(0, 0.5));
        if (inst && id) {
          row.add(itemIcon(scene, id, -170, 0, 44));
          const nm = row.add(scene.add.text(-140, -11, itemDef(id).name, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: itemNameColor(id) }).setOrigin(0, 0.5));
          if (inst.enhancement > 0) {
            const nt = nm.list[nm.list.length - 1] as Phaser.GameObjects.Text;
            row.add(scene.add.text(-140 + nt.width + 6, -11, `+${inst.enhancement}`, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '900', color: inst.enhancement >= 6 ? '#ffb347' : '#ffe6a0', stroke: '#3a2a08', strokeThickness: 3 }).setOrigin(0, 0.5));
          }
          row.add(scene.add.text(-140, 13, bonusText(instBonus(inst)) + (itemDef(id).perk ? `　✦${PERK_INFO[itemDef(id).perk!].name}` : ''), { fontFamily: UI_FONT, fontSize: '15px', color: '#7dffb0' }).setOrigin(0, 0.5));
        } else row.add(scene.add.text(-170, 0, '（空）', { fontFamily: UI_FONT, fontSize: '19px', color: '#4a5378' }).setOrigin(0, 0.5));
        const n = candidates(sl).reduce((a, c) => a + c.count, 0);
        row.add(scene.add.text(296, 0, n ? `可換 ${n} ▸` : inst ? '強化 ▸' : '▸', { fontFamily: UI_FONT, fontSize: '18px', color: n || inst ? '#ffd27a' : '#4a5378' }).setOrigin(1, 0.5));
        row.setSize(620, 56).setInteractive({ useHandCursor: true });
        onTap(row, () => {
          slot = on ? null : sl;
          page = 0;
          SFX.uiTap();
          render();
        });
      });
      // 候選清單
      let ly = ROW0 + EQUIP_SLOTS.length * RH + 6;
      if (!slot) {
        add(scene.add.text(GAME_WIDTH / 2, ly + 110, '點欄位：換裝，或強化身上這件。\n材料（星燼粉塵）打怪會掉，也能分解用不到的裝備。', { fontFamily: UI_FONT, fontSize: '20px', color: '#6a7398', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
        return;
      }
      const sl = slot;
      const cur = wornInst(sl);
      if (cur) {
        enhanceBar(cur, ly, ROW0 + EQUIP_SLOTS.indexOf(sl) * RH);
        ly += 104;
      }
      const opts: (Candidate | null)[] = [...candidates(sl), ...(cur ? [null] : [])];
      if (opts.length === 0) {
        add(scene.add.text(GAME_WIDTH / 2, ly + 90, slotType(sl) === 'head' || slotType(sl) === 'core' ? `${EQUIP_SLOT_NAME[sl]}會在星燼深淵掉落（即將開放）。` : `行囊裡沒有${withNames(heroName(who))}能用的${EQUIP_SLOT_NAME[sl]}。`, { fontFamily: UI_FONT, fontSize: '22px', color: '#6a7398' }).setOrigin(0.5));
        return;
      }
      const per = cur ? 2 : 3;
      const pages = Math.ceil(opts.length / per);
      page = Math.min(page, pages - 1);
      opts.slice(page * per, page * per + per).forEach((c, i) => {
        const y = ly + i * 84 + 40;
        const row = add(scene.add.container(GAME_WIDTH / 2, y));
        const bg = scene.add.graphics();
        bg.fillStyle(0x10142a, 1).fillRoundedRect(-290, -36, 580, 72, 12);
        bg.lineStyle(1.5, 0x3a4270, 1).strokeRoundedRect(-290, -36, 580, 72, 12);
        row.add(bg);
        if (c) {
          const dt = gearDelta(s, who, c.ref, sl);
          const good = deltaScore(dt) > 0;
          row.add(itemIcon(scene, c.templateId, -250, 0, 54));
          row.add(scene.add.text(-212, -13, `${instName(c.inst)}${c.count > 1 ? ` ×${c.count}` : ''}${c.inst.locked ? ' 🔒' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: itemNameColor(c.templateId) }).setOrigin(0, 0.5));
          row.add(scene.add.text(-212, 16, bonusText(instBonus(c.inst)), { fontFamily: UI_FONT, fontSize: '16px', color: '#9aa4cc' }).setOrigin(0, 0.5));
          row.add(scene.add.text(276, 0, deltaText(dt) || '一樣', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: good ? '#7dffb0' : '#ff9a9a' }).setOrigin(1, 0.5));
        } else row.add(scene.add.text(0, 0, `卸下${EQUIP_SLOT_NAME[sl]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffb0a0' }).setOrigin(0.5));
        row.setSize(580, 72).setInteractive({ useHandCursor: true });
        onTap(row, () => {
          if (c) gameApi.equip(opId('equip'), { member: who, ref: c.ref, slot: sl });
          else gameApi.unequip(opId('unequip'), { member: who, slot: sl });
          SFX.confirm();
          pressBounce(scene, row);
          sparks(scene, GAME_WIDTH / 2, ROW0 + EQUIP_SLOTS.indexOf(sl) * RH, 12, 'spark', 0x7dffb0);
          slot = null;
          session.save();
          render();
        });
      });
      if (pages > 1) pager(ly + per * 84 + 30, pages);
    };

    /** 強化列（design/14 階段 2.4 UI）：成功率、失敗後果、祝福、費用都直接顯示 */
    const enhanceBar = (inst: EquipmentInstance, y0: number, rowY: number): void => {
      const box = add(scene.add.graphics());
      box.fillStyle(0x1c1a10, 1).fillRoundedRect(40, y0, GAME_WIDTH - 80, 96, 14);
      box.lineStyle(2, 0xb08a3a, 0.9).strokeRoundedRect(40, y0, GAME_WIDTH - 80, 96, 14);
      const pv = preview(inst);
      if (!pv) {
        add(scene.add.text(GAME_WIDTH / 2, y0 + 48, `已強化到 +${MAX_ENHANCE}（最高）`, { fontFamily: TITLE_FONT, fontSize: '26px', color: '#ffd05a' }).setOrigin(0.5));
        return;
      }
      const { step, chance, blessing } = pv;
      const pct = Math.round(chance * 100);
      add(scene.add.text(62, y0 + 22, `強化 +${inst.enhancement} → +${step.to}`, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: '#ffe6a0' }).setOrigin(0, 0.5));
      add(scene.add.text(268, y0 + 22, `成功率 ${pct}%`, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: pct >= 100 ? '#7dffb0' : pct >= 50 ? '#ffe6a0' : '#ffb0a0' }).setOrigin(0, 0.5));
      const sub = step.chance >= 1 ? `數值 +${step.statPct}%（基礎值）` : `${failText(step).replace('失敗：', '失敗會')}　祝福 ${blessing}/${BLESSING_MAX}`;
      add(scene.add.text(62, y0 + 50, sub, { fontFamily: UI_FONT, fontSize: '15px', color: '#b8a878' }).setOrigin(0, 0.5));
      const costGold = step.cost.gold;
      const mats = Object.fromEntries(Object.entries(step.cost).filter(([k]) => k !== 'gold'));
      const parts: string[] = [`◎${costGold}`];
      let afford = s.gold >= costGold;
      for (const [m, n] of Object.entries(mats)) {
        if (!n) continue;
        const have = s.inventory[m] ?? 0;
        if (have < n) afford = false;
        parts.push(`${itemDef(m).name.replace('星燼', '')} ${n}（有 ${have}）`);
      }
      add(scene.add.text(62, y0 + 76, parts.join('　'), { fontFamily: UI_FONT, fontSize: '15px', color: afford ? '#d8d0b0' : '#ff9a9a' }).setOrigin(0, 0.5));
      // 祝福條（只有會失敗的階段）
      if (step.chance < 1) {
        const bar = add(scene.add.graphics());
        bar.fillStyle(0x2a2410, 1).fillRoundedRect(440, y0 + 46, 120, 8, 4);
        bar.fillStyle(0xffd05a, 1).fillRoundedRect(440, y0 + 46, Math.max(4, 120 * (blessing / BLESSING_MAX)), 8, 4);
      }
      const btn = add(scene.add.container(GAME_WIDTH - 110, y0 + 48));
      const bb = scene.add.graphics();
      bb.fillStyle(afford ? 0x6a4a10 : 0x2a2a30, 1).fillRoundedRect(-58, -32, 116, 64, 14);
      bb.lineStyle(2.5, afford ? 0xffd05a : 0x4a4a58, 1).strokeRoundedRect(-58, -32, 116, 64, 14);
      btn.add(bb);
      btn.add(scene.add.text(0, 0, '強化', { fontFamily: TITLE_FONT, fontSize: '28px', color: afford ? '#fff4d0' : '#6a6a78' }).setOrigin(0.5));
      btn.setSize(116, 64).setInteractive({ useHandCursor: true });
      if (afford) scene.tweens.add({ targets: btn, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      onTap(btn, () => {
        const r = gameApi.enhance(opId('enhance'), { instanceId: inst.instanceId });
        if (!r.ok || !r.data) {
          SFX.uiCancel();
          pressBounce(scene, btn);
          hint(r.error === 'not_enough_gold' ? '金幣不夠' : r.error === 'not_enough_materials' ? '材料不夠——打怪會掉粉塵，Boss 會掉結晶；也可以到「道具」分解用不到的裝備' : '現在不能強化');
          return;
        }
        session.save();
        render();
        enhanceFx(r.data.success, r.data.level, rowY, r.data.guaranteed);
      });
    };

    /** 強化演出：成功＝金光＋音階上升；失敗＝灰煙（祝福條增加） */
    const enhanceFx = (ok: boolean, level: number, rowY: number, guaranteed: boolean): void => {
      const x = GAME_WIDTH / 2;
      if (ok) {
        SFX.enhanceUp(level);
        const flash = scene.add.rectangle(x, rowY, 640, 70, 0xffd05a, 0.75).setDepth(depth + 2).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: flash, alpha: 0, scaleY: 2.2, duration: 520, ease: 'Cubic.Out', onComplete: () => flash.destroy() });
        sparks(scene, x - 140, rowY, 26, 'spark', 0xffd05a, 520);
        shockRing(scene, x - 140, rowY, 0xffd05a, 140, 420, 6);
        bigText(scene, x, rowY - 70, guaranteed ? `祝福加持！+${level}` : `+${level} 成功！`, '#ffd05a', level >= 6 ? 52 : 44, 520);
        if (level >= 6) scene.cameras.main.shake(180, 0.004);
      } else {
        SFX.enhanceFail();
        const p = scene.add.particles(x - 140, rowY, 'spark', {
          speed: { min: 20, max: 90 }, angle: { min: 230, max: 310 }, scale: { start: 1.6, end: 3.2 }, alpha: { start: 0.55, end: 0 },
          lifespan: 900, tint: 0x8a8a96, emitting: false,
        }).setDepth(depth + 2);
        p.explode(18);
        scene.time.delayedCall(1000, () => p.destroy());
        bigText(scene, x, rowY - 70, '失敗…', '#a8a8b8', 40, 420);
        hint(`沒成功——現在 +${level}。星之祝福增加了，滿 ${BLESSING_MAX} 下次必定成功。`, '#d8d0b0', 2200);
      }
    };

    interface Candidate { ref: string; templateId: string; inst: EquipmentInstance; count: number }
    /** 背包裡這格能換的：同模板、同強化等級的實例合併成一列 */
    const candidates = (sl: EquipSlot): Candidate[] => {
      const worn = wornIds(s);
      const groups = new Map<string, Candidate>();
      const list = Object.values(s.gear)
        .filter((g) => !worn.has(g.instanceId) && itemDef(g.templateId).slot === slotType(sl) && canEquip(who, itemDef(g.templateId)))
        .sort((a, b) => b.enhancement - a.enhancement || (a.instanceId < b.instanceId ? -1 : 1));
      for (const g of list) {
        const key = `${g.templateId}+${g.enhancement}`;
        const c = groups.get(key);
        if (c) c.count++;
        else groups.set(key, { ref: g.instanceId, templateId: g.templateId, inst: g, count: 1 });
      }
      return [...groups.values()];
    };

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

    /** 背包裡（沒穿、可分解）的實例 */
    const freeOf = (templateId: string): EquipmentInstance[] => {
      const worn = wornIds(s);
      return Object.values(s.gear).filter((g) => g.templateId === templateId && !worn.has(g.instanceId))
        .sort((a, b) => a.enhancement - b.enhancement || (a.instanceId < b.instanceId ? -1 : 1));
    };
    /** 一鍵分解的範圍：普通裝備、沒強化、沒上鎖、沒穿；劇情寶物（稀有／神級模板）不會被動到 */
    const quickPool = (): EquipmentInstance[] => {
      const worn = wornIds(s);
      return Object.values(s.gear).filter((g) => canSalvage(g, worn, true) && (itemDef(g.templateId).rarity ?? 'common') === 'common' && g.enhancement === 0);
    };
    const yieldText = (list: EquipmentInstance[]): string => {
      const tot: Record<string, number> = {};
      for (const g of list) for (const [m, n] of Object.entries(salvageYield(g))) tot[m] = (tot[m] ?? 0) + (n ?? 0);
      return Object.entries(tot).filter(([, n]) => n > 0).map(([m, n]) => `${itemDef(m).name} ×${n}`).join('、');
    };
    const doSalvage = (list: EquipmentInstance[], quick: boolean, fxY: number): void => {
      const r = gameApi.salvage(opId('salvage'), { instanceIds: list.map((g) => g.instanceId), quick });
      if (!r.ok || !r.data) {
        SFX.uiCancel();
        hint('沒有可以分解的裝備');
        return;
      }
      SFX.salvage();
      sparks(scene, GAME_WIDTH / 2, fxY, 22, 'spark', 0x9ad8ff, 420);
      session.save();
      armed = null;
      selItem = null;
      render();
      hint(`分解了 ${r.data.salvaged} 件：得到 ${Object.entries(r.data.materials).map(([m, n]) => `${itemDef(m).name} ×${n}`).join('、')}`, '#9ad8ff', 2200);
    };

    const renderItems = (): void => {
      // 上方：材料存量＋一鍵分解
      const dust = s.inventory.mat_dust ?? 0;
      const crystal = s.inventory.mat_crystal ?? 0;
      add(scene.add.text(60, 252, `◆ 粉塵 ${dust}　◇ 結晶 ${crystal}`, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#9ad8ff' }).setOrigin(0, 0.5));
      const qp = quickPool();
      const qArmed = armed === 'quick';
      const qb = add(scene.add.text(GAME_WIDTH - 56, 252, qArmed ? `確認分解 ${qp.length} 件` : `一鍵分解${qp.length ? `（${qp.length}）` : ''}`, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: qp.length ? (qArmed ? '#ffffff' : '#ffb0a0') : '#4a5378', backgroundColor: qArmed ? '#8a2a2a' : undefined }).setOrigin(1, 0.5).setPadding(12, 6, 12, 6).setInteractive({ useHandCursor: true }));
      onTap(qb, () => {
        if (qp.length === 0) {
          SFX.uiCancel();
          hint('沒有可以一鍵分解的裝備（只會分解普通、未強化、未上鎖、沒穿著的）', '#aab4dd', 2400);
          return;
        }
        if (!qArmed) {
          armed = 'quick';
          selItem = null;
          SFX.uiTap();
          render();
          hint(`分解 ${qp.length} 件普通裝備 → ${yieldText(qp)}\n再點一次確認。上鎖、強化過、穿著的與寶物不會被分解。`, '#ffe6a0', 3200);
          return;
        }
        doSalvage(qp, true, 252);
      });
      const order = { use: 0, gear: 1, mat: 2, gift: 3, key: 4 } as const;
      const ids = bagIds(s)
        .sort((a, b) => order[itemDef(a).kind] - order[itemDef(b).kind]);
      if (ids.length === 0) {
        add(scene.add.text(GAME_WIDTH / 2, 500, '行囊空空的。', { fontFamily: UI_FONT, fontSize: '24px', color: '#6a7398' }).setOrigin(0.5));
        return;
      }
      const per = 8;
      const Y0 = 330;
      const pages = Math.ceil(ids.length / per);
      page = Math.min(page, pages - 1);
      ids.slice(page * per, page * per + per).forEach((id, i) => {
        const d = itemDef(id);
        const y = Y0 + i * 92;
        const isGear = d.kind === 'gear';
        const sel = isGear && selItem === id;
        const bg = add(scene.add.graphics());
        bg.fillStyle(sel ? 0x232a4a : 0x151a30, 1).fillRoundedRect(50, y - 40, GAME_WIDTH - 100, 80, 14);
        if (sel) bg.lineStyle(2, 0xffd27a, 0.9).strokeRoundedRect(50, y - 40, GAME_WIDTH - 100, 80, 14);
        for (const o of itemIcon(scene, id, 96, y, 60)) add(o);
        const free = isGear ? freeOf(id) : [];
        const maxEnh = free.reduce((m, g) => Math.max(m, g.enhancement), 0);
        const allLocked = free.length > 0 && free.every((g) => g.locked);
        add(scene.add.text(140, y - 16, `${d.name}　×${bagCount(s, id)}${maxEnh > 0 ? `（最高 +${maxEnh}）` : ''}${allLocked ? ' 🔒' : ''}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: d.kind === 'key' ? '#ffe08a' : itemNameColor(id) }).setOrigin(0, 0.5));
        add(scene.add.text(140, y + 17, isGear ? itemSubline(d) : d.desc, { fontFamily: UI_FONT, fontSize: '18px', color: '#9aa4cc' }).setOrigin(0, 0.5));
        if (!sel) {
          const tag = d.kind === 'use' ? '戰鬥用' : isGear ? `${SLOT_NAME[d.slot!]} ▸` : d.kind === 'gift' ? '禮物' : d.kind === 'mat' ? '材料' : '重要';
          add(scene.add.text(GAME_WIDTH - 70, y, tag, { fontFamily: UI_FONT, fontSize: '18px', color: isGear ? '#aab4dd' : '#7a84a8' }).setOrigin(1, 0.5));
        }
        if (isGear) {
          const hit = add(scene.add.zone(GAME_WIDTH / 2, y, GAME_WIDTH - 100, 80).setInteractive({ useHandCursor: true }));
          onTap(hit, () => {
            selItem = sel ? null : id;
            armed = null;
            SFX.uiTap();
            render();
          });
        }
        if (sel) {
          // 選取後：分解 1 件／上鎖（整組）
          const target = free.find((g) => !g.locked);
          const canS = !!target && canSalvage(target, wornIds(s), false);
          const sArmed = armed === `one:${id}`;
          const lockAll = !allLocked;
          const lb = add(scene.add.text(GAME_WIDTH - 66, y, lockAll ? '🔒 上鎖' : '🔓 解鎖', { fontFamily: UI_FONT, fontSize: '19px', fontStyle: '700', color: '#ffe6a0', backgroundColor: '#3a3018' }).setOrigin(1, 0.5).setPadding(10, 8, 10, 8).setInteractive({ useHandCursor: true }));
          onTap(lb, () => {
            for (const g of free) if (!!g.locked !== lockAll) gameApi.setLock(opId('lock'), { instanceId: g.instanceId, locked: lockAll });
            SFX.confirm();
            session.save();
            armed = null;
            render();
            hint(lockAll ? '已上鎖：不能賣、不能分解' : '已解鎖', '#ffe6a0');
          });
          const sb = add(scene.add.text(GAME_WIDTH - 66 - lb.width - 12, y, sArmed ? '確認？' : '分解', { fontFamily: UI_FONT, fontSize: '19px', fontStyle: '700', color: canS ? '#ffffff' : '#5a6380', backgroundColor: canS ? (sArmed ? '#8a2a2a' : '#4a2a2a') : '#1a1e30' }).setOrigin(1, 0.5).setPadding(10, 8, 10, 8).setInteractive({ useHandCursor: true }));
          onTap(sb, () => {
            if (!canS || !target) {
              SFX.uiCancel();
              hint(free.length && free.every((g) => g.locked) ? '上鎖的不能分解' : '劇情用的物品不能分解');
              return;
            }
            if (!sArmed) {
              armed = `one:${id}`;
              SFX.uiTap();
              render();
              hint(`分解 1 件${instName(target)} → ${yieldText([target])}　再點一次確認`, '#ffe6a0', 2600);
              return;
            }
            doSalvage([target], false, y);
          });
        }
      });
      if (pages > 1) pager(Y0 + per * 92 - 10, pages);
    };

    (Object.keys(tabs) as Tab[]).forEach((t) => onTap(tabs[t], () => {
      if (tab === t) return;
      tab = t;
      page = 0;
      slot = null;
      selItem = null;
      armed = null;
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
