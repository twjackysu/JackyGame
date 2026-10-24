// 王都（第 3 章，可走區域）：城門 → 星冠廣場 → 洛克的住處／燼牌大賽／夜市 → 星術研究院 → 旅店・深夜 → 鐘塔屋頂 → 黎明的廣場。
// 主線全部重用 ch3 劇本節點；完成旗標同 CHAPTER_MAPS.ch3.done（D-046）。
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  'WWWWWWWWWWWWWWWWWWWWWWWW', // 0
  'WT.........==.........TW', // 1
  'W..........==..........W', // 2
  'W..........==..........W', // 3
  'W..........==..........W', // 4
  'W..........==..........W', // 5
  'W..........==..........W', // 6
  'W..........==..........W', // 7
  'W======================W', // 8
  'W..........==.......T..W', // 9
  'W..,....L======L..,....W', // 10
  'W.......========.......W', // 11
  'W.......========.......W', // 12
  'W.......========.......W', // 13
  'W.......===oo===.......W', // 14
  'W.......========.......W', // 15
  'W.......========.......W', // 16
  'W.......========.......W', // 17
  'W.......L======L.......W', // 18
  'W..........==.......T..W', // 19
  'W======================W', // 20
  'W..L...L...==..........W', // 21
  'W.=======..==..........W', // 22
  'W.=======..==..........W', // 23
  'W.=======.L==L.........W', // 24
  'W.=======..==..........W', // 25
  'W.=======,.==.,........W', // 26
  'W.=======..==.......,..W', // 27
  'W.=======..==..........W', // 28
  'W..........==..........W', // 29
  'WT........L==L........TW', // 30
  'W..........==..........W', // 31
  'W..........==..........W', // 32
  'W.....,..T.==.T..,.....W', // 33
  'WT.........==.........TW', // 34
  'WWWWWWWWWWWGGWWWWWWWWWWW', // 35
];

