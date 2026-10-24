// 狼徑・古燈塔（第 1 章後半，可走區域）：狼徑祠堂（蝕化野豬）、古燈塔遺跡（三燈芯）、林間營火、倒木寶箱、狼王巢穴。
// 北出口 → 霧角森林。狼王巢穴打完（ch1_complete）劇本會回世界地圖（第 2 章）。
import type { AreaDef } from '../../core/explore/area';
import type { Condition } from '../../core/state/gameState';

const ROWS = [
  'TTTTTTTTTTGGTTTTTTTTTT', // 0
  'TTTTTTTTT.::.TTTTTTTTT', // 1
  'TTTTTTT...::...TTTTTTT', // 2
  'TTTTT.....::.....TTTTT', // 3
  'TT.....,..::........TT', // 4
  'TT..T.....::...T....TT', // 5
  'TT........::....T...TT', // 6
  'TT........::........TT', // 7
  'TT........::::......TT', // 8
  'TT.T......::::......TT', // 9
  'TT..........::...T..TT', // 10
  'TT..........::....T.TT', // 11
  'TT..........::T.....TT', // 12
  'TT..........::T.....TT', // 13
  'TT..........::......TT', // 14
  'TT...:::::..::....,.TT', // 15
  'TT...:::::::::......TT', // 16
  'TT......::::::......TT', // 17
  'TT..,...::..........TT', // 18
  'TT......::..::::::..TT', // 19
  'TT....T.::..::::::..TT', // 20
  'TT..T...::..........TT', // 21
  'TT......:::::.......TT', // 22
  'TT......:::::.......TT', // 23
  'TT.........::...T...TT', // 24
  'TT...T.....::,...T..TT', // 25
  'TT.......,.::.......TT', // 26
  'TT.T.......::.......TT', // 27
  'TT.........::..T....TT', // 28
  'TT.........::.......TT', // 29
  'TTTTTTT....::..TTTTTTT', // 30
  'TTTTTTT........TTTTTTT', // 31
  'TTTTTTT........TTTTTTT', // 32
  'TTTTTTTTTTTTTTTTTTTTTT', // 33
];

const ALL_WICKS: Condition = { all: [{ flag: 'wick_lake' }, { flag: 'wick_hunter' }, { flag: 'wick_shrine' }] };

export const WOLFPATH: AreaDef = {
  id: 'wolfpath',
  region: 'ch1',
  name: '狼徑・古燈塔',
  night: true,
  mapNode: 'wolf_path',
  rows: ROWS,
  buildings: [{ x: 3, y: 10, w: 5, h: 4, roof: '#4a4a5a', wall: '#6a6a72', sign: '古燈塔' }],
  spawns: {
    default: { x: 10, y: 2 },
    north: { x: 10, y: 2 },
    wolf_path: { x: 13, y: 9 },
    lighthouse: { x: 5, y: 15 },
    campfire: { x: 17, y: 20 },
    fallen_log: { x: 18, y: 25 },
    wolf_den: { x: 11, y: 29 },
  },
  entities: [
    {
      id: 'wolf_path', kind: 'door', x: 14, y: 8, name: '狼徑祠堂', glow: 0xb89aff, talk: { script: 'ch1', node: 'wolf_path' },
      requires: { flag: 'ch1_met_bern' }, done: 'ch1_path_cleared',
      lines: ['（祠堂裡有低沉的鼻息聲……先去獵人小屋打聽一下吧。）'],
    },
    {
      id: 'lighthouse', kind: 'door', x: 5, y: 13, name: '古燈塔遺跡', talk: { script: 'ch1', node: 'lighthouse' },
      requires: ALL_WICKS, done: 'ch1_legacy', lines: ['（塔門上有三個燈芯形狀的凹槽。\n　湖、獵人、祠堂……三枚燈芯要湊齊。）'],
    },
    {
      id: 'campfire', kind: 'door', x: 18, y: 19, name: '林間營火', glow: 0xffa040, fx: 'fire', rest: true, talk: { script: 'ch1', node: 'campfire' },
      requires: { flag: 'ch1_legacy' }, done: 'ch1_campfire', lines: ['（熄掉的營火堆。等古燈塔的事告一段落再來休息吧。）'],
    },
    {
      id: 'fallen_log', kind: 'door', x: 18, y: 24, name: '倒木下的寶箱', glow: 0xffd27a, side: true,
      talk: { script: 'ch1', node: 'fallen_log' }, requires: { flag: 'ch1_legacy' }, done: 'ch1_fallen_log',
      lines: ['（倒木壓著什麼東西，一個人搬不動。）'],
    },
    {
      id: 'wolf_den', kind: 'door', x: 11, y: 32, name: '狼王巢穴', glow: 0xff5a5a, talk: { script: 'ch1', node: 'wolf_den' },
      requires: { flag: 'ch1_campfire' }, done: 'ch1_complete', lines: ['（巢穴深處傳來低吼。還沒準備好……先在營火整頓一下。）'],
    },
    { id: 'north_exit', kind: 'gate', x: 10, y: 0, name: '往霧角森林', to: { area: 'mistwood', spawn: 'south' } },
    { id: 'wolf_a', kind: 'enemy', x: 6, y: 7, battle: 'path_a', gold: 12, wander: 3 },
    { id: 'shroom_a', kind: 'enemy', x: 16, y: 13, battle: 'path_b', gold: 10, wander: 2 },
    { id: 'wolf_b', kind: 'enemy', x: 5, y: 24, battle: 'path_a', gold: 12, wander: 3 },
    { id: 'den_chest', kind: 'chest', x: 19, y: 27, loot: [{ gold: 50 }, { item: 'potion_s', count: 1 }, { item: 'armor_leather' }], lootText: '狼群叼來的行李。\n獲得 50 金幣、小回復藥 ×1、硬皮甲。' },
    { id: 'hidden_chest', kind: 'chest', hidden: true, x: 2, y: 4, loot: [{ item: 'shroom_cloak' }], lootText: '古燈塔的石縫裡塞著一個包袱。\n獲得 稀有・菇傘斗篷！' },
  ],
  props: [{ kind: 'bones', x: 3, y: 21 }, { kind: 'pillar', x: 19, y: 11 }, { kind: 'flowers', x: 7, y: 30 }, { kind: 'bones', x: 2, y: 26 }, { kind: 'bones', x: 3, y: 4 }, { kind: 'pillar', x: 15, y: 29 }],
};
