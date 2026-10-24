// 礦工營地（第 2 章，可走區域）：多恩（主線）、補給站（商店）、礦工們。北出口回世界地圖、南邊坑口 → 沉鐘礦坑（mine.ts）。
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  'TTTTTTTTTTGGTTTTTTTTTT', // 0
  'TTTT.....::.....TTTTTT', // 1
  'TT.......::........TTT', // 2
  'T........::.........TT', // 3
  'T..,.....::.....,....T', // 4
  'T........::..........T', // 5
  'T....::::::::::::....T', // 6
  'T....::........::....T', // 7
  'T....::........::....T', // 8
  'T....::........::....T', // 9
  'T....::::::::::::....T', // 10
  'T.........::.........T', // 11
  '#.........::.........#', // 12
  '##........::........##', // 13
  '###.......::.......###', // 14
  '####......::......####', // 15
  '#####.....::.....#####', // 16
  '######....rr....######', // 17
  '#######c..rr..c#######', // 18
  '########..rr..########', // 19
  '#########_rr_#########', // 20
  '##########GG##########', // 21
];

export const MINECAMP: AreaDef = {
  id: 'minecamp',
  region: 'ch2',
  name: '礦工營地',
  mapNode: 'miners_camp',
  rows: ROWS,
  buildings: [
    { x: 1, y: 6, w: 4, h: 3, roof: '#7a5a3a', wall: '#5a4a3a' },
    { x: 17, y: 6, w: 4, h: 3, roof: '#5a4030', wall: '#6a5a48', sign: '工頭', lit: true, prop: 'prop_house_b' },
    { x: 8, y: 7, w: 6, h: 2, roof: '#3d5a48', wall: '#7a6a50', sign: '補給站', lit: true },
  ],
  spawns: {
    default: { x: 10, y: 2 },
    north: { x: 10, y: 2 },
    miners_camp: { x: 18, y: 10 },
    mine: { x: 10, y: 19 },
  },
  entities: [
    {
      id: 'miners_camp', kind: 'npc', x: 18, y: 11, name: '多恩', look: { body: '#6a5040', hair: '#3a2a1a', art: 'walk_npc_dorn' },
      talk: { script: 'ch2', node: 'miners_camp' }, requires: { flag: 'ch2_serin_joined' }, done: 'ch2_camp_done',
      lines: ['「礦坑養活了灰燈鎮三代人。」', '「深層的事……拜託你們了。」'],
    },
    {
      id: 'supplier', kind: 'npc', x: 11, y: 9, name: '補給站老闆', look: { body: '#8a6a3a', hair: '#5a3a1a', art: 'walk_npc_merchant' },
      talk: { script: 'ch2', node: 'camp_shop' }, shop: true,
    },
    {
      id: 'miner_a', kind: 'npc', x: 6, y: 4, name: '礦工', look: { body: '#5a5a6a', hair: '#2a2a2a', art: 'walk_npc_villager' }, wander: 2,
      lines: ['「最近坑道裡的燈，一盞盞自己熄掉。」', '「聽說深處有鐘聲。礦坑裡哪來的鐘？」'],
    },
    {
      id: 'miner_b', kind: 'npc', x: 15, y: 13, name: '礦工的孩子', look: { body: '#c87a5a', hair: '#5a3a2a', art: 'walk_npc_kid' }, wander: 2,
      lines: ['「爸爸說，掌燈人會帶光下去。」', '「坑口那些藍色的石頭，晚上會發光喔！」'],
    },
    { id: 'camp_fire', kind: 'door', x: 14, y: 4, name: '營地的火堆', glow: 0xffa040, fx: 'fire', rest: true },
    { id: 'north_exit', kind: 'gate', x: 10, y: 0, name: '往世界地圖', to: 'map' },
    {
      id: 'mine_gate', kind: 'gate', x: 10, y: 21, name: '沉鐘礦坑', to: { area: 'mine', spawn: 'north' }, requires: { flag: 'ch2_camp_done' },
      lines: ['礦工：「坑口現在誰也不准進——\n先去工頭小屋找多恩談談吧。」'],
    },
    {
      id: 'date_liora', kind: 'npc', date: true, x: 18, y: 6, name: '莉歐拉', look: { body: '#ff7a5a', hair: '#ff9a5a', hero: 'liora' },
      when: { all: [{ inParty: 'liora' }, { affinityAtLeast: ['liora', 25] }, { flag: 'date_liora', not: true }] },
      talk: { script: 'dates', node: 'liora_sparks' }, done: 'date_liora',
    },
    { id: 'hidden_chest', kind: 'chest', hidden: true, x: 1, y: 12, loot: [{ gold: 80 }, { item: 'potion_m', count: 2 }], lootText: '某個礦工的私房錢。\n獲得 80 金幣、回復藥 ×2。' },
  ],
  props: [{ kind: 'crate', x: 3, y: 14 }, { kind: 'barrel', x: 1, y: 11 }, { kind: 'cart', x: 7, y: 7 }, { kind: 'bench', x: 8, y: 18 }, { kind: 'crate', x: 15, y: 17 }, { kind: 'crate', x: 18, y: 2 }, { kind: 'barrel', x: 3, y: 2 }],
};
