// 沉鐘礦坑（第 2 章，可走區域）：上層坑道（莉歐拉）→ 中層軌道岔口 → 鐘廳 → 坑道營火／翻倒的礦車 → 深層 → 鐘喉（Boss）。
// 北出口 → 礦工營地（minecamp.ts）。地塊：# 岩壁 _ 坑道地面 r 軌道 c 發光礦晶（見 src/core/explore/grid.ts）
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  '##########GG##########', // 0
  '##########rr##########', // 1
  '##########rr##########', // 2
  '###c______r_______c###', // 3
  '###_____#_r________###', // 4
  '###_______r________###', // 5
  '###_______r________###', // 6
  '####______r_______####', // 7
  '#####___##############', // 8
  '#####___##############', // 9
  '#####___##############', // 10
  '##________r___########', // 11
  '#c________r_#____c####', // 12
  '##________r______#####', // 13
  '##________r___########', // 14
  '#########_r_##########', // 15
  '#########_r_##########', // 16
  '##c________________c##', // 17
  '##__________________##', // 18
  '##____#________#____##', // 19
  '#c__________________c#', // 20
  '##__________________##', // 21
  '##____#________#____##', // 22
  '###________________###', // 23
  '##########___#########', // 24
  '##########___#########', // 25
  '##########___#########', // 26
  '##__________________##', // 27
  '#c__________________c#', // 28
  '##____________#_____##', // 29
  '##__________________##', // 30
  '#########___##########', // 31
  '#########___##########', // 32
  '#########___##########', // 33
  '###c______________c###', // 34
  '####__#________#__####', // 35
  '####______________####', // 36
  '######c________c######', // 37
  '#######________#######', // 38
  '######################', // 39
];

export const MINE: AreaDef = {
  id: 'mine',
  region: 'ch2',
  name: '沉鐘礦坑',
  night: true,
  mapNode: 'upper_tunnel',
  rows: ROWS,
  buildings: [],
  spawns: {
    default: { x: 10, y: 2 },
    north: { x: 10, y: 2 },
    upper_tunnel: { x: 15, y: 6 },
    mid_tunnel: { x: 5, y: 13 },
    bell_hall: { x: 10, y: 21 },
    mine_campfire: { x: 16, y: 29 },
    ore_cart: { x: 5, y: 29 },
    deep_level: { x: 10, y: 34 },
    bell_throat: { x: 11, y: 37 },
  },
  entities: [
    {
      id: 'upper_tunnel', kind: 'door', x: 16, y: 5, name: '上層坑道', glow: 0xffa040, talk: { script: 'ch2', node: 'upper_tunnel' },
      requires: { flag: 'ch2_camp_done' }, done: 'ch2_liora_joined', lines: ['（坑道深處傳來敲打聲……先回營地跟礦工們談談。）'],
    },
    {
      id: 'mid_tunnel', kind: 'door', x: 4, y: 12, name: '中層・軌道岔口', glow: 0x9fe8ff, talk: { script: 'ch2', node: 'mid_tunnel' },
      requires: { flag: 'ch2_liora_joined' }, done: 'ch2_mid_cleared', lines: ['（軌道在這裡分岔。上層好像有人在喊救命。）'],
    },
    {
      id: 'bell_hall', kind: 'door', x: 10, y: 20, name: '鐘廳', glow: 0xffd27a, talk: { script: 'ch2', node: 'bell_hall' },
      requires: { flag: 'ch2_mid_cleared' }, done: 'ch2_bell_done', lines: ['（巨大的空洞中央，有什麼東西在微微震動。）'],
    },
    {
      id: 'mine_campfire', kind: 'door', x: 16, y: 28, name: '坑道營火', glow: 0xffa040, fx: 'fire', rest: true, talk: { script: 'ch2', node: 'campfire' },
      requires: { flag: 'ch2_bell_done' }, done: 'ch2_campfire', lines: ['（礦工留下的柴堆。等鐘廳的事處理完再休息吧。）'],
    },
    {
      id: 'ore_cart', kind: 'door', x: 4, y: 29, name: '翻倒的礦車', glow: 0xd8b070, side: true, talk: { script: 'ch2', node: 'ore_cart' },
      requires: { flag: 'ch2_campfire' }, done: 'ch2_ore_cart', lines: ['（翻倒的礦車壓著什麼東西。）'],
    },
    {
      id: 'deep_level', kind: 'door', x: 10, y: 35, name: '深層', glow: 0xb080ff, talk: { script: 'ch2', node: 'deep_level' },
      requires: { flag: 'ch2_campfire' }, done: 'ch2_deep_done', lines: ['（往下的坑道被黑霧堵住了。先在營火整頓一下。）'],
    },
    {
      id: 'bell_throat', kind: 'door', x: 11, y: 38, name: '鐘喉', glow: 0xff5a5a, talk: { script: 'ch2', node: 'bell_throat' },
      requires: { flag: 'ch2_deep_done' }, done: 'ch2_complete', lines: ['（最深處傳來鐘聲般的低鳴……還沒準備好。）'],
    },
    { id: 'north_exit', kind: 'gate', x: 10, y: 0, name: '往礦工營地', to: { area: 'minecamp', spawn: 'mine' } },
    { id: 'beetle_a', kind: 'enemy', x: 14, y: 4, battle: 'mine_a', gold: 18, wander: 2 },
    { id: 'beetle_b', kind: 'enemy', x: 7, y: 13, battle: 'mine_a', gold: 18, wander: 2 },
    { id: 'wraith_a', kind: 'enemy', x: 4, y: 18, battle: 'mine_b', gold: 24, wander: 2 },
    { id: 'wraith_b', kind: 'enemy', x: 17, y: 21, battle: 'mine_b', gold: 24, wander: 2 },
    { id: 'wraith_c', kind: 'enemy', x: 14, y: 36, battle: 'mine_b', gold: 24, wander: 2 },
    { id: 'pocket_chest', kind: 'chest', x: 16, y: 13, loot: [{ gold: 40 }, { item: 'lantern_brass' }], lootText: '軌道盡頭的工具箱。\n獲得 40 金幣、黃銅掌燈。' },
    { id: 'hall_chest', kind: 'chest', x: 3, y: 21, loot: [{ item: 'staff_crystal' }], lootText: '鐘廳角落，晶石纏著一根木杖。\n獲得 霧晶杖。' },
    { id: 'camp_chest', kind: 'chest', x: 19, y: 30, loot: [{ gold: 60 }, { item: 'potion_m', count: 2 }], lootText: '礦工藏的補給。\n獲得 60 金幣、回復藥 ×2。' },
  ],
};
