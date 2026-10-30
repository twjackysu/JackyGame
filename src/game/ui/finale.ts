// 通關演出（第 29 輪，D-133）：第一次打倒最後一張大地圖的 Boss 後播放——
// 結語、「第一章・完」、這趟旅程的紀錄（三位 Boss 的首殺日期與最快時間、等級、擊殺…）、製作名單、繼續冒險。
// 純畫面：不動核心、不寫戰鬥存檔，只記 `jg_finale_seen`。標題「回顧結局」可以重看。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playMusic } from '../../audio/music';
import { GAME_WIDTH, GAME_HEIGHT, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { highFx } from '../settings';
import { fmtSec } from '../rtRecord';
import { FINALE_CREDITS, finaleLinesFor, PROLOGUE_LINES, fmtPlay, markFinaleSeen, MEMORY_TOTAL, markPrologueSeen, STORY_ENCOUNTERS, type FinaleStats } from '../finaleStats';
import { FINALE_MAP, worldMap } from '../worldMaps';
import { loadChoices, withEpilogue } from '../choices';
import { loadWeapon } from '../weapon';
export { finaleSeen, loadFinaleStats, prologueSeen } from '../finaleStats';

const fmtDate = (at?: number): string => {
  if (!at) return '—';
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/**
 * 播放通關演出。回傳最外層容器（呼叫端把它當成 menu，戰鬥就會暫停）。
 * 點畫面＝跳到下一段；最後一段按「繼續冒險」才呼叫 onDone。
 */
export function playFinale(scene: Phaser.Scene, stats: FinaleStats, onDone: () => void, doneLabel = '繼續冒險'): Phaser.GameObjects.Container {
  return runStory(scene, stats, onDone, doneLabel);
}

/** 序章（D-134）：第一次進霧語森林前播放；點一下跳下一行、右上「略過」直接結束 */
export function playPrologue(scene: Phaser.Scene, onDone: () => void): Phaser.GameObjects.Container {
  return runStory(scene, null, onDone, '');
}

function runStory(scene: Phaser.Scene, stats: FinaleStats | null, onDone: () => void, doneLabel: string): Phaser.GameObjects.Container {
  const lines = stats ? withEpilogue(finaleLinesFor(loadWeapon()), loadChoices()) : PROLOGUE_LINES;
  if (stats) markFinaleSeen();
  else markPrologueSeen();
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(2000);
  const fx = highFx();
  // 第 64 輪：序章是從標題淡出（全黑）直接接上的——以前遮罩從 0 淡入，新玩家點「進入」後會先閃一下還沒定位的地圖和 HUD 再變暗；
  // 序章一開始就蓋滿，只有通關演出（從遊戲畫面接過來）才淡入
  const veil = scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 1).setAlpha(stats ? 0 : 0.985).setInteractive();
  root.add(veil);
  if (stats) scene.tweens.add({ targets: veil, alpha: 0.985, duration: 1400 }); // 第 47 輪：0.94 時底下的懸賞板、技能鍵字會透出來
  playMusic('title', 2);

  // 背景：緩慢旋轉的星印＋往上飄的星燼
  const sigil = scene.add.graphics().setPosition(cx, 560 + TALL / 2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const star = (r1: number, r2: number, n: number, rot = 0): Phaser.Math.Vector2[] =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? r2 : r1;
      return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
  sigil.lineStyle(2, 0xffd27a, 0.5).strokeCircle(0, 0, 250).strokeCircle(0, 0, 214);
  sigil.lineStyle(2, 0xffb35a, 0.4).strokePoints(star(240, 96, 8, -Math.PI / 2), true);
  sigil.lineStyle(1, 0xfff0c0, 0.35).strokePoints(star(150, 60, 4, Math.PI / 4), true);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    sigil.fillStyle(0xffe0a0, 0.6).fillCircle(Math.cos(a) * 232, Math.sin(a) * 232, i % 3 ? 2 : 4);
  }
  root.add(sigil);
  scene.tweens.add({ targets: sigil, alpha: 0.55, duration: 2400 });
  scene.tweens.add({ targets: sigil, rotation: Math.PI * 2, duration: 90000, repeat: -1 });
  if (scene.textures.exists('ember')) {
    const em = scene.add.particles(0, GAME_HEIGHT + 20, 'ember', {
      x: { min: 0, max: GAME_WIDTH }, lifespan: { min: 5000, max: 9000 }, speedY: { min: -120, max: -40 }, speedX: { min: -20, max: 20 },
      scale: { start: 0.8, end: 0.1 }, alpha: { start: 0.9, end: 0 }, frequency: fx ? 110 : 260, blendMode: Phaser.BlendModes.ADD,
    });
    root.add(em);
  }
  const hint = scene.add.text(cx, GAME_HEIGHT - 70, '點一下畫面繼續', { fontFamily: UI_FONT, fontSize: '22px', color: '#8a8070' }).setOrigin(0.5).setAlpha(0);
  root.add(hint);
  scene.tweens.add({ targets: hint, alpha: 0.8, delay: 3000, duration: 600 });

  let layer = scene.add.container(0, TALL / 2); // 長螢幕（D-142）：內容垂直置中
  root.add(layer);
  const clear = (): void => {
    const old = layer;
    scene.tweens.add({ targets: old, alpha: 0, duration: 400, onComplete: () => old.destroy() });
    layer = scene.add.container(0, TALL / 2); // 長螢幕（D-142）：內容垂直置中
    root.add(layer);
  };
  const glow = (t: Phaser.GameObjects.Text, color: number): void => {
    if (fx && scene.renderer.type === Phaser.WEBGL) t.postFX?.addGlow(color, 2, 0, false, 0.1, 10);
  };
  const ring = (y: number, color: number, r: number): void => {
    const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    root.add(g);
    const o = { r: 20, a: 1 };
    scene.tweens.add({ targets: o, r, a: 0, duration: 900, ease: 'Cubic.easeOut', onUpdate: () => g.clear().lineStyle(6 * o.a + 1, color, o.a).strokeCircle(cx, y + TALL / 2, o.r), onComplete: () => g.destroy() });
  };

  const lineTexts: Phaser.GameObjects.Text[] = [];
  const steps: (() => number)[] = [];
  // 1. 結語：一行一行浮現，前面的變暗
  lines.forEach((ln, i) => {
    steps.push(() => {
      for (const t of lineTexts) scene.tweens.add({ targets: t, alpha: 0.45, duration: 500 });
      const y = 250 + lineTexts.reduce((h, t) => h + t.height + 34, 0);
      const t = scene.add.text(cx, y, ln, { fontFamily: TITLE_FONT, fontSize: '34px', color: i === lines.length - 1 ? '#ffd27a' : '#f4e6c0', align: 'center', lineSpacing: 10, wordWrap: { width: 640, useAdvancedWrap: true } })
        .setOrigin(0.5, 0).setAlpha(0);
      layer.add(t);
      lineTexts.push(t);
      scene.tweens.add({ targets: t, alpha: 1, y: y - 8, duration: 900, ease: 'Sine.easeOut' });
      if (i === lines.length - 1) glow(t, 0xffb35a);
      return ln.length > 18 ? 3000 : 2300;
    });
  });
  if (!stats) {
    // 序章收尾：地圖名卡，然後自己結束
    steps.push(() => {
      clear();
      SFX.confirm();
      ring(560, 0x9adfa0, 300);
      const t = scene.add.text(cx, 560, '霧語森林', { fontFamily: TITLE_FONT, fontSize: '84px', fontStyle: '900', color: '#e8f4d8', stroke: '#0a1a0c', strokeThickness: 8 }).setOrigin(0.5).setAlpha(0).setScale(1.4);
      const sub = scene.add.text(cx, 660, '第一章　轉生者的森林', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#a8d8a0' }).setOrigin(0.5).setAlpha(0).setLetterSpacing(4);
      layer.add([t, sub]);
      glow(t, 0x9adfa0);
      scene.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 700, ease: 'Back.Out' });
      scene.tweens.add({ targets: sub, alpha: 1, delay: 500, duration: 700 });
      return 2400;
    });
    steps.push(() => {
      finish();
      return -1;
    });
  } else {
  // 2. 第一章・完
  steps.push(() => {
    clear();
    SFX.perfect();
    scene.cameras.main.flash(300, 255, 220, 150);
    ring(520, 0xffd27a, 360);
    scene.time.delayedCall(160, () => ring(520, 0xffb35a, 460));
    const t = scene.add.text(cx, 520, '第一章・完', { fontFamily: TITLE_FONT, fontSize: '96px', fontStyle: '900', color: '#ffe6a8', stroke: '#3a1a06', strokeThickness: 8 }).setOrigin(0.5).setScale(1.8).setAlpha(0);
    const sub = scene.add.text(cx, 640, '星燼回響　Echoes of Starfall', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#d8b880' }).setOrigin(0.5).setAlpha(0).setLetterSpacing(4);
    layer.add([t, sub]);
    glow(t, 0xffb35a);
    scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 700, ease: 'Back.Out' });
    scene.tweens.add({ targets: sub, alpha: 1, delay: 600, duration: 800 });
    return 3200;
  });
  // 3. 旅程紀錄
  steps.push(() => {
    clear();
    // 第 48 輪：長螢幕整頁往下挪一半的多出高度（以前擠在上半，下面空一大塊）
    const dy = Math.round(TALL / 2);
    const head = scene.add.text(cx, 190 + dy, '這趟旅程', { fontFamily: TITLE_FONT, fontSize: '50px', fontStyle: '900', color: '#ffd27a' }).setOrigin(0.5).setAlpha(0);
    layer.add(head);
    scene.tweens.add({ targets: head, alpha: 1, duration: 500 });
    stats.bosses.forEach((b, i) => {
      const y = 300 + dy + i * 150;
      const c = scene.add.container(cx - 40, y).setAlpha(0);
      const g = scene.add.graphics();
      g.fillStyle(0x140f0a, 0.85).fillRoundedRect(-300, -60, 600, 120, 18);
      g.lineStyle(2, Phaser.Display.Color.HexStringToColor(b.color).color, 0.8).strokeRoundedRect(-300, -60, 600, 120, 18);
      const name = scene.add.text(-270, -36, b.name, { fontFamily: TITLE_FONT, fontSize: '36px', fontStyle: 'bold', color: b.color });
      const map = scene.add.text(270, -30, b.map, { fontFamily: UI_FONT, fontSize: '22px', color: '#a89878' }).setOrigin(1, 0);
      const info = scene.add.text(-270, 14, `首次討伐 ${fmtDate(b.first)}・共 ${b.kills} 次${b.best !== undefined ? `・最快 ${fmtSec(b.best)}` : ''}`, { fontFamily: UI_FONT, fontSize: '24px', color: '#e8dcc0' });
      c.add([g, name, map, info]);
      layer.add(c);
      scene.tweens.add({ targets: c, alpha: 1, x: cx, delay: 300 + i * 260, duration: 500, ease: 'Cubic.easeOut', onStart: () => SFX.uiTap() });
    });
    const sum: [string, string][] = [
      ['等級', `Lv ${stats.level}`],
      ['遊玩時間', fmtPlay(stats.playSec)],
      ['擊殺', `${stats.kills}`],
      ['寶箱', `${stats.chests}`],
      ['燼牌勝場', `${stats.cardsWon}`],
      ['前世的記憶', `${stats.memories}/${MEMORY_TOTAL}`],
      ...(stats.helped !== undefined ? ([['幫助過的人', `${stats.helped}/${STORY_ENCOUNTERS.length}`]] as [string, string][]) : []),
    ];
    // 四位 Boss（打倒過星隕高原）時卡片排到 ~810，統計往下移，不要疊在一起
    const top = Math.max(790, 300 + stats.bosses.length * 150 + 40) + dy;
    // 七格（多了「幫助過的人」）排成 4＋3 兩列：三列會在 360×640（GAME_HEIGHT 1280）壓到下方的「點一下畫面繼續」（第 37 輪）
    const per = sum.length > 6 ? 4 : 3;
    const gap = per === 4 ? 170 : 210;
    sum.forEach(([k, v], i) => {
      const col = i % per;
      const row = Math.floor(i / per);
      const inRow = Math.min(per, sum.length - row * per);
      const x = cx + (col - (inRow - 1) / 2) * gap;
      const y = top + row * 130;
      const kv = scene.add.text(x, y, v, { fontFamily: TITLE_FONT, fontSize: '40px', fontStyle: 'bold', color: '#fff4d6' }).setOrigin(0.5).setAlpha(0);
      // 第 48 輪：「4 小時 24 分」比格子寬，會和隔壁的「Lv 17」「1832」黏成一串 → 縮到格子裡
      if (kv.width > gap - 16) kv.setScale((gap - 16) / kv.width);
      const kk = scene.add.text(x, y + 42, k, { fontFamily: UI_FONT, fontSize: '22px', color: '#a89878' }).setOrigin(0.5).setAlpha(0);
      layer.add([kv, kk]);
      scene.tweens.add({ targets: [kv, kk], alpha: 1, delay: 1200 + i * 140, duration: 400 });
    });
    return 6500;
  });
  // 4. 製作名單（往上捲）
  steps.push(() => {
    clear();
    // 第 47 輪：名單從畫面下緣捲上來，會一路壓過「點一下畫面繼續」→ 捲動時先淡掉（點一下照樣能跳過）
    scene.tweens.killTweensOf(hint);
    scene.tweens.add({ targets: hint, alpha: 0, duration: 300 });
    const roll = scene.add.container(0, GAME_HEIGHT + 40 - TALL / 2);
    let y = 0;
    const add = (t: Phaser.GameObjects.Text, gap: number): void => {
      t.setY(y);
      roll.add(t);
      y += t.height + gap;
    };
    add(scene.add.text(cx, 0, '星燼回響', { fontFamily: TITLE_FONT, fontSize: '72px', fontStyle: '900', color: '#ffe6a8' }).setOrigin(0.5, 0), 90);
    for (const [role, who] of FINALE_CREDITS) {
      add(scene.add.text(cx, 0, role, { fontFamily: UI_FONT, fontSize: '24px', color: '#a89878' }).setOrigin(0.5, 0), 14);
      add(scene.add.text(cx, 0, who, { fontFamily: TITLE_FONT, fontSize: '34px', color: '#f4e6c0', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0), 80);
    }
    add(scene.add.text(cx, 0, '2026・原創作品・GPL-3.0', { fontFamily: UI_FONT, fontSize: '22px', color: '#7a7060' }).setOrigin(0.5, 0), 0);
    layer.add(roll);
    const ms = 15000;
    scene.tweens.add({ targets: roll, y: -y - 40 - TALL / 2, duration: ms, ease: 'Linear' });
    return ms;
  });
  // 5. 感謝遊玩＋還能做什麼＋繼續冒險
  steps.push(() => {
    clear();
    hint.setVisible(false);
    const t = scene.add.text(cx, 420, '感謝遊玩', { fontFamily: TITLE_FONT, fontSize: '80px', fontStyle: '900', color: '#ffe6a8', stroke: '#3a1a06', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    glow(t, 0xffb35a);
    const postMap = worldMap(worldMap(FINALE_MAP)?.next ?? '')?.name ?? '新的地圖';
    const more = scene.add.text(cx, 610, `冒險還沒結束：\n✦ 地圖的邊緣之外——「${postMap}」開放了 ✦\n暴怒的 Boss・深夜的地圖・把裝備強化到 +10\n${stats && stats.memories < MEMORY_TOTAL ? `還有 ${MEMORY_TOTAL - stats.memories} 段沒想起來的前世記憶（紫色光點）\n` : ''}還有營火邊那位不輕易現身的說書人……`, { fontFamily: UI_FONT, fontSize: '26px', color: '#d8ccb0', align: 'center', lineSpacing: 12 }).setOrigin(0.5).setAlpha(0);
    const btn = scene.add.container(cx, 860).setAlpha(0);
    const g = scene.add.graphics();
    g.fillStyle(0x2a1a08, 0.95).fillRoundedRect(-190, -46, 380, 92, 22);
    g.lineStyle(3, 0xffd27a, 1).strokeRoundedRect(-190, -46, 380, 92, 22);
    const bt = scene.add.text(0, 0, doneLabel, { fontFamily: UI_FONT, fontSize: '36px', fontStyle: 'bold', color: '#ffe6a8' }).setOrigin(0.5).setLetterSpacing(6);
    btn.add([g, bt]).setSize(380, 92).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.confirm();
      finish();
    });
    layer.add([t, more, btn]);
    scene.tweens.add({ targets: t, alpha: 1, duration: 800 });
    scene.tweens.add({ targets: more, alpha: 1, delay: 700, duration: 800 });
    scene.tweens.add({ targets: btn, alpha: 1, delay: 1300, duration: 500 });
    scene.tweens.add({ targets: btn, scale: 1.04, delay: 1800, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return -1;
  });
  }

  let idx = -1;
  let timer: Phaser.Time.TimerEvent | null = null;
  let lastTap = 0;
  let done = false;
  const next = (): void => {
    if (done || idx >= steps.length - 1) return;
    timer?.remove();
    idx++;
    const ms = steps[idx]!();
    timer = ms > 0 ? scene.time.delayedCall(ms, next) : null;
  };
  const finish = (): void => {
    if (done) return;
    done = true;
    timer?.remove();
    scene.tweens.add({ targets: root, alpha: 0, duration: 600, onComplete: () => {
      root.destroy();
      onDone();
    } });
  };
  veil.on('pointerdown', () => {
    const now = scene.time.now;
    if (now - lastTap < 350) return;
    lastTap = now;
    next();
  });
  if (!stats) {
    const skip = scene.add.text(GAME_WIDTH - 30, 40, '略過 ▶▶', { fontFamily: UI_FONT, fontSize: '24px', color: '#c8c0b0', backgroundColor: 'rgba(0,0,0,0.4)' }).setPadding(14, 8, 14, 8).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      finish();
    });
    root.add(skip);
  }
  timer = scene.time.delayedCall(1500, next);
  return root;
}