export const CAPITAL: AreaDef = {
  id: 'capital',
  region: 'ch3',
  name: '王都・星冠城',
  night: true,
  mapNode: 'crown_plaza',
  rows: ROWS,
  buildings: [
    { x: 2, y: 2, w: 5, h: 5, roof: '#4a4a6a', wall: '#7a7488', sign: '鐘塔', lit: true },
    { x: 14, y: 2, w: 8, h: 5, roof: '#4a3a6a', wall: '#8a8098', sign: '星術研究院', lit: true },
    { x: 2, y: 12, w: 5, h: 4, roof: '#5a4a3a', wall: '#7a6a5a', sign: '旅舍', prop: 'prop_house_b' },
    { x: 17, y: 12, w: 6, h: 5, roof: '#6a3a2a', wall: '#7a5a48', sign: '燼牌大賽', lit: true, prop: 'prop_tavern' },
    { x: 15, y: 22, w: 6, h: 4, roof: '#3a4a6a', wall: '#7a7068', sign: '星光旅店', lit: true, prop: 'prop_house_a' },
  ],
  spawns: {
    default: { x: 11, y: 33 },
    gate: { x: 11, y: 33 },
    capital_gate: { x: 11, y: 33 },
    crown_plaza: { x: 11, y: 17 },
    rourke_lodging: { x: 4, y: 17 },
    tourney_hall: { x: 19, y: 18 },
    night_market: { x: 5, y: 27 },
    academy: { x: 17, y: 9 },
    inn_night: { x: 17, y: 27 },
    rooftop: { x: 4, y: 9 },
    crown_plaza_dawn: { x: 12, y: 17 },
  },
  entities: [
    {
      id: 'capital_gate', kind: 'npc', x: 12, y: 31, name: '城門隊長', look: { body: '#5a6a8a', hair: '#2a2a3a', art: 'walk_npc_guard' },
      talk: { script: 'ch3', node: 'gate' }, requires: { flag: 'ch2_complete' }, done: 'ch3_entered',
      lines: ['「王都歡迎你，掌燈人。別惹麻煩。」'],
    },
    {
      id: 'crown_plaza', kind: 'door', x: 11, y: 12, name: '星冠廣場', glow: 0xffd27a, talk: { script: 'ch3', node: 'plaza' },
      requires: { flag: 'ch3_entered' }, done: 'ch3_plaza_done', lines: ['（廣場上人山人海。先過城門吧。）'],
    },
    {
      id: 'rourke_lodging', kind: 'door', x: 4, y: 16, name: '洛克的住處', talk: { script: 'ch3', node: 'rourke_lodging' },
      requires: { flag: 'ch3_plaza_done' }, done: 'ch3_rourke_met', lines: ['（門關著。裡面好像沒人。）'],
    },
    {
      id: 'tourney_hall', kind: 'door', x: 19, y: 17, name: '燼牌大賽', talk: { script: 'ch3', node: 'tourney' },
      requires: { flag: 'ch3_plaza_done' }, done: 'ch3_tourney_done', lines: ['（大賽會場還在布置。）'],
    },
    {
      id: 'academy', kind: 'door', x: 17, y: 7, name: '星術研究院', talk: { script: 'ch3', node: 'academy' },
      requires: { all: [{ flag: 'ch3_tourney_done' }, { flag: 'ch3_rourke_met' }] }, done: 'ch3_academy_done',
      lines: ['守衛：「研究院不對外開放。」\n（先去大賽和洛克那邊看看吧。）'],
    },
    {
      id: 'inn_night', kind: 'door', x: 17, y: 26, name: '旅店・深夜', talk: { script: 'ch3', node: 'inn_night' },
      requires: { flag: 'ch3_academy_done' }, done: 'ch3_betrayal', lines: ['（星光旅店。今晚的房間已經訂好了。）'],
    },
    {
      id: 'rooftop', kind: 'door', x: 4, y: 7, name: '鐘塔屋頂', glow: 0xff9a5a, talk: { script: 'ch3', node: 'rourke_duel' },
      requires: { flag: 'ch3_betrayal' }, done: 'ch3_duel_done', lines: ['（鐘塔的門鎖著。）'],
    },
    {
      id: 'crown_plaza_dawn', kind: 'door', x: 12, y: 16, name: '黎明的廣場', glow: 0xffe6a0, talk: { script: 'ch3', node: 'ending' },
      requires: { flag: 'ch3_duel_done' }, done: 'ch3_complete', when: { flag: 'ch3_duel_done' },
    },
    {
      id: 'night_market', kind: 'npc', x: 5, y: 24, name: '夜市攤販', look: { body: '#8a5a3a', hair: '#3a2a1a', art: 'walk_npc_merchant' },
      talk: { script: 'ch3', node: 'night_market' }, requires: { flag: 'ch3_plaza_done' }, done: 'ch3_market_done', side: true,
      lines: ['「今晚的串燒特別香喔！」'],
    },
    { id: 'yard_fire', kind: 'door', x: 7, y: 26, name: '夜市的火盆', glow: 0xffa040, fx: 'fire', rest: true },
    {
      id: 'citizen_a', kind: 'npc', x: 14, y: 21, name: '王都市民', look: { body: '#6a7a9a', hair: '#4a3a2a', art: 'walk_npc_villager' }, wander: 2,
      lines: ['「聽說今年的燼牌大賽，冠軍能見到大司星本人！」', '「研究院的燈，整晚都亮著。他們到底在研究什麼？」'],
    },
    {
      id: 'citizen_b', kind: 'npc', x: 9, y: 9, name: '巡夜騎士', look: { body: '#c8d4ff', hair: '#5a5a6a', art: 'walk_npc_guard' }, wander: 2,
      lines: ['「夜市最近不太平，小心錢包。」', '「瓦爾德蘭大人……是王都的驕傲。」'],
    },
    { id: 'south_exit', kind: 'gate', x: 11, y: 35, name: '往世界地圖', to: 'map' },
    { id: 'tower_chest', kind: 'chest', x: 1, y: 2, loot: [{ gold: 80 }, { item: 'armor_mist' }], lootText: '鐘塔牆角的舊箱子。\n獲得 80 金幣、霧織長袍。' },
    { id: 'fountain_chest', kind: 'chest', x: 21, y: 29, loot: [{ item: 'gift_ribbon' }, { item: 'potion_m', count: 2 }], lootText: '花圃後面藏著一個小包裹。\n獲得 緞帶、回復藥 ×2。' },
  ],
};
