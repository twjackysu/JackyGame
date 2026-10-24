#!/usr/bin/env node
// 匯入外部繪製的立繪（Jacky 用 Gemini / ChatGPT 產生，上傳到 art-inbox/）。
// 用法：node scripts/import-art.mjs [inboxDir=art-inbox]
// - 檔名（不含副檔名）= 角色 id：lian / io / serin / liora / rourke（也接受 portrait_lian）。
// - 沒有透明背景時，從四邊做洪水填充去掉「單色背景」（容差可用 ART_TOL 調整，預設 38）。
// - 裁掉透明邊、高度縮到 ≤ 1100、輸出 public/art/portrait_<id>.webp（有 alpha），更新 src/data/handArt.ts。
// - 處理完的原檔會被刪掉（git rm 由呼叫者執行），避免大檔留在 repo。
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const inbox = process.argv[2] ?? 'art-inbox';
const OUT = 'public/art';
const MANIFEST = 'src/data/handArt.ts';
const TOL = Number(process.env.ART_TOL ?? 38);
const KNOWN = ['lian', 'io', 'serin', 'liora', 'rourke', 'valdran', 'valderan'];
/** 角色 id → 遊戲裡的材質 key（反派沿用對話的 npc_ 材質） */
const TEX = (id, battle = false) => {
  if (id.startsWith('npc_')) return id;
  const villain = id === 'valdran' || id === 'valderan';
  // *_battle.png：Q 版戰鬥圖。我方是背影（hero_<id>），瓦爾德蘭是 Boss 正面（enemy_boss_valderan）
  if (battle) return villain ? 'enemy_boss_valderan' : `hero_${id}`;
  return villain ? 'npc_valderan' : `portrait_${id}`;
};
/** 戰鬥圖輸出高度 = 程式材質的 2 倍解析度高（BattleScene 以 0.5 倍顯示） */
const BATTLE_H = { lian: 440, io: 420, serin: 460, liora: 420, rourke: 460, valdran: 680, valderan: 680 };

export async function removeFlatBackground(input, tol = TOL) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 4;
  // 已經有透明背景就不動
  let transparentCorners = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) if (data[px(x, y) + 3] < 20) transparentCorners++;
  if (transparentCorners >= 3) return { data, info, removed: 0 };
  // 背景色 = 四邊取樣的中位數
  const samples = [];
  for (let x = 0; x < w; x += Math.max(1, (w / 40) | 0)) samples.push(px(x, 0), px(x, h - 1));
  for (let y = 0; y < h; y += Math.max(1, (h / 40) | 0)) samples.push(px(0, y), px(w - 1, y));
  const med = (k) => samples.map((i) => data[i + k]).sort((a, b) => a - b)[samples.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const k = y * w + x;
    if (seen[k]) return;
    seen[k] = 1;
    if (dist(k * 4) <= tol) stack.push(k);
  };
  for (let x = 0; x < w; x++) push(x, 0), push(x, h - 1);
  for (let y = 0; y < h; y++) push(0, y), push(w - 1, y);
  let removed = 0;
  const mask = new Uint8Array(w * h);
  while (stack.length) {
    const k = stack.pop();
    mask[k] = 1;
    removed++;
    const x = k % w;
    const y = (k / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let k = 0; k < w * h; k++) if (mask[k]) data[k * 4 + 3] = 0;
  // 羽化：與背景相鄰、顏色接近背景的邊緣像素給半透明
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      if (mask[k]) continue;
      if (!(mask[k - 1] || mask[k + 1] || mask[k - w] || mask[k + w])) continue;
      const d = dist(k * 4);
      if (d < tol * 2.2) data[k * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0.15, (d - tol) / (tol * 1.2))));
    }
  }
  return { data, info, removed };
}

async function rawOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

/** 角色被原圖左右/上緣切到時會出現一條直線硬邊 → 邊緣 6% 範圍內 alpha 漸淡（底部藏在對話框後面，不處理） */
function fadeEdges(data, w, h) {
  const band = Math.max(8, Math.round(w * 0.06));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, w - 1 - x, Math.round(y * 0.6));
      if (d >= band) continue;
      const i = (y * w + x) * 4 + 3;
      data[i] = Math.round(data[i] * (d / band) ** 0.8);
    }
  }
}

