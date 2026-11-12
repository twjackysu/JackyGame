// 效果圖示總覽（第 187 輪）：把所有祝福／獨特效果的圖示照 HUD 大小與卡片大小各畫一排，檢查小尺寸下看不看得懂、會不會像別的東西。
// 先 `npx vite --port 5173`。用法：node scripts/shot-icons.mjs [tag]　輸出 screenshots/icons-<tag>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [tag = 'a'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.waitForTimeout(2500);
await pg.evaluate(() => __game.scene.getScene('Title').cameras.main.fadeEffect.reset());
const names = await pg.evaluate(async () => {
  const I = await import('/src/game/fx/effectIcon.ts');
  const E = await import('/src/core/battle/rt/effects.ts');
  const t = __game.scene.getScene('Title');
  const W = t.scale.width; const H = t.scale.height;
  const g = t.add.graphics().setDepth(99999).setScrollFactor(0);
  g.fillStyle(0x14241a, 1).fillRect(0, 0, W, H);
  const defs = [...Object.values(E.EFFECTS), E.effectDef(E.tryVariantId('heavy_slash', 1))].filter(Boolean);
  const cols = 3; const cw = W / cols;
  defs.forEach((d, i) => {
    const x = (i % cols) * cw + 20; const y = 70 + Math.floor(i / cols) * 190;
    I.drawEffectIcon(g, x + 30, y, 21, d.element, false, d.glyph);
    I.drawEffectIcon(g, x + 130, y + 10, 56, d.element, false, d.glyph);
    t.add.text(x + 10, y + 78, d.name, { fontSize: '26px', color: '#ffffff' }).setDepth(99999);
  });
  return defs.map((d) => d.name);
});
console.log(names.join(' '));
await pg.waitForTimeout(300);
await pg.screenshot({ path: `screenshots/icons-${tag}.png` });
await b.close();
