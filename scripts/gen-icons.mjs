#!/usr/bin/env node
// Rasterize public/icons/icon.svg into the PNG icons used by the PWA manifest
// and iOS. Re-run with `npm run icons` after editing the SVG.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'icons');
const svg = await readFile(path.join(dir, 'icon.svg'));
const BG = '#0b0f1e';

async function render(size, out, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const img = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  const buf = await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: img, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  await writeFile(path.join(dir, out), buf);
  console.log(`${out}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KiB`);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
// Maskable: keep the emblem inside the 80% safe zone.
await render(512, 'icon-512-maskable.png', { padding: 0.1 });
await render(180, 'apple-touch-icon.png');
await copyFile(path.join(dir, 'icon.svg'), path.join(root, 'public', 'favicon.svg'));
console.log('favicon.svg copied');
