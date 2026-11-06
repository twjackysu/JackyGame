// 分層邊界（design/24 §8、25 §4）：server 不碰畫面、net 只放協定、game 不直接碰伺服器與資料庫。
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
const IMPORT = /(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const importsOf = (f: string): string[] => [...readFileSync(f, 'utf8').matchAll(IMPORT)].map((m) => path.posix.normalize(path.posix.join(path.dirname(f), (m[1] ?? m[2])!)));
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const RULES: { dir: string; deny: RegExp; why: string }[] = [
  { dir: 'src/server', deny: /phaser|^src\/(game|client|audio|i18n)\//, why: 'server 不准 import Phaser／game／client' },
  { dir: 'src/net', deny: /phaser|^src\/(game|client|server|audio|core)\//, why: 'net 只放協定與傳輸' },
  { dir: 'src/game', deny: /^src\/server\//, why: 'game 只能透過 client 呼叫伺服器' },
];

describe('分層邊界', () => {
  for (const r of RULES)
    for (const f of listTs(r.dir))
      it(`${f}：${r.why}`, () => {
        expect(importsOf(f).filter((i) => r.deny.test(i) || i === 'phaser')).toEqual([]);
      });

  it('src/server 只有 db/local 可以碰瀏覽器儲存；不用 window／document', () => {
    for (const f of listTs('src/server')) {
      const c = code(f);
      expect(c, f).not.toMatch(/\bwindow\.|\bdocument\./);
      if (!f.includes(path.join('db', 'local'))) expect(c, f).not.toMatch(/\blocalStorage\b|\bindexedDB\b/);
    }
  });
});
