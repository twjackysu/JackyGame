// 守住邊界：src/core（即時戰鬥核心）不得反向依賴 src/game、src/audio、Phaser，也不得用不可重現的隨機／時間。
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
const NONDETERMINISTIC = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(/;

describe('src/core 不得反向依賴畫面與音訊', () => {
  for (const f of listTs('src/core')) {
    it(`${f}`, () => {
      const bad = importsOf(readFileSync(f, 'utf8')).filter((i) => FORBIDDEN_LAYERS.some((r) => r.test(i)));
      expect(bad).toEqual([]);
      expect(code(readFileSync(f, 'utf8'))).not.toMatch(NONDETERMINISTIC);
    });
  }
});
