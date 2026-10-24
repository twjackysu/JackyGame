// 霧角森林・入口（第 1 章，可走區域）：商隊支線、霧之湖（伊歐）、獵人小屋（伯恩），明雷霧狼。
// 北出口 → 灰燈鎮；南出口 → 狼徑・古燈塔（wolfpath.ts）。
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  'TTTTTTTTTTGGTTTTTTTTTT', // 0
  'TTTTTTTTT.::.TTTTTTTTT', // 1
  'TTTTTTT...::...TTTTTTT', // 2
  'TTTTT.....::.....TTTTT', // 3
  'TT..T.....::.,...T..TT', // 4
  'TT...T..,.::........TT', // 5
  'TT........::........TT', // 6
  'TT........::::::....TT', // 7
  'TT.T......::::::....TT', // 8
  'TT....,.......::T...TT', // 9
  'TT............::.T..TT', // 10
  'TT~~~~~~....T.::..T.TT', // 11
  'TT~~~~~~....T.::....TT', // 12
  'TT~~~~~~......::....TT', // 13
  'TT............::....TT', // 14
  'TT.......:::::::....TT', // 15
  'TT.,.....:::::::....TT', // 16
  'TT.......::.......T.TT', // 17
  'TT....T..::.........TT', // 18
  'TT...T...::.,.......TT', // 19
  'TT..T....::.....T...TT', // 20
  'TT.......::......T..TT', // 21
  'TT.......:::........TT', // 22
  'TT.......:::........TT', // 23
  'TT..,.....::........TT', // 24
  'TT........::...T....TT', // 25
  'TT...T....::........TT', // 26
  'TT....T...::.....,..TT', // 27
  'TTTTT.....::.....TTTTT', // 28
  'TTTTTTT...::...TTTTTTT', // 29
  'TTTTTTTTT.::.TTTTTTTTT', // 30
  'TTTTTTTTTTGGTTTTTTTTTT', // 31
];

export const MISTWOOD: AreaDef = {
  id: 'mistwood',
  region: 'ch1',
  name: '霧角森林',
  night: true,
  mapNode: 'hunter_hut',
  rows: ROWS,
  buildings: [
    { x: 16, y: 11, w: 4, h: 3, roof: '#4a3a2a', wall: '#6a5a48', sign: '獵人小屋', lit: true, prop: 'prop_house_b' },
  ],
  spawns: {
    default: { x: 10, y: 2 },
    north: { x: 10, y: 2 },
    south: { x: 10, y: 29 },
    forest_edge: { x: 13, y: 6 },
    mist_lake: { x: 9, y: 12 },
    hunter_hut: { x: 17, y: 15 },
  },
  entities: [
    {
      id: 'forest_edge', kind: 'npc', x: 15, y: 5, name: '受困的商人', look: { body: '#8a6a3a', hair: '#5a3a1a', art: 'walk_npc_merchant' },
      talk: { script: 'ch1', node: 'forest_edge' }, requires: { flag: 'ch1_left_town' }, done: 'ch1_caravan_done',
      lines: ['「多虧你們，商隊總算能上路了。」'],
    },
    {
      id: 'mist_lake', kind: 'door', x: 8, y: 12, name: '霧之湖', talk: { script: 'ch1', node: 'mist_lake' },
      requires: { flag: 'ch1_caravan_done' }, done: 'ch1_io_joined', lines: ['（湖面起了霧……好像有誰在唱歌。\n　先去幫幫路邊的商隊吧。）'],
    },
    {
      id: 'hunter_hut', kind: 'door', x: 17, y: 13, name: '獵人小屋', talk: { script: 'ch1', node: 'hunter_hut' },
      requires: { flag: 'ch1_io_joined' }, done: 'wick_hunter',
      waiting: { all: [{ any: [{ flag: 'bern_wait' }, { flag: 'bern_lost_cards' }] }, { flag: 'ch1_path_cleared', not: true }] },
      lines: ['（門鎖著。窗台上掛著乾燥的狼皮。）'],
    },
    { id: 'north_exit', kind: 'gate', x: 10, y: 0, name: '往灰燈鎮', to: { area: 'greylamp', spawn: 'gate' } },
    { id: 'south_exit', kind: 'gate', x: 10, y: 31, name: '往狼徑', to: { area: 'wolfpath', spawn: 'north' } },
    { id: 'signpost', kind: 'sign', x: 12, y: 3, name: '路標', lines: ['↑ 灰燈鎮\n↓ 狼徑・古燈塔遺跡\n→ 獵人小屋'] },
    { id: 'wolf_a', kind: 'enemy', x: 6, y: 7, battle: 'forest_a', gold: 8, wander: 3 },
    { id: 'wolf_b', kind: 'enemy', x: 5, y: 22, battle: 'forest_b', gold: 12, wander: 3 },
    { id: 'wolf_c', kind: 'enemy', x: 16, y: 24, battle: 'forest_a', gold: 8, wander: 3 },
    { id: 'lake_chest', kind: 'chest', x: 2, y: 16, loot: [{ item: 'potion_s', count: 2 }], lootText: '湖邊的蘆葦叢裡卡著一個背包。\n獲得 小回復藥 ×2。' },
    { id: 'hill_chest', kind: 'chest', x: 19, y: 4, loot: [{ gold: 40 }, { item: 'charm_ember' }], lootText: '樹洞裡藏著獵人的私房錢？\n獲得 40 金幣、餘燼護符。' },
  ],
};
