// 燼牌（07 §6，v2 五燈座對峙）。規則在 core/cards，這裡負責呈現、輸入、AI 節奏與對峙演出。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playMusic, stopMusic } from '../../audio/music';
import {
  SLOTS, applyAction, createMatch, defOf, effectivePower, legalActions, peekAction, previewNight,
  type Action, type CardInst, type MatchConfig, type MatchState, type MoonPhase,
} from '../../core/cards/engine';
import { chooseAction, chooseTutorialAction } from '../../core/cards/ai';
import { mulberry32 } from '../../core/rng';
import {
  DECK_BERN, DECK_LIORA, DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL, DECK_ROURKE_OFFICIAL_NO_LEGEND, DECK_ROURKE_TUTORIAL,
  DECK_TUTORIAL_PLAYER, type Keyword,
} from '../../data/cards';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText, pressBounce, shockRing, sparks, wait, fadeOutThen } from '../fx/feel';

export interface CardSceneData {
  match: string;
  /** 劇情：結束後 wake('Dialogue', { outcome }) */
  story?: boolean;
}

interface Opponent {
  name: string;
  config: MatchConfig;
  ai: 'tutorial' | number; // number = mistakeRate
  intro: string;
}

const OPPONENTS: Record<string, Opponent> = {
  rourke_tutorial: {
    name: '洛克', ai: 'tutorial', intro: '教學局：兩夜制。對峙時點數高的一方會「燒掉」對面的牌！',
    config: { decks: [DECK_TUTORIAL_PLAYER, DECK_ROURKE_TUTORIAL], nights: 2, fixedMoons: ['new', 'new'], firstPlayer: 0 },
  },
  rourke_official: {
    name: '洛克', ai: 0.12, intro: '正式局：三夜兩勝。',
    config: { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL], guaranteeInHand: { 1: ['c_veteran'] } },
  },
  rourke_clean: {
    name: '洛克', ai: 0.2, intro: '這次不作弊。三夜兩勝。',
    config: { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL_NO_LEGEND] },
  },
  bern: { name: '伯恩', ai: 0.2, intro: '獵人伯恩：月相會改變戰局。', config: { decks: [DECK_PLAYER_STARTER, DECK_BERN] } },
  liora_intro: {
    name: '莉歐拉', ai: 0.2, intro: '爆破師莉歐拉：月相會改變戰局——滿月點亮中央、弦月照奇數燈座、血月讓對峙更兇。',
    config: { decks: [DECK_PLAYER_STARTER, DECK_LIORA] },
  },
  demo: { name: '洛克', ai: 0.15, intro: '燼牌：三夜兩勝。', config: { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL_NO_LEGEND] } },
};

const MOON: Record<MoonPhase, [string, string]> = {
  new: ['🌑 新月', '無效果'], full: ['🌕 滿月', '中央燈座 +3'], half: ['🌓 弦月', '奇數燈座 +1'],
  blood: ['🩸 血月', '對峙較高者 +2'], fog: ['🌫 霧月', '—'], starfall: ['✦ 星雨', '—'],
};
const KW: Record<Keyword, [string, string]> = {
  light: ['點燈', '打出時左右相鄰友牌各 +1'], chain: ['連燈', '每張相鄰友牌讓自己 +1'], ember: ['餘燼', '夜結束留在原座，點數減半'],
  scorch: ['灼照', '打出時對面敵牌 −3'], ward: ['守望', '相鄰友牌不受灼照／吹熄'], snuff: ['吹熄', '打出時把對面敵牌送回手牌'],
  swap: ['換座', '—'], echo: ['回響', '被燒掉時回到手牌'], ignite: ['引火', '場上 ≥3 張時抽 1'], lone: ['孤燈', '左右無牌時 +3'],
};
const EFFECT_DESC: Record<string, string> = {
  fortune: '打出時偷看對手 3 張手牌', gust: '吹熄對手任一非傳說牌', oil: '我方一張非傳說牌 +2', moonturn: '重翻本夜月相',
  io_draw: '打出時抽 1 張', lian_rally: '我方每張點燈牌 +2',
};
const FACTION_COLOR: Record<string, number> = { townsfolk: 0xffb565, cult: 0xb46bff, neutral: 0x9fb0d8 };

const CW = 118;
const CH = 166;
const slotX = (i: number) => 76 + i * 142;
const OPP_Y = 335;
const MY_Y = 625;
const HAND_Y = 985;

