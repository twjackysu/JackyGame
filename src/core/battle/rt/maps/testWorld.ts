// 測試用 48×96 大地圖（刷怪耐久測試與畫面分塊地面的除錯入口共用；不在正式關卡清單裡）。
// P2 霧語森林本體等 Jacky 試玩回覆（D-065），這張只是壓力測試用。
import type { StageDefinition } from '../types';
import { sec, u } from '../types';

const W = 48;
const H = 96;
export function testWorldRows(): string[] {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const nearCamp = Math.hypot(x - 24, y - 90) < 5 || Math.hypot(x - 24, y - 50) < 5;
      const wall = (y === 70 || y === 30) && x % 16 !== 8 && x % 16 !== 7; // 兩道林牆，各留三個缺口
      r += !nearCamp && (wall || rnd() < 0.05) ? '#' : '.';
    }
    out.push(r);
  }
  return out;
}

export function makeTestWorldStage(): StageDefinition {
  return {
    id: 'test_world', name: '測試森林', timeLimitTicks: sec(600), player: { x: u(24), y: u(91) }, mapAi: true, enemies: [],
    reviveAtCampfire: true,
    arena: { w: u(W), h: u(H), solid: { cell: u(1), rows: testWorldRows() } },
    campfires: [{ id: 'south', x: u(24), y: u(90) }, { id: 'mid', x: u(24), y: u(50) }],
    spawnGroups: [
      { id: 'wolves_a', enemyId: 'wolf', cx: u(12), cy: u(80), spawnRadius: u(2), maxAlive: 3, respawnTicks: sec(30) },
      { id: 'wolves_b', enemyId: 'wolf', cx: u(36), cy: u(78), spawnRadius: u(2), maxAlive: 3, respawnTicks: sec(30) },
      { id: 'shooters', enemyId: 'thorn_shooter', cx: u(24), cy: u(62), spawnRadius: u(3), maxAlive: 2, respawnTicks: sec(45) },
      { id: 'pack', enemyId: 'wolf', cx: u(12), cy: u(44), spawnRadius: u(2.5), maxAlive: 4, respawnTicks: sec(30) },
      { id: 'alpha', enemyId: 'alpha_wolf', cx: u(38), cy: u(40), spawnRadius: u(1), maxAlive: 1, respawnTicks: sec(180), tier: 'elite' },
      { id: 'north', enemyId: 'wolf', cx: u(24), cy: u(16), spawnRadius: u(3), maxAlive: 4, respawnTicks: sec(30) },
    ],
  };
}
