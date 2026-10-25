import Phaser from 'phaser';
import { fadeOutThen } from '../fx/feel';
import { openSettings } from '../ui/settingsPanel';
import { SFX } from '../../audio/sfx';
import { playMusic } from '../../audio/music';
import { session } from '../session';
import { endingsSeen, newGamePlus } from '../../core/state/gameState';
import { mulberry32, randRange } from '../../core/rng';
import { t } from '../../i18n';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { ensurePortrait, generatePortraitArt } from '../art/silhouettes';

const TITLE_FONT =
  '"Noto Serif TC", "Noto Serif CJK TC", "Source Han Serif TC", "PingFang TC", "Songti TC", "Microsoft JhengHei", serif';
const UI_FONT =
  '"Noto Sans TC", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';

/**
 * Title screen built entirely from procedural textures:
 * gradient sky, twinkling stars, rotating star-shard sigil, rising embers,
 * glowing title, pulsing tap prompt.
 */
export class TitleScene extends Phaser.Scene {
  private sigil?: Phaser.GameObjects.Container;
  private busy = false;
  private prompt?: Phaser.GameObjects.Text;
  private menu?: Phaser.GameObjects.Container;
  private heroes: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const rng = mulberry32(0x57a2f); // fixed seed → identical starfield every launch
    const isWebGL = this.renderer.type === Phaser.WEBGL;
    // `?skipIntro` jumps straight to the settled state (screenshots / slow software GL).
    const skipIntro = new URLSearchParams(window.location.search).has('skipIntro');

