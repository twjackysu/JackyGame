// 通關機器人入口（第 82 輪，D-215）：`node scripts/playthrough.mjs` 或 `npm run playthrough`。
// 舊的回合制版本在 D-097 刪掉了；現在真正的機器人是 tests/rt-campaign.test.ts（新存檔 Lv1、不帶裝備，
// 長劍／長弓／法杖各一趟，依序打倒霧角狼王 → 棘冠狼后 → 燼心岩王＝結局）。這支只負責跑它並印出每趟的紀錄。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const t0 = Date.now();
const r = spawnSync('npx', ['vitest', 'run', 'tests/rt-campaign.test.ts'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
const lines = out.split('\n').filter((l) => /^\[通關機器人|^(mistwood|thornvale|emberrift) 第|Tests |FAIL|AssertionError/.test(l.trim()));
console.log(lines.length ? lines.join('\n') : out);
const ok = r.status === 0;
console.log(ok ? `\n✔ 三把武器都從新遊戲打到結局（${((Date.now() - t0) / 1000).toFixed(0)} 秒）` : '\n✘ 通關機器人沒有打到結局（上面是每趟的紀錄）');
process.exit(ok ? 0 : 1);
