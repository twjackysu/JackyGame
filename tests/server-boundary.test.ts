// 守住「可搬去後端」的邊界：src/server 不得依賴瀏覽器、畫面或不可重現的隨機／時間；
// src/core 與 src/server 都不得反向依賴 src/game、src/audio（見 src/server/README.md、DECISIONS D-054）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** 去掉註解，避免說明文字被當成程式碼誤判 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const IMPORT = /(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function importsOf(text: string): string[] {
  const res: string[] = [];
  for (const m of text.matchAll(IMPORT)) res.push((m[1] ?? m[2]) as string);
  return res;
}

const FORBIDDEN_LAYERS = [/^phaser$/, /(^|\/)game(\/|$)/, /(^|\/)audio(\/|$)/, /(^|\/)i18n(\/|$)/];
const BROWSER_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator)\b/;
const NONDETERMINISTIC = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(/;

describe('src/server 邊界（可移植後端層）', () => {
  const files = listTs('src/server');
  it('有檔案可檢查', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const src = code(raw);
    it(`${f} 不依賴畫面層`, () => {
      const bad = importsOf(raw).filter((i) => FORBIDDEN_LAYERS.some((r) => r.test(i)));
      expect(bad).toEqual([]);
    });
    it(`${f} 不使用瀏覽器全域`, () => expect(src).not.toMatch(BROWSER_GLOBALS));
    it(`${f} 不直接使用 Math.random／Date.now（改用注入的 RandomProvider／Clock）`, () => expect(src).not.toMatch(NONDETERMINISTIC));
  }
});

describe('src/core 不得反向依賴畫面與音訊', () => {
  for (const f of listTs('src/core')) {
    it(`${f}`, () => {
      const bad = importsOf(readFileSync(f, 'utf8')).filter((i) => FORBIDDEN_LAYERS.some((r) => r.test(i)));
      expect(bad).toEqual([]);
    });
  }
});