    // Jacky 的 AI 主視覺（R-004）：有就整張鋪滿，標題移到星空區、不疊程式立繪
    const keyart = this.textures.exists('bg_title_keyart');
    const ty = keyart ? 200 : 470;
    if (keyart) {
      const bg = this.add.image(cx, GAME_HEIGHT / 2, 'bg_title_keyart');
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height) * 1.04);
      this.tweens.add({ targets: bg, scale: bg.scale * 1.05, y: GAME_HEIGHT / 2 - 14, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // 上方壓暗讓標題清楚、下方壓暗讓按鈕清楚
      const shade = this.add.graphics();
      shade.fillGradientStyle(0x03040b, 0x03040b, 0x03040b, 0x03040b, 0.7, 0.7, 0, 0).fillRect(0, 0, GAME_WIDTH, 420);
      shade.fillGradientStyle(0x03040b, 0x03040b, 0x03040b, 0x03040b, 0, 0, 0.75, 0.75).fillRect(0, GAME_HEIGHT - 520, GAME_WIDTH, 520);
    } else {
      this.drawSky();
      this.drawStars(rng);
    }

    // Big soft nebula glow behind the title.
    const nebula = this.add
      .image(cx, ty, 'glow')
      .setScale(3.2)
      .setAlpha(keyart ? 0.25 : 0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: nebula,
      scale: 3.6,
      alpha: 0.7,
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.sigil = this.buildSigil(cx, ty);

    // Embers rising from the bottom of the screen.
    this.add.particles(0, GAME_HEIGHT + 20, 'ember', {
      x: { min: 0, max: GAME_WIDTH },
      lifespan: { min: 4000, max: 9000 },
      speedY: { min: -140, max: -50 },
      speedX: { min: -25, max: 25 },
      accelerationX: { min: -8, max: 8 },
      scale: { start: 0.9, end: 0.1 },
      alpha: { start: 1, end: 0 },
      frequency: 90,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      advance: 6000,
    });
    // Slow drifting sparks across the middle.
    this.add.particles(cx, 640, 'spark', {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-cx, -500, GAME_WIDTH, 1000),
        quantity: 1,
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 6000,
      speed: { min: 5, max: 25 },
      scale: { start: 0.2, end: 1.0 },
      alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' },
      frequency: 260,
      blendMode: Phaser.BlendModes.ADD,
      advance: 6000,
    });

    // 主視覺：連恩與伊歐（動漫風立繪，從兩側滑入）
    generatePortraitArt(this);
    this.heroes = [];
    for (const [key, x, y, sc, from, delay] of (keyart ? [] : [
      ['portrait_io', 520, GAME_HEIGHT - 10, 620, 80, 900],
      ['portrait_lian', 200, GAME_HEIGHT + 30, 700, -80, 1100],
    ]) as [string, number, number, number, number, number][]) {
      if (!ensurePortrait(this, key)) continue;
      const img = this.add.image(x, y, key).setOrigin(0.5, 1);
      img.setScale(sc / img.height); // sc＝目標高度（手繪圖與程式立繪尺寸不同）
      this.heroes.push(img);
      if (!skipIntro) {
        img.setAlpha(0).setX(x + from);
        this.tweens.add({ targets: img, alpha: 1, x, duration: 1400, delay, ease: 'Cubic.easeOut' });
      }
      this.tweens.add({ targets: img, y: y - 6, duration: 2600 + delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Title.
    const title = this.add
      .text(cx, ty, t('game.title'), {
        fontFamily: TITLE_FONT,
        fontSize: '120px',
        fontStyle: 'bold',
        color: '#fff4d6',
        stroke: '#5a2a10',
        strokeThickness: 6,
        padding: { x: 56, y: 56 },
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffb35a', 18, true, true);

    const subtitle = this.add
      .text(cx, ty + 110, t('game.subtitle').toUpperCase(), {
        fontFamily: TITLE_FONT,
        fontSize: '34px',
        color: '#ffd9a0',
        padding: { x: 24, y: 24 },
      })
      .setOrigin(0.5)
      .setLetterSpacing(10)
      .setAlpha(0.9);

    // Decorative divider.
    const divider = this.add.graphics().setY(ty - 470);
    divider.lineStyle(2, COLORS.gold, 0.7);
    divider.lineBetween(cx - 230, 625, cx - 30, 625);
    divider.lineBetween(cx + 30, 625, cx + 230, 625);
    divider.fillStyle(COLORS.gold, 0.9);
    divider.fillPoints(
      [
        new Phaser.Math.Vector2(cx, 613),
        new Phaser.Math.Vector2(cx + 12, 625),
        new Phaser.Math.Vector2(cx, 637),
        new Phaser.Math.Vector2(cx - 12, 625),
      ],
      true,
    );

    if (isWebGL && title.postFX) {
      const glow = title.postFX.addGlow(0xffa54a, 3, 0, false, 0.1, 12);
      this.tweens.add({
        targets: glow,
        outerStrength: 9,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      subtitle.postFX?.addGlow(0xff7a2a, 2, 0, false, 0.1, 10);
    }

    // Intro animation.
    for (const [obj, delay] of [
      [title, 200],
      [subtitle, 600],
      [divider, 800],
    ] as const) {
      if (skipIntro) break;
      const targetY = obj.y;
      obj.setAlpha(0).setY(targetY + 30);
      this.tweens.add({
        targets: obj,
        alpha: obj === subtitle ? 0.9 : 1,
        y: targetY,
        duration: 1200,
        delay,
        ease: 'Cubic.easeOut',
      });
    }

    // Pulsing tap prompt.
    this.busy = false;
    this.menu = undefined;
    const prompt = (this.prompt = this.add
      .text(cx, 1000, t('title.tapToStart'), {
        fontFamily: UI_FONT,
        fontSize: '44px',
        color: '#ffffff',
        padding: { x: 8, y: 8 },
      })
      .setOrigin(0.5)
      .setLetterSpacing(12)
      .setShadow(0, 0, '#ffb35a', 16, false, true)
      .setAlpha(skipIntro ? 1 : 0));
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.25, to: 1 },
      duration: 1100,
      delay: skipIntro ? 1500 : 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Version.
    this.add
      .text(cx, GAME_HEIGHT - 48, t('title.version', { version: __APP_VERSION__ }), {
        fontFamily: UI_FONT,
        fontSize: '22px',
        color: '#8a8fb5',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);
    // 已看過的結局（二週目動機）
    const seen = session.hasSave() ? endingsSeen(session.load()) : 0;
    if (seen > 0) {
      this.add.text(cx, GAME_HEIGHT - 84, `✦ 結局 ${seen}/3`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd27a' })
        .setOrigin(0.5).setAlpha(0.85);
    }

    // Camera: vignette + fade in.
    const cam = this.cameras.main;
    if (isWebGL && cam.postFX) {
      cam.postFX.addVignette(0.5, 0.5, 0.9, 0.35);
    }
    if (!skipIntro) cam.fadeIn(1200, 0, 0, 0);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p, rng));
  }

  override update(_time: number, delta: number): void {
    if (this.sigil) this.sigil.rotation += delta * 0.00008;
  }

  private onTap(p: Phaser.Input.Pointer, rng: () => number): void {
    SFX.confirm();
    SFX.hit();
    playMusic('title');

    // Burst of sparks at the tap point.
    const burst = this.add.particles(p.worldX, p.worldY, 'ember', {
      speed: { min: 150, max: 520 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.1, end: 0 },
      lifespan: { min: 400, max: 900 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    burst.explode(28 + Math.floor(rng() * 12));
    this.time.delayedCall(1000, () => burst.destroy());

    if (this.busy || this.menu) return;
    const cam = this.cameras.main;
    cam.flash(250, 255, 220, 170);
    cam.shake(250, 0.012);
    this.showMenu();
  }

  private showMenu(): void {
    if (this.prompt) {
      this.tweens.killTweensOf(this.prompt);
      this.tweens.add({ targets: this.prompt, alpha: 0, duration: 200 });
    }
    const cx = GAME_WIDTH / 2;
    // 立繪往兩側讓位、變暗，不擋選單
    this.heroes.forEach((h, i) => {
      this.tweens.add({ targets: h, x: i === 0 ? GAME_WIDTH + 10 - 80 : -10 + 80, alpha: 0.45, duration: 400, ease: 'Cubic.Out' });
    });
    const items: [string, () => void][] = [];
    if (session.hasSave()) items.push(['繼續旅程', () => this.go(() => this.continueGame())]);
    items.push(['新的旅程', () => {
      if (!session.hasSave()) {
        this.go(() => this.startNew(false));
        return;
      }
      this.confirmNew();
    }]);
    // 即時戰鬥大地圖（D-087，Jacky 10/25 同意整合森林地圖）：獨立紀錄，不碰主線存檔
    items.push(['霧語森林・即時戰鬥', () => this.go(() => this.scene.start('RtBattle', { stage: 'mistwood', bot: '' }))]);
    items.push(['戰鬥演示', () => this.go(() => this.scene.start('Battle', {
      encounter: 'forest_a', chain: ['forest_b', 'shrine_boar', 'boss_wolfking'],
    }))]);
    items.push(['燼牌演示', () => this.go(() => this.scene.start('Cards', { match: 'demo' }))]);
    items.push(['設定', () => {
      if (this.busy) return;
      this.busy = true;
      void openSettings(this).then(() => {
        this.busy = false;
      });
    }]);
    const menu = (this.menu = this.add.container(0, 0));
    items.forEach(([label, fn], i) => {
      const y = 1180 - (items.length - 1 - i) * 100 - (items.length > 4 ? 0 : 40);
      const c = this.add.container(cx, y);
      const g = this.add.graphics();
      g.fillStyle(0x0a0d1a, 0.85).fillRoundedRect(-200, -42, 400, 84, 20);
      g.lineStyle(2, 0xffd27a, i === 0 ? 1 : 0.5).strokeRoundedRect(-200, -42, 400, 84, 20);
      const tx = this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(6);
      c.add([g, tx]).setSize(400, 84).setInteractive({ useHandCursor: true }).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, y: y - 10, delay: 100 + i * 80, duration: 300, ease: 'Cubic.Out' });
      c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.confirm();
        fn();
      });
      menu.add(c);
    });
  }

  private startNew(plus: boolean): void {
    const prev = plus ? session.load() : null;
    session.newGame();
    if (prev) {
      session.replace(newGamePlus(prev));
      session.save();
    }
    this.scene.start('Dialogue', { script: 'ch0' });
  }

  /** 已有存檔時的「新的旅程」確認；通關存檔另外提供二週目（D-035）。 */
  private confirmNew(): void {
    if (this.busy) return;
    this.busy = true;
    const prev = session.load();
    const cleared = !!prev?.flags['ch5_complete'];
    const ui = this.add.container(0, 0).setDepth(900);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const h = cleared ? 520 : 400;
    const top = GAME_HEIGHT / 2 - h / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(60, top, GAME_WIDTH - 120, h, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(60, top, GAME_WIDTH - 120, h, 24);
    const msg = cleared
      ? '你已經走完一次旅程。\n二週目會保留等級、金錢與燼牌收藏，\n可以試試不同的選擇與結局。'
      : '開始新的旅程會覆蓋目前的存檔。';
    const t = this.add.text(GAME_WIDTH / 2, top + 100, msg, {
      fontFamily: UI_FONT, fontSize: '26px', color: '#ffe9c4', align: 'center', lineSpacing: 10,
    }).setOrigin(0.5);
    ui.add([dim, g, t]);
    const close = (): void => {
      ui.destroy();
      this.busy = false;
    };
    const buttons: [string, number, () => void][] = [];
    if (cleared) buttons.push(['二週目 ✦', 0xffd27a, () => { ui.destroy(); this.busy = false; this.go(() => this.startNew(true)); }]);
    buttons.push(['覆蓋並重新開始', cleared ? 0x9fb0d8 : 0xffd27a, () => { ui.destroy(); this.busy = false; this.go(() => this.startNew(false)); }]);
    buttons.push(['取消', 0x5a6380, close]);
    buttons.forEach(([label, col, fn], i) => {
      const y = top + (cleared ? 230 : 200) + i * 96;
      const c = this.add.container(GAME_WIDTH / 2, y);
      const bg = this.add.graphics();
      bg.fillStyle(0x14182c, 1).fillRoundedRect(-220, -38, 440, 76, 18);
      bg.lineStyle(2, col, 1).strokeRoundedRect(-220, -38, 440, 76, 18);
      const tx = this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
      c.add([bg, tx]).setSize(440, 76).setInteractive({ useHandCursor: true });
      c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.confirm();
        fn();
      });
      ui.add(c);
    });
  }

  private continueGame(): void {
    const s = session.load();
    const pos = s ? session.scriptPos() : null;
    if (pos?.script === 'map') this.scene.start('Map');
    else if (pos?.script === 'explore') this.scene.start('Explore', { area: pos.node });
    else if (pos) this.scene.start('Dialogue', { script: pos.script, node: pos.node });
    else {
      session.newGame();
      this.scene.start('Dialogue', { script: 'ch0' });
    }
  }

  private go(fn: () => void): void {
    if (this.busy) return;
    this.busy = true;
    fadeOutThen(this, 500, fn);
  }

  private drawSky(): void {
    const key = 'sky';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        const lin = c.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        lin.addColorStop(0, '#03040b');
        lin.addColorStop(0.35, '#0e0d2b');
        lin.addColorStop(0.7, '#2a1440');
        lin.addColorStop(1, '#5a2030');
        c.fillStyle = lin;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Horizon warmth.
        const rad = c.createRadialGradient(
          GAME_WIDTH / 2, GAME_HEIGHT * 1.05, 40,
          GAME_WIDTH / 2, GAME_HEIGHT * 1.05, GAME_HEIGHT * 0.6,
        );
        rad.addColorStop(0, 'rgba(255,140,60,0.55)');
        rad.addColorStop(1, 'rgba(255,140,60,0)');
        c.fillStyle = rad;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        tex.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0);

    // Silhouetted mountain ridges.
    const ridgeRng = mulberry32(99);
    const ridges: Array<[number, number, number]> = [
      [0x1a0f2a, 1040, 70],
      [0x0d0818, 1120, 50],
    ];
    for (const [color, baseY, amp] of ridges) {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(0, GAME_HEIGHT)];
      for (let x = 0; x <= GAME_WIDTH; x += 40) {
        const y = baseY - Math.abs(Math.sin(x * 0.009 + baseY)) * amp - randRange(ridgeRng, 0, amp * 0.4);
        pts.push(new Phaser.Math.Vector2(x, y));
      }
      pts.push(new Phaser.Math.Vector2(GAME_WIDTH, GAME_HEIGHT));
      g.fillPoints(pts, true);
    }
  }

  private drawStars(rng: () => number): void {
    for (let i = 0; i < 140; i++) {
      const x = rng() * GAME_WIDTH;
      const y = Math.pow(rng(), 1.4) * GAME_HEIGHT * 0.8;
      const s = randRange(rng, 0.3, 1.2);
      const star = this.add.image(x, y, 'star').setScale(s).setAlpha(randRange(rng, 0.3, 0.9));
      if (rng() < 0.4) {
        this.tweens.add({
          targets: star,
          alpha: 0.1,
          duration: randRange(rng, 800, 2600),
          delay: randRange(rng, 0, 2000),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /** Eight-pointed star sigil made of rotated shards + two rings. */
  private buildSigil(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setAlpha(0.55);
    const rings = this.add.graphics();
    rings.lineStyle(2, COLORS.gold, 0.5);
    rings.strokeCircle(0, 0, 230);
    rings.lineStyle(1, COLORS.gold, 0.35);
    rings.strokeCircle(0, 0, 250);
    rings.strokeCircle(0, 0, 150);
    container.add(rings);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const long = i % 2 === 0;
      const shard = this.add
        .image(Math.cos(a) * (long ? 190 : 170), Math.sin(a) * (long ? 190 : 170), 'shard')
        .setRotation(a + Math.PI / 2)
        .setScale(long ? 1.2 : 0.7)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add(shard);
    }
    return container;
  }
}