/** 不透明區域的外框（sharp.trim 看 RGB，透明像素顏色不一時裁不乾淨，所以自己算） */
function alphaBBox(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { left: 0, top: 0, width: w, height: h };
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function midRatio({ data, info }) {
  let n = 0;
  for (let k = 3; k < data.length; k += 4) if (data[k] > 20 && data[k] < 200) n++;
  return n / (info.width * info.height);
}

function opaqueRatio({ data, info }) {
  let n = 0;
  for (let k = 3; k < data.length; k += 4) if (data[k] > 128) n++;
  return n / (info.width * info.height);
}

async function hasAlphaCorners(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let n = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) if (data[(y * w + x) * 4 + 3] < 20) n++;
  return n >= 3;
}

function idOf(file) {
  const stem = path.basename(file, path.extname(file)).toLowerCase().replace(/^portrait_/, '');
  // 配角：npc_tia.png → 材質 npc_tia（名稱要和 src/game/art 裡的 npc_ 材質一致）
  if (/^npc_[a-z_]+$/.test(stem)) return stem;
  return KNOWN.find((k) => stem === k || stem.startsWith(`${k}-`) || stem.startsWith(`${k}_`)) ?? null;
}

function writeManifest(keys) {
  const sorted = [...new Set(keys)].sort();
  writeFileSync(MANIFEST, `// 自動產生（scripts/import-art.mjs）：public/art/ 裡有的手繪立繪。Boot 會優先載入，程式立繪只在沒有時使用。\nexport const HAND_ART: readonly string[] = ${JSON.stringify(sorted)};\n`);
}

export async function main() {
  mkdirSync(OUT, { recursive: true });
  const existing = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')) : [];
  const files = existsSync(inbox) ? readdirSync(inbox).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : [];
  const done = [];
  for (const f of files) {
    const id = idOf(f);
    const src = path.join(inbox, f);
    if (!id) {
      console.log(`skip ${f}: 檔名要是 ${KNOWN.join('/')}`);
      continue;
    }
    // 去背順序：已透明 → 不動；rembg（isnet-anime，白髮等接近背景色的區域也保得住）→ 單色洪水填充 → 保留原圖。
    // 每一步都檢查「不透明區域 ≥ 12%」，避免整張被吃掉。
    const battle = /_battle\.[a-z]+$/i.test(f);
    const original = readFileSync(src);
    let result = null;
    // 已透明且半透明像素不多（< 7%）才直接用；有大片半透明光暈（例：白色暈影）就再丟給 rembg
    if (await hasAlphaCorners(original)) {
      const r0 = await rawOf(original);
      if (midRatio(r0) < 0.07) result = r0;
    }
    if (!result && process.env.ART_NO_REMBG !== '1') {
      const tmp = path.join(os.tmpdir(), `rembg-${id}.png`);
      try {
        execFileSync('python3', ['scripts/remove-bg.py', src, tmp], { stdio: 'inherit' });
        const r = await rawOf(readFileSync(tmp));
        if (opaqueRatio(r) >= 0.12) result = r;
        else console.log('rembg 結果幾乎全透明，改用單色去背');
      } catch {
        console.log('rembg 不可用，改用單色背景去背');
      }
    }
    if (!result) {
      const r = await removeFlatBackground(original);
      result = opaqueRatio(r) >= 0.12 ? r : await rawOf(original);
    }
    const { data, info } = result;
    if (!battle) fadeEdges(data, info.width, info.height);
    const removed = info.width * info.height - Math.round(opaqueRatio(result) * info.width * info.height);
    const key = TEX(id, battle);
    const out = path.join(OUT, `${key}.webp`);
    const bb = alphaBBox(data, info.width, info.height);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract(bb)
      .resize({ height: battle ? BATTLE_H[id] ?? 440 : 1100, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(out);
    const meta = await sharp(out).metadata();
    console.log(`ok ${f} → ${out} ${meta.width}x${meta.height} (去背 ${removed} px)`);
    unlinkSync(src);
    existing.push(key);
    done.push(id);
  }
  writeManifest(existing);
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
