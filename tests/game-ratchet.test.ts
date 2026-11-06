// V2 驗收（23 §5）的棘輪：src/game 直接碰瀏覽器儲存、直接改錢包／存檔的地方只准變少、不准變多。
// 規則搬到 core/meta＋伺服器之後，把這裡的數字調低（數字變少時測試會提醒你更新）。新檔案一律 0。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p.split(path.sep).join('/'));
  }
  return out;
}
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const count = (f: string, re: RegExp) => (code(f).match(re) ?? []).length;

/** 直接碰 localStorage／indexedDB（第 142 輪的數字） */
const STORAGE: Record<string, number> = {
  'src/game/settings.ts': 3,
  'src/game/choices.ts': 2,
  'src/game/ui/emberCardPanel.ts': 2,
  'src/game/ui/weaponPick.ts': 1,
  'src/game/rtControls.ts': 3,
  'src/game/scenes/RtBattleScene.ts': 9,
  'src/game/scenes/TitleScene.ts': 4,
  'src/game/chapters.ts': 2,
  'src/game/encounters.ts': 3,
  'src/game/rtRecord.ts': 4,
  'src/game/finaleStats.ts': 6,
  'src/game/weapon.ts': 3,
  'src/game/memories.ts': 3,
};
/** 畫面層自己改存檔／錢包（saveRecord／spend／spendCoin） */
const WRITES: Record<string, number> = {
  'src/game/ui/rtBagPanel.ts': 2,
  'src/game/ui/rtShopPanel.ts': 3,
  'src/game/scenes/RtBattleScene.ts': 26,
  'src/game/rtRecord.ts': 2,
};

describe('src/game 棘輪（V2：規則與存檔搬到伺服器）', () => {
  const files = listTs('src/game');
  for (const [name, re, base] of [
    ['localStorage／indexedDB', /\blocalStorage\b|\bindexedDB\b/g, STORAGE],
    ['saveRecord／spend', /\b(?:saveRecord|spend|spendCoin)\(/g, WRITES],
  ] as const)
    it(`${name} 只准變少`, () => {
      const over: string[] = [];
      const lower: string[] = [];
      for (const f of files) {
        const n = count(f, re);
        const b = base[f] ?? 0;
        if (n > b) over.push(`${f}: ${n} > ${b}`);
        else if (n < b) lower.push(`${f}: ${n} < ${b}`);
      }
      expect(over, '新的直接存取：改走 GameClient／core/meta').toEqual([]);
      expect(lower, '變少了！把 tests/game-ratchet.test.ts 的數字調低').toEqual([]);
    });
});
