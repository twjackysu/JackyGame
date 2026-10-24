// 研究院地下（第 4 章，可走區域）：研究院入口 → 檔案室／收容區（支線）→ 實驗區 → 通風井的營火 → 星核爐。
// 地塊與礦坑相同（# _ c），配色在 exploreArt 依區域換成藍紫色的實驗室（D-047）。
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  '##########GG##########', // 0
  '##########__##########', // 1
  '##########__##########', // 2
  '##########__##########', // 3
  '####c____________c####', // 4
  '#####____________#####', // 5
  '#####____________#####', // 6
  '#####____________#####', // 7
  '##########__##########', // 8
  '##########__##########', // 9
  '##__________________##', // 10
  '#c__________________c#', // 11
  '##______##__##______##', // 12
  '##______##__##______##', // 13
  '##______##__##______##', // 14
  '##______##__##__#___##', // 15
  '##______##__##______##', // 16
  '##c#______________#c##', // 17
  '###________________###', // 18
  '###____#______#____###', // 19
  '##c________________c##', // 20
  '###____#______#____###', // 21
  '###________________###', // 22
  '####______________####', // 23
  '##########__##########', // 24
  '##########__##########', // 25
  '##_______#__#_______##', // 26
  '#c__________________##', // 27
  '##__________________c#', // 28
  '##_______####_______##', // 29
  '#############_______##', // 30
  '#############c_____c##', // 31
  '##############_____###', // 32
  '######################', // 33
];

export const DEPTHS: AreaDef = {
  id: 'depths',
  region: 'ch4',
  name: '星術研究院・地下',
  night: true,
  mapNode: 'archive',
  rows: ROWS,
  buildings: [],
  spawns: {
    default: { x: 10, y: 2 },
    north: { x: 10, y: 2 },
    academy_entrance: { x: 11, y: 6 },
    archive: { x: 5, y: 13 },
    holding_cells: { x: 16, y: 13 },
    lab: { x: 10, y: 21 },
    hidden_camp: { x: 5, y: 27 },
    star_furnace: { x: 16, y: 31 },
  },
  entities: [
    {
      id: 'academy_entrance', kind: 'door', x: 10, y: 5, name: '研究院入口', glow: 0x9fe8ff, talk: { script: 'ch4', node: 'infiltrate' },
      requires: { flag: 'ch3_complete' }, done: 'ch4_entered',
    },
    {
      id: 'archive', kind: 'door', x: 4, y: 13, name: '研究檔案室', glow: 0xffd27a, talk: { script: 'ch4', node: 'archive' },
      requires: { flag: 'ch4_entered' }, done: 'ch4_archive_done', lines: ['（檔案室的門上了鎖。先找到進來的路吧。）'],
    },
    {
      id: 'holding_cells', kind: 'door', x: 17, y: 13, name: '收容區', glow: 0xb080ff, side: true, talk: { script: 'ch4', node: 'cells' },
      requires: { flag: 'ch4_entered' }, done: 'ch4_cells_done', lines: ['（鐵欄後面，好像有人在哭。）'],
    },
    {
      id: 'lab', kind: 'door', x: 10, y: 20, name: '實驗區', glow: 0x7fe0ff, talk: { script: 'ch4', node: 'lab' },
      requires: { flag: 'ch4_archive_done' }, done: 'ch4_lab_done', lines: ['（實驗區的門需要權限。檔案室裡也許有線索。）'],
    },
    {
      id: 'hidden_camp', kind: 'door', x: 4, y: 27, name: '通風井的營火', glow: 0xffa040, fx: 'fire', rest: true, talk: { script: 'ch4', node: 'camp' },
      requires: { flag: 'ch4_lab_done' }, done: 'ch4_campfire', lines: ['（通風井下有一小塊乾燥的空地。）'],
    },
    {
      id: 'star_furnace', kind: 'door', x: 16, y: 32, name: '星核爐', glow: 0xff5a5a, talk: { script: 'ch4', node: 'furnace' },
      requires: { flag: 'ch4_campfire' }, done: 'ch4_complete', lines: ['（爐心傳來低沉的脈動……先休息一下再進去。）'],
    },
    {
      id: 'contact_shop', kind: 'npc', x: 6, y: 6, name: '內應研究員', look: { body: '#6a6a9a', hair: '#2a2a3a', art: 'walk_npc_villager' },
      talk: { script: 'ch4', node: 'depths_shop' }, shop: true,
    },
    { id: 'north_exit', kind: 'gate', x: 10, y: 0, name: '往世界地圖', to: 'map' },
    { id: 'guard_a', kind: 'enemy', x: 15, y: 10, battle: 'ch4_gate', gold: 30, wander: 2 },
    { id: 'proto_a', kind: 'enemy', x: 5, y: 19, battle: 'ch4_lab_a', gold: 35, wander: 2 },
    { id: 'golem_a', kind: 'enemy', x: 16, y: 22, battle: 'ch4_lab_b', gold: 40, wander: 2 },
    { id: 'proto_b', kind: 'enemy', x: 15, y: 27, battle: 'ch4_lab_a', gold: 35, wander: 2 },
    { id: 'archive_chest', kind: 'chest', x: 2, y: 16, loot: [{ gold: 100 }, { item: 'sword_dawn' }], lootText: '檔案櫃底層藏著一把劍。\n獲得 100 金幣、破曉之劍。' },
    { id: 'cells_chest', kind: 'chest', x: 19, y: 12, loot: [{ item: 'gift_book' }, { item: 'potion_m', count: 2 }], lootText: '看守的置物箱。\n獲得 舊書、回復藥 ×2。' },
    { id: 'furnace_chest', kind: 'chest', x: 19, y: 29, loot: [{ item: 'lantern_star' }], lootText: '星核的餘燼凝成了一盞燈。\n獲得 星燼提燈。' },
    { id: 'hidden_chest', kind: 'chest', hidden: true, x: 18, y: 18, loot: [{ item: 'proto_staff' }], lootText: '廢棄實驗台下的保險箱。\n獲得 稀有・原型晶核杖！' },
  ],
  props: [{ kind: 'shelf', x: 12, y: 17 }, { kind: 'flask', x: 9, y: 17 }, { kind: 'crate', x: 14, y: 15 }, { kind: 'shelf', x: 10, y: 15 }, { kind: 'flask', x: 15, y: 19 }, { kind: 'pillar', x: 9, y: 27 }, { kind: 'shelf', x: 18, y: 19 }, { kind: 'flask', x: 6, y: 10 }, { kind: 'crate', x: 10, y: 12 }, { kind: 'shelf', x: 12, y: 10 }, { kind: 'flask', x: 11, y: 24 }, { kind: 'pillar', x: 16, y: 6 }],
};
