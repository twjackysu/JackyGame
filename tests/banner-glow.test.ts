import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 第 180 輪（D-376）：大字公告的光暈以前用 postFX 的 Glow——整個畫面每個像素取樣約 96 次，大字在畫面上的每一幀都要付
// （headless 量到每多一行大字，一幀多 600ms；沒有大字時整幀才 120ms）。改成墊一層畫一次的同字。這裡擋「又寫回 postFX」。
const src = readFileSync('src/game/fx/feel.ts', 'utf8');
const body = src.slice(src.indexOf('export function bigText('), src.indexOf('export function pressBounce('));
const style = src.slice(src.indexOf('export function bannerGlowStyle('), src.indexOf('export function bigText('));

describe('大字公告的光暈', () => {
  it('bigText 不用 postFX／preFX（每幀全畫面的著色器）', () => {
    expect(body.length).toBeGreaterThan(200);
    expect(body).not.toMatch(/\.postFX|\.preFX|addGlow\(/);
  });
  it('光暈是墊在下面的一層同字，只在高畫質出現，本體消失時一起清掉', () => {
    expect(body).toMatch(/highFx\(\) \? scene\.add\.text\(x, y, text, bannerGlowStyle\(color, size\)\)/);
    expect(body).toMatch(/DESTROY[\s\S]{0,160}glow\.destroy\(\)/);
    expect(body).toMatch(/events\.off\(Phaser\.Scenes\.Events\.POST_UPDATE, follow\)/);
  });
  it('光暈的亮邊比本體的描邊寬，留白不小於模糊半徑＋亮邊（不會被切成方塊）', () => {
    const glowStroke = Number(/strokeThickness: (\d+)/.exec(style)?.[1]);
    const mainStroke = Number(/stroke: '#140a04', strokeThickness: (\d+)/.exec(body)?.[1]);
    const blur = Number(/blur: (\d+)/.exec(style)?.[1]);
    const pad = Number(/BANNER_GLOW_PAD = (\d+)/.exec(src)?.[1]);
    expect(glowStroke).toBeGreaterThan(mainStroke);
    expect(pad).toBeGreaterThanOrEqual(blur + glowStroke / 2);
  });
  it('標題畫面的標題／副標也不用 postFX 的 Glow（改成墊一層同字＋透明度呼吸），離開場景時拿掉每幀的跟隨', () => {
    const title = readFileSync('src/game/scenes/TitleScene.ts', 'utf8');
    expect(title).not.toMatch(/addGlow\(/);
    expect(title).toMatch(/children\.moveBelow\(halo, title\)/);
    expect(title).toMatch(/SHUTDOWN, \(\) => this\.events\.off\(Phaser\.Scenes\.Events\.POST_UPDATE, follow\)/);
  });
});
