// 墜星裂谷（終章，可走區域）：裂谷邊緣 → 最後的營火（心之約定，也是營火選單）→ 墜星之心（蝕星者）。
// 地塊同礦坑，exploreArt 依 region === 'ch5' 換成暗紅岩壁＋粉色星晶（D-048）。
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  '#########GG#########', // 0
  '#########__#########', // 1
  '#########__#########', // 2
  '###c____________c###', // 3
  '####_____#______####', // 4
  '####____________####', // 5
  '####____________####', // 6
  '############___#####', // 7
  '############___c####', // 8
  '############___#####', // 9
  '#####__________#####', // 10
  '####___________#####', // 11
  '###c___#############', // 12
  '####___#############', // 13
  '####___#############', // 14
  '####____________####', // 15
  '####____________c###', // 16
  '####____#_______####', // 17
  '###c____________####', // 18
  '####____________####', // 19
  '#############___####', // 20
  '#############___####', // 21
  '#####c#######___c###', // 22
  '######__________####', // 23
  '######__________####', // 24
  '######___###########', // 25
  '####____________####', // 26
  '###c____________c###', // 27
  '####_______#____####', // 28
  '####____________####', // 29
  '###c____________c###', // 30
  '####################', // 31
];

export const RIFT: AreaDef = {
  id: 'rift',
  region: 'ch5',
  name: '墜星裂谷',
  night: true,
  mapNode: 'rift_edge',
  rows: ROWS,
  buildings: [],
  spawns: {
    default: { x: 9, y: 2 },
    north: { x: 9, y: 2 },
    rift_edge: { x: 10, y: 6 },
    last_campfire: { x: 10, y: 18 },
    rift_core: { x: 9, y: 27 },
  },
  entities: [
    {
      id: 'rift_edge', kind: 'door', x: 10, y: 5, name: '裂谷邊緣', glow: 0xffb0d8, talk: { script: 'ch5', node: 'descent' },
      requires: { flag: 'ch4_complete' }, done: 'ch5_descent',
    },
    {
      id: 'last_campfire', kind: 'door', x: 10, y: 17, name: '最後的營火', glow: 0xffa040, fx: 'fire', rest: true, talk: { script: 'ch5', node: 'vow' },
      requires: { flag: 'ch5_descent' }, done: 'ch5_vow', lines: ['（崖邊有一塊能避風的平台。）'],
    },
    {
      id: 'rift_core', kind: 'door', x: 9, y: 29, name: '墜星之心', glow: 0xff5a8a, talk: { script: 'ch5', node: 'core' },
      requires: { flag: 'ch5_vow' }, done: 'ch5_complete', lines: ['（裂谷最深處，星光在呼吸……還沒準備好。）'],
    },
    { id: 'north_exit', kind: 'gate', x: 9, y: 0, name: '往世界地圖', to: 'map' },
    { id: 'spawn_a', kind: 'enemy', x: 13, y: 9, battle: 'ch5_rift', gold: 50, wander: 1 },
    { id: 'spawn_b', kind: 'enemy', x: 5, y: 13, battle: 'ch5_rift', gold: 50, wander: 1 },
    { id: 'spawn_c', kind: 'enemy', x: 10, y: 24, battle: 'ch5_rift', gold: 50, wander: 2 },
    { id: 'ledge_chest', kind: 'chest', x: 15, y: 4, loot: [{ item: 'potion_m', count: 3 }, { item: 'gift_flower' }], lootText: '崖邊開著一朵不該在這裡的花。\n獲得 回復藥 ×3、野花束。' },
  ],
};
