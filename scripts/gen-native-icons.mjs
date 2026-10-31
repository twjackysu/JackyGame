#!/usr/bin/env node
// Android／iOS 原生 App 圖示與啟動畫面（第 80 輪，D-213）：以前一直是 Capacitor 預設的藍色 X＋白底。
// 從 public/icons/icon.svg 產生：
//   Android：mipmap-*/ic_launcher(_round|_foreground|_background).png、drawable*/splash.png
//   iOS：AppIcon-512@2x.png（1024，不透明）、Splash.imageset 三張 2732
// 改了 SVG 之後：node scripts/gen-native-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgText = await readFile(path.join(root, 'public', 'icons', 'icon.svg'), 'utf8');
const BG = '#0b0f1e';
const RES = path.join(root, 'android', 'app', 'src', 'main', 'res');
const IOS = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets');

// 拆成「背景」（漸層方塊）與「前景」（光暈、星、劍、火星）
const bgRect = '<rect width="512" height="512" fill="url(#bg)"/>';
if (!svgText.includes(bgRect)) throw new Error('icon.svg 的背景 rect 改過了，請更新這支腳本');
const defs = svgText.slice(svgText.indexOf('<defs>'), svgText.indexOf('</defs>') + 7);
const body = svgText.slice(svgText.indexOf(bgRect) + bgRect.length, svgText.lastIndexOf('</svg>'));
const wrap = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}${inner}</svg>`);
const full = Buffer.from(svgText);
const bgOnly = wrap(bgRect);
// 自適應圖示：前景 108dp，桌面只露中間約 66～72dp → 劍（y 70～440，約 370px）縮到 66dp 內
const FG_SCALE = ((66 / 108) * 512) / 370;
const fgOnly = wrap(`<g transform="translate(256 256) scale(${FG_SCALE.toFixed(4)}) translate(-256 -255)">${body}</g>`);

const png = (buf, size) => sharp(buf, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
const mask = (size, round) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${round ? size / 2 : size * 0.18}" fill="#fff"/></svg>`);
async function masked(size, round) {
  return sharp(await png(full, size)).composite([{ input: mask(size, round), blend: 'dest-in' }]).png({ compressionLevel: 9 }).toBuffer();
}
async function save(file, buf) {
  await writeFile(file, buf);
  console.log(path.relative(root, file), `${(buf.length / 1024).toFixed(1)} KiB`);
}

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const dir = path.join(RES, `mipmap-${d}`);
  await save(path.join(dir, 'ic_launcher.png'), await masked(Math.round(48 * k), false));
  await save(path.join(dir, 'ic_launcher_round.png'), await masked(Math.round(48 * k), true));
  await save(path.join(dir, 'ic_launcher_foreground.png'), await png(fgOnly, Math.round(108 * k)));
  await save(path.join(dir, 'ic_launcher_background.png'), await png(bgOnly, Math.round(108 * k)));
}

// 啟動畫面：深色底＋圓角圖示（短邊的 30%）
async function splash(w, h) {
  const s = Math.round(Math.min(w, h) * 0.3);
  return sharp({ create: { width: w, height: h, channels: 3, background: BG } })
    .composite([{ input: await masked(s, false), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
const SPLASH = {
  drawable: [480, 320],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [dir, [w, h]] of Object.entries(SPLASH)) await save(path.join(RES, dir, 'splash.png'), await splash(w, h));

// iOS：App Store 規定圖示不能有透明 → 直接整張（iOS 自己會切圓角）
await save(path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), await sharp(await png(full, 1024)).flatten({ background: BG }).png({ compressionLevel: 9 }).toBuffer());
const big = await splash(2732, 2732);
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await save(path.join(IOS, 'Splash.imageset', f), big);