export class CardScene extends Phaser.Scene {
  private st!: MatchState;
  private opp!: Opponent;
  private story = false;
  private matchId = 'demo';
  private layer!: Phaser.GameObjects.Container;
  private selected = -1;
  private busy = false;
  private rng = mulberry32(1);
  private info?: Phaser.GameObjects.Container;

  constructor() {
    super('Cards');
  }

  init(data: CardSceneData): void {
    const q = new URLSearchParams(window.location.search);
    this.matchId = data.match ?? q.get('match') ?? 'demo';
    this.opp = OPPONENTS[this.matchId] ?? OPPONENTS.demo!;
    this.story = !!data.story;
    this.selected = -1;
    this.busy = false;
    this.info = undefined;
    const seed = (Math.random() * 1e9) | 0;
    this.rng = mulberry32(seed ^ 0x5eed);
    this.st = createMatch(this.opp.config, seed).state;
  }

  create(): void {
    this.drawTable();
    this.layer = this.add.container(0, 0);
    stopMusic(0.4);
    this.time.delayedCall(500, () => playMusic('cards'));
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.render();
    this.banner(this.opp.intro, 2200);
    this.time.delayedCall(600, () => this.loop());
  }

  // ------------------------------------------------------------ 桌面
  private drawTable(): void {
    const key = 'bg_cardtable';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        const bg = c.createRadialGradient(360, 500, 50, 360, 560, 760);
        bg.addColorStop(0, '#2a1c14');
        bg.addColorStop(0.6, '#140d0a');
        bg.addColorStop(1, '#050303');
        c.fillStyle = bg;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        c.strokeStyle = 'rgba(255,190,110,0.08)';
        for (let y = 0; y < GAME_HEIGHT; y += 9) {
          c.beginPath();
          c.moveTo(0, y + Math.sin(y) * 3);
          c.lineTo(GAME_WIDTH, y + Math.cos(y) * 3);
          c.stroke();
        }
        // 對峙中線
        c.strokeStyle = 'rgba(255,210,122,0.35)';
        c.setLineDash([8, 10]);
        c.beginPath();
        c.moveTo(20, 480);
        c.lineTo(GAME_WIDTH - 20, 480);
        c.stroke();
        tex.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0);
    this.add.image(360, 480, 'glow').setScale(3.2).setTint(0xff9a4a).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
  }

  // ------------------------------------------------------------ 繪製
  private cardView(c: CardInst | null, power: number | null, opts: { burned?: boolean; glow?: boolean; small?: boolean } = {}): Phaser.GameObjects.Container {
    const box = this.add.container(0, 0);
    const w = opts.small ? 100 : CW;
    const h = opts.small ? 146 : CH;
    const g = this.add.graphics();
    if (!c) {
      g.lineStyle(2, opts.glow ? 0xffd27a : 0x4a3a2a, opts.glow ? 1 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.fillStyle(opts.glow ? 0xffd27a : 0x000000, opts.glow ? 0.15 : 0.25).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      box.add(g);
      return box;
    }
    const d = defOf(c);
    const col = d.legend ? 0xffd27a : FACTION_COLOR[d.faction] ?? 0xffffff;
    g.fillStyle(0x120e16, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(col, 0.18).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h * 0.52, 8);
    g.lineStyle(d.legend ? 4 : 3, opts.glow ? 0xffffff : col, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    // 插圖：燈火剪影
    g.fillStyle(col, 0.55).fillCircle(0, -h * 0.2, w * 0.18);
    g.fillStyle(0x120e16, 1).fillTriangle(-w * 0.22, -h * 0.02, w * 0.22, -h * 0.02, 0, -h * 0.34);
    box.add(g);
    const p = power ?? c.base;
    const pc = p > c.base ? '#7dffb0' : p < c.base ? '#ff8a8a' : '#ffffff';
    if (d.kind === 'unit') {
      box.add(this.add.text(-w / 2 + 8, -h / 2 + 2, String(p), {
        fontFamily: TITLE_FONT, fontSize: opts.small ? '34px' : '40px', fontStyle: '900', color: pc, stroke: '#000', strokeThickness: 6,
      }));
    } else {
      box.add(this.add.text(-w / 2 + 10, -h / 2 + 8, '術', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '900', color: '#9fe0ff', stroke: '#000', strokeThickness: 4 }));
    }
    if (d.legend) box.add(this.add.text(w / 2 - 8, -h / 2 + 6, '★', { fontFamily: UI_FONT, fontSize: '24px', color: '#ffd27a' }).setOrigin(1, 0));
    box.add(this.add.text(0, h * 0.14, d.name, {
      fontFamily: UI_FONT, fontSize: opts.small ? '17px' : '19px', fontStyle: '700', color: '#ffffff', align: 'center',
      wordWrap: { width: w - 10, useAdvancedWrap: true },
    }).setOrigin(0.5, 0));
    const kws = d.keywords.map((k) => KW[k]?.[0] ?? k).join('·');
    if (kws) box.add(this.add.text(0, h / 2 - 12, kws, { fontFamily: UI_FONT, fontSize: '15px', color: '#ffd27a' }).setOrigin(0.5, 1));
    if (c.persisted) box.add(this.add.text(w / 2 - 6, h / 2 - 6, '燼', { fontFamily: UI_FONT, fontSize: '16px', color: '#ff9a4a' }).setOrigin(1, 1));
    if (opts.burned) {
      const x = this.add.graphics();
      x.fillStyle(0x000000, 0.65).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      x.lineStyle(5, 0xff5a3a, 0.9).lineBetween(-w / 2 + 14, -h / 2 + 14, w / 2 - 14, h / 2 - 14);
      box.add(x);
    }
    return box;
  }

  private render(highlight?: { slots?: number[]; targets?: { side: 'me' | 'opp'; idx: number[] } }): void {
    this.tweens.killTweensOf(this.layer.list);
    this.layer.removeAll(true);
    const s = this.st;
    const [me, op] = s.sides;
    const pv = previewNight(s);
    // 對手資訊列
    const lights = (n: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, 2 - n));
    this.layer.add(this.add.text(30, 60, `${this.opp.name}  ${lights(op.nightWins)}  手牌 ${op.hand.length}${op.passed ? '  [熄燈中]' : ''}`, {
      fontFamily: UI_FONT, fontSize: '26px', color: op.passed ? '#8a90a8' : '#ffffff',
    }).setOrigin(0, 0.5));
    this.layer.add(this.add.text(GAME_WIDTH - 30, 60, `第 ${s.night}/${s.maxNights} 夜`, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffd27a' }).setOrigin(1, 0.5));
    const [mn, md] = MOON[s.moon];
    const mb = this.add.graphics();
    mb.fillStyle(0x000000, 0.45).fillRoundedRect(30, 110, GAME_WIDTH - 60, 64, 14);
    this.layer.add(mb);
    this.layer.add(this.add.text(GAME_WIDTH / 2, 142, `${mn}：${md}`, { fontFamily: UI_FONT, fontSize: '26px', color: '#dfe8ff' }).setOrigin(0.5));
    // 燈座
    for (let i = 0; i < SLOTS; i++) {
      const oc = op.board[i] ?? null;
      const mc = me.board[i] ?? null;
      const ov = this.cardView(oc, oc ? effectivePower(s, 1, i) : null, {
        glow: highlight?.targets?.side === 'opp' && highlight.targets.idx.includes(i),
      });
      ov.setPosition(slotX(i), OPP_Y);
      const mv = this.cardView(mc, mc ? effectivePower(s, 0, i) : null, {
        glow: (highlight?.slots?.includes(i) ?? false) || (highlight?.targets?.side === 'me' && highlight.targets.idx.includes(i)),
      });
      mv.setPosition(slotX(i), MY_Y);
      this.layer.add([ov, mv]);
      // 對峙指示
      const mark = !mc && !oc ? '·' : pv.burned[1][i] ? '▲' : pv.burned[0][i] ? '▼' : '＝';
      const mcol = mark === '▲' ? '#7dffb0' : mark === '▼' ? '#ff8a8a' : '#8a7a6a';
      this.layer.add(this.add.text(slotX(i), 480, mark, { fontFamily: UI_FONT, fontSize: '30px', color: mcol }).setOrigin(0.5));
      const tgtMe = highlight?.slots?.includes(i) || (highlight?.targets?.side === 'me' && highlight.targets.idx.includes(i));
      const tgtOp = highlight?.targets?.side === 'opp' && highlight.targets.idx.includes(i);
      if (tgtMe) mv.setSize(CW, CH).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onSlot(i, 'me'));
      if (tgtOp) ov.setSize(CW, CH).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onSlot(i, 'opp'));
    }
    // 比分
    const [t0, t1] = pv.totals;
    // 放牌前預覽：每個可放位置顯示「本夜分差」的變化
    if (highlight && this.selected >= 0) {
      for (const a of this.playsFor(this.selected)) {
        if (a.type !== 'play') continue;
        const idx = a.slot ?? a.target;
        if (idx === undefined) continue;
        const onOpp = a.slot === undefined && highlight.targets?.side === 'opp';
        const npv = previewNight(peekAction(s, a));
        const d = (npv.totals[0] - npv.totals[1]) - (t0 - t1);
        const label = d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0';
        const col = d > 0 ? '#7dffb0' : d < 0 ? '#ff9a8a' : '#c8c0b0';
        const y = onOpp ? OPP_Y - CH / 2 - 22 : MY_Y + CH / 2 + 22;
        const tx = this.add.text(slotX(idx), y, label, {
          fontFamily: TITLE_FONT, fontSize: '28px', fontStyle: '900', color: col, stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5);
        this.layer.add(tx);
        this.tweens.add({ targets: tx, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    }
    this.layer.add(this.add.text(GAME_WIDTH / 2, 790, `本夜　我 ${t0} : ${t1} 對手`, {
      fontFamily: TITLE_FONT, fontSize: '36px', fontStyle: '700', color: t0 > t1 ? '#7dffb0' : t0 < t1 ? '#ff9a8a' : '#ffffff',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    this.layer.add(this.add.text(30, 790, lights(me.nightWins), { fontFamily: UI_FONT, fontSize: '28px', color: '#ffd27a' }).setOrigin(0, 0.5));
    // 手牌
    const n = me.hand.length;
    const span = Math.min(126, (GAME_WIDTH - 120) / Math.max(1, n - 1));
    me.hand.forEach((c, i) => {
      const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * (n > 1 ? span : 0);
      const sel = i === this.selected;
      const v = this.cardView(c, null, { small: true, glow: sel });
      v.setPosition(x, HAND_Y - (sel ? 40 : 0)).setAngle((i - (n - 1) / 2) * 2.2).setScale(sel ? 1.12 : 1);
      v.setSize(100, 146).setInteractive({ useHandCursor: true });
      v.on('pointerdown', () => this.onHand(i));
      this.layer.add(v);
      if (sel) this.layer.bringToTop(v);
    });
    // 熄燈
    const myTurn = s.current === 0 && s.phase === 'playing' && !me.passed && !this.busy;
    const pb = this.add.container(170, 1190);
    const pg = this.add.graphics();
    pg.fillStyle(0x0a0d1a, 0.95).fillRoundedRect(-120, -42, 240, 84, 20);
    pg.lineStyle(3, myTurn ? 0xffd27a : 0x4a4a5a, 1).strokeRoundedRect(-120, -42, 240, 84, 20);
    pb.add([pg, this.add.text(0, 0, '熄燈', { fontFamily: UI_FONT, fontSize: '32px', fontStyle: '700', color: myTurn ? '#ffffff' : '#666' }).setOrigin(0.5)]);
    pb.setSize(240, 84).setInteractive({ useHandCursor: myTurn });
    pb.on('pointerdown', () => {
      if (!this.canAct()) return;
      pressBounce(this, pb);
      SFX.cardPass();
      void this.act({ type: 'pass' });
    });
    this.layer.add(pb);
    this.layer.add(this.add.text(GAME_WIDTH - 40, 1190, `牌庫 ${me.deck.length}`, { fontFamily: UI_FONT, fontSize: '24px', color: '#aab4dd' }).setOrigin(1, 0.5));
    const turn = s.phase === 'ended' ? '' : me.passed ? '你已熄燈' : s.current === 0 ? '你的回合' : `${this.opp.name} 思考中…`;
    this.layer.add(this.add.text(GAME_WIDTH / 2 + 110, 1190, turn, { fontFamily: UI_FONT, fontSize: '24px', color: s.current === 0 ? '#ffd27a' : '#aab4dd' }).setOrigin(0.5));
  }

  private canAct(): boolean {
    return !this.busy && this.st.phase === 'playing' && this.st.current === 0 && !this.st.sides[0].passed;
  }

  private showInfo(c: CardInst): void {
    this.info?.destroy();
    const d = defOf(c);
    const lines = d.keywords.map((k) => `【${KW[k]?.[0]}】${KW[k]?.[1]}`);
    if (d.effect) lines.push(EFFECT_DESC[d.effect] ?? '');
    if (d.legend) lines.push('★ 傳說：不受任何效果影響，也不會被燒');
    if (lines.length === 0) lines.push('無特殊效果');
    const box = this.add.container(GAME_WIDTH / 2, 860).setDepth(50);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.85).fillRoundedRect(-330, -36, 660, 72, 14);
    box.add([g, this.add.text(0, 0, `${d.name}：${lines.join('　')}`, {
      fontFamily: UI_FONT, fontSize: '21px', color: '#ffe6c0', align: 'center', wordWrap: { width: 640, useAdvancedWrap: true },
    }).setOrigin(0.5)]);
    this.info = box;
  }

  // ------------------------------------------------------------ 輸入
  private onHand(i: number): void {
    if (!this.canAct()) return;
    SFX.uiTap();
    if (this.selected === i) {
      // 無目標的術（轉月）：再點一次直接使用
      const acts = this.playsFor(i);
      const only = acts[0];
      if (acts.length === 1 && only && only.type === 'play' && only.slot === undefined && only.target === undefined) {
        void this.act(only);
        return;
      }
      this.selected = -1;
      this.info?.destroy();
      this.render();
      return;
    }
    this.selected = i;
    const c = this.st.sides[0].hand[i];
    if (c) this.showInfo(c);
    const acts = this.playsFor(i);
    const slots = acts.flatMap((a) => (a.type === 'play' && a.slot !== undefined ? [a.slot] : []));
    const targets = acts.flatMap((a) => (a.type === 'play' && a.target !== undefined ? [a.target] : []));
    const eff = c ? defOf(c).effect : undefined;
    this.render({ slots, targets: targets.length ? { side: eff === 'gust' ? 'opp' : 'me', idx: targets } : undefined });
  }

  private playsFor(i: number): Action[] {
    return legalActions(this.st).filter((a) => a.type === 'play' && a.handIndex === i);
  }

  private onSlot(i: number, side: 'me' | 'opp'): void {
    if (!this.canAct() || this.selected < 0) return;
    const acts = this.playsFor(this.selected);
    const a = acts.find((x) => x.type === 'play' && (side === 'me' ? x.slot === i || x.target === i : x.target === i));
    if (!a) return;
    SFX.cardPlay();
    void this.act(a);
  }

  // ------------------------------------------------------------ 流程
  private async act(a: Action): Promise<void> {
    this.busy = true;
    this.selected = -1;
    this.info?.destroy();
    const before = this.st;
    const side = before.current;
    const staged = peekAction(before, a);
    const r = applyAction(before, a);
    const nightEnded = r.events.some((e) => e.type === 'nightEnd');
    if (a.type === 'play') {
      this.st = staged;
      this.render();
      const slot = a.slot ?? a.target;
      if (slot !== undefined) {
        const y = side === 0 ? MY_Y : OPP_Y;
        sparks(this, slotX(slot), y, 16, 'ember', undefined, 260);
        shockRing(this, slotX(slot), y, 0xffd27a, 90, 260, 4);
      }
      for (const e of r.events) {
        if (e.type === 'blowout') {
          const y = e.side === 0 ? MY_Y : OPP_Y;
          this.floatAt(slotX(e.slot), y, '吹熄！', '#b8d8ff');
          SFX.dodge();
        } else if (e.type === 'buff') this.floatAt(slotX(e.slot), e.side === 0 ? MY_Y : OPP_Y, `+${e.amount}`, '#7dffb0');
        else if (e.type === 'debuff') this.floatAt(slotX(e.slot), e.side === 0 ? MY_Y : OPP_Y, `−${e.amount}`, '#ff8a8a');
        else if (e.type === 'reveal') this.banner(`偷看：${e.cardIds.map((id) => defOf({ id } as CardInst).name).join('、')}`, 1800);
      }
      await wait(this, 450);
    } else {
      this.floatAt(GAME_WIDTH / 2, side === 0 ? 720 : 240, side === 0 ? '你熄燈了' : `${this.opp.name} 熄燈`, '#ffd27a');
      await wait(this, 400);
    }
    if (nightEnded) await this.showdown(staged.sides[1].passed && staged.sides[0].passed ? staged : peekAction(staged, { type: 'pass' }), r.events);
    this.st = r.state;
    this.busy = false;
    this.render();
    if (this.st.phase === 'ended') {
      await this.endMatch();
      return;
    }
    const ns = r.events.find((e) => e.type === 'nightStart');
    if (ns && ns.type === 'nightStart') {
      const [mn, md] = MOON[this.st.moon];
      this.banner(`第 ${this.st.night} 夜　${mn}：${md}`, 1600);
      await wait(this, 900);
    }
    this.loop();
  }

  private loop(): void {
    if (this.st.phase !== 'playing' || this.busy) return;
    if (this.st.current === 1) {
      this.busy = true;
      this.time.delayedCall(650 + Math.random() * 400, () => {
        const a = this.opp.ai === 'tutorial'
          ? chooseTutorialAction(this.st, 1)
          : chooseAction(this.st, 1, { rng: this.rng, mistakeRate: this.opp.ai });
        this.busy = false;
        void this.act(a);
      });
    }
  }

  /** 對峙演出：逐座比較 → 被燒的牌噴火化灰 → 總分對撞 */
  private async showdown(board: MatchState, events: ReturnType<typeof applyAction>['events']): Promise<void> {
    this.st = board;
    this.render();
    const pv = previewNight(board);
    this.banner('對峙！', 900);
    await wait(this, 700);
    for (let i = 0; i < SLOTS; i++) {
      const b0 = pv.burned[0][i];
      const b1 = pv.burned[1][i];
      if (!b0 && !b1) continue;
      const y = b1 ? OPP_Y : MY_Y;
      const from = b1 ? MY_Y : OPP_Y;
      const flame = this.add.image(slotX(i), from, 'ember').setScale(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flame, y, duration: 180, ease: 'Quad.In', onComplete: () => flame.destroy() });
      await wait(this, 180);
      sparks(this, slotX(i), y, 30, 'ember', 0xff6a3a, 380);
      SFX.hitLight();
      this.cameras.main.shake(100, 0.006);
      const burnt = this.add.graphics();
      burnt.fillStyle(0x000000, 0.7).fillRoundedRect(slotX(i) - CW / 2, y - CH / 2, CW, CH, 12);
      this.layer.add(burnt);
      await wait(this, 160);
    }
    const ne = events.find((e) => e.type === 'nightEnd');
    if (ne && ne.type === 'nightEnd') {
      const [a, b] = ne.scores;
      await wait(this, 300);
      const win = ne.winner === 0;
      const tie = ne.winner === 'tie';
      if (win) SFX.roundWin();
      else SFX.cardPass();
      bigText(this, GAME_WIDTH / 2, 480, `${a} : ${b}`, '#ffffff', 72, 500);
      await wait(this, 700);
      bigText(this, GAME_WIDTH / 2, 480, tie ? '平手之夜' : win ? '贏下這一夜！' : '這一夜輸了', tie ? '#dfe8ff' : win ? '#ffd27a' : '#ff9a8a', 56, 700);
      if (win) sparks(this, GAME_WIDTH / 2, 480, 40, 'ember', undefined, 500);
      await wait(this, 1100);
    }
  }

  private async endMatch(): Promise<void> {
    const w = this.st.winner;
    const win = w === 0;
    await wait(this, 300);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 400 });
    if (win) {
      SFX.levelUp();
      sparks(this, GAME_WIDTH / 2, 520, 60, 'ember', undefined, 700);
    }
    bigText(this, GAME_WIDTH / 2, 520, win ? '勝利' : w === 'draw' ? '和局' : '敗北', win ? '#ffd27a' : '#ff9a8a', 110, -1);
    await wait(this, 900);
    const btn = this.add.container(GAME_WIDTH / 2, 760);
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1a, 0.95).fillRoundedRect(-200, -50, 400, 100, 24);
    g.lineStyle(3, 0xffd27a, 1).strokeRoundedRect(-200, -50, 400, 100, 24);
    btn.add([g, this.add.text(0, 0, this.story ? '繼續 ▶' : '再來一局', { fontFamily: UI_FONT, fontSize: '36px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5)]);
    btn.setSize(400, 100).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      SFX.confirm();
      fadeOutThen(this, 350, () => {
        if (this.story) {
          this.scene.stop();
          this.scene.wake('Dialogue', { outcome: win ? 'win' : 'lose' });
        } else this.scene.restart({ match: this.matchId });
      });
    });
  }

  private floatAt(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '900', color, stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 60, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  private banner(text: string, ms: number): void {
    const c = this.add.container(GAME_WIDTH / 2, 230).setDepth(70);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.8).fillRoundedRect(-330, -34, 660, 68, 16);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(-330, -34, 660, 68, 16);
    c.add([g, this.add.text(0, 0, text, { fontFamily: UI_FONT, fontSize: '25px', color: '#ffe6c0', align: 'center', wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5)]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => c.destroy() });
  }
}
