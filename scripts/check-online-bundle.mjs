#!/usr/bin/env node
// D-306／26-security：線上版客戶端（npm run build:online）不能打包 src/server——
// 掃 dist-online 的 JS，出現本機伺服器才有的字串就失敗（LocalDb、GameServer 的錯誤訊息）。
// 用法：node scripts/check-online-bundle.mjs [dist-online] [對照的離線版 dist]
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'dist-online';
const offline = process.argv[3];
const MARKERS = ['jgdb:probe', 'write needs requestId', 'requestId reused for another method'];

function js(d) {
  const a = path.join(d, 'assets');
  return readdirSync(a).filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync(path.join(a, f), 'utf8')]);
}

let bad = 0;
for (const [f, src] of js(dir)) {
  for (const m of MARKERS) {
    if (src.includes(m)) {
      console.error(`✗ ${dir}/assets/${f} 含有伺服器字串「${m}」`);
      bad++;
    }
  }
}
// 對照組：離線版一定要有（不然代表字串改了、這個檢查已經失效）
if (offline) {
  const all = js(offline).map(([, s]) => s).join('\n');
  for (const m of MARKERS) {
    if (!all.includes(m)) {
      console.error(`✗ 離線版 ${offline} 找不到「${m}」——伺服器字串改了，請更新 MARKERS`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`✓ ${dir} 沒有打包 src/server（${MARKERS.length} 個字串）`);
