// 灰燈鎮（第 1 章，可走區域）。主線入口重用 ch1 劇本節點（孤兒院／酒館／雜貨店／鎮門）。
// 地塊：. 草 , 花 = 石板路 G 城門 T 樹 ~ 水 L 路燈 W 城牆 o 井（見 src/core/explore/grid.ts）
import type { AreaDef } from '../../core/explore/area';

const ROWS = [
  'TTTTTTTTTTTTTTTTTTTTTT', // 0
  'TT..,.......TTTT..,.TT', // 1
  'T...................TT', // 2
  'T....................T', // 3
  'T....................T', // 4
  'T,...................T', // 5
  'T....=.......~~~~....T', // 6
  'T....=......~~~~~~...T', // 7
  'T....=.......~~~~....T', // 8
  'T....=======.........T', // 9
  'T.........==.........T', // 10
  'T.........==.........T', // 11
  'T.....=L======L=.....T', // 12
  'T.....==========.....T', // 13
  'T.....====oo====.....T', // 14
  'T.....==========.....T', // 15
  'T..================..T', // 16
  'T.....=L======L=.....T', // 17
  'T.........==.........T', // 18
  'T.........==.........T', // 19
  'T.........==.........T', // 20
  'T.........==.........T', // 21
  'T.........==.........T', // 22
  'T.........==.........T', // 23
  'T,........==........,T', // 24
  'T..,......==.....,...T', // 25
  'T.........==.........T', // 26
  'T.........==.........T', // 27
  'T..TT.....==.....TT..T', // 28
  'WWWWWWWWWWGGWWWWWWWWWW', // 29
  'TTTT......==......TTTT', // 30
  'TTTTTT....==....TTTTTT', // 31
  'TTTTTTTT..==..TTTTTTTT', // 32
  'TTTTTTTTT.==.TTTTTTTTT', // 33
];

const LANTERN = { flag: 'ch1_got_lantern' };

export const GREYLAMP: AreaDef = {
  id: 'greylamp',
  region: 'ch1',
  name: '灰燈鎮',
  night: true,
  mapNode: 'town_gate',
  rows: ROWS,
  buildings: [
    { x: 2, y: 2, w: 7, h: 4, roof: '#5a3a4a', wall: '#8a7060', sign: '孤兒院', lit: true, prop: 'prop_house_a' },
    { x: 1, y: 12, w: 5, h: 4, roof: '#3d5a48', wall: '#8a7a5a', sign: '雜貨', lit: true, prop: 'prop_shop' },
    { x: 16, y: 11, w: 5, h: 5, roof: '#6a3a2a', wall: '#7a5a48', sign: '醉燈', lit: true, prop: 'prop_tavern' },
    { x: 2, y: 20, w: 5, h: 4, roof: '#40486a', wall: '#7a7068', prop: 'prop_house_b' },
    { x: 15, y: 20, w: 5, h: 4, roof: '#5a4a3a', wall: '#7a6a5a', lit: true, prop: 'prop_house_a' },
  ],
  spawns: {
    default: { x: 5, y: 7 },
    plaza: { x: 10, y: 18 },
    gate: { x: 10, y: 27 },
    // 世界地圖的鎮內節點 → 站在該建築門口
    orphanage: { x: 5, y: 7 },
    tavern: { x: 18, y: 17 },
    general_store: { x: 3, y: 17 },
    town_gate: { x: 10, y: 27 },
  },
  entities: [
    // ── 主線入口（門）──
    {
      id: 'orphanage', kind: 'door', x: 5, y: 5, name: '孤兒院', talk: { script: 'ch1', node: 'orphanage' }, done: 'ch1_got_lantern',
    },
    {
      id: 'tavern', kind: 'door', x: 18, y: 15, name: '酒館「醉燈」', talk: { script: 'ch1', node: 'tavern' }, requires: LANTERN,
      done: 'ch1_rourke_joined', lines: ['（門裡傳來笑聲和洗牌聲。先回孤兒院一趟吧。）'],
    },
    {
      id: 'store', kind: 'door', x: 3, y: 15, name: '雜貨店', talk: { script: 'ch1', node: 'store' }, requires: LANTERN, shop: true,
      lines: ['（「今日休息」的牌子歪掛著……托比應該在後面理貨。）'],
    },
    // ── 鎮門：踩上去觸發 ──
    {
      id: 'gate', kind: 'gate', x: 10, y: 29, name: '鎮門', talk: { script: 'ch1', node: 'town_gate' },
      requires: { flag: 'ch1_rourke_joined' }, done: 'ch1_left_town', to: { area: 'mistwood', spawn: 'north' },
      lines: ['守衛：「一個人出鎮？森林裡的狼可不挑食。\n　　　先去酒館找個能打的同伴吧。」'],
    },
    // ── 鎮民（閒聊、提示）──
    {
      id: 'guard', kind: 'npc', x: 12, y: 28, name: '守衛', look: { body: '#5a6a8a', hair: '#3a2a20', art: 'walk_npc_guard' },
      lines: [
        '「掌燈人？這年頭還有人做這行啊。」',
        '「路燈一盞盞熄了，鎮長說沒錢添油。」',
        '「森林最近有狼群，連商隊都不敢走。」',
      ],
    },
    {
      id: 'lamplighter', kind: 'npc', x: 8, y: 13, name: '老燈伕', look: { body: '#6a5a40', hair: '#d8d8d8', art: 'walk_npc_lamplighter' }, wander: 1,
      // 支線「廣場的四盞燈」：拿到舊提燈後開放
      talk: { script: 'ch1', node: 'lamplighter' }, requires: LANTERN, side: true, done: 'q_lamps_rewarded',
      lines: [
        '「燈芯要剪平，火才會穩。這是我師父說的。」',
        '「廣場那四盞，是我年輕時親手掛上去的。」',
        '「你拿著舊提燈？……那盞燈，好像在哪見過。」',
      ],
    },
    {
      id: 'kid', kind: 'npc', x: 12, y: 10, name: '孤兒院的孩子', look: { body: '#c87a5a', hair: '#7a4a2a', art: 'walk_npc_kid' }, wander: 2,
      lines: [
        '「連恩哥哥回來了！瑪菈院長一直在等你喔。」',
        '「湖邊那棵樹後面，有亮亮的東西！」',
        '「我長大也要當掌燈人！」',
      ],
    },
    {
      id: 'villager', kind: 'npc', x: 9, y: 22, name: '鎮民', look: { body: '#6a8a6a', hair: '#4a3a2a', art: 'walk_npc_villager' }, wander: 2,
      lines: [
        '「酒館的洛克又在贏錢了，誰都打不贏他。」',
        '「聽說燼牌打得好，在王都能當上貴族的座上賓呢。」',
        '「雜貨店的托比人很好，就是愛抱怨。」',
      ],
    },
    {
      id: 'notice', kind: 'sign', x: 9, y: 16, name: '告示板',
      lines: ['【告示】森林狼群出沒，非必要請勿出鎮。\n　　　　——灰燈鎮自衛團', '【徵人】酒館「醉燈」誠徵燼牌對手。\n　　　　贏了老兵洛克者，酒錢全免。'],
    },
    // ── 支線：廣場四盞熄滅的路燈（requires 的旗標＝接下支線後才能點） ──
    ...([[7, 12], [14, 12], [7, 17], [14, 17]] as const).map(([x, y], i) => ({
      id: `plaza_lamp_${i + 1}`, kind: 'lamp' as const, x, y, name: '熄滅的路燈', requires: { flag: 'q_lamps' },
      lines: ['（路燈熄了，燈罩裡積滿灰。\n廣場上那位老燈伕，好像一直望著這裡。）'],
    })),
    // ── 第 2 章：瑟琳在廣場等你（ch2 plaza） ──
    {
      id: 'serin_plaza', kind: 'npc', x: 9, y: 15, name: '瑟琳', look: { body: '#c8d4ff', hair: '#e8e8f0', hero: 'serin' },
      talk: { script: 'ch2', node: 'plaza' }, done: 'ch2_serin_joined', after: 'map',
      when: { all: [{ flag: 'ch1_complete' }, { flag: 'ch2_serin_joined', not: true }] },
    },
    // ── 支線：霧菇與紅頭巾（露絲 → 森林蕈圈的米亞） ──
    {
      id: 'ruth', kind: 'npc', x: 16, y: 25, name: '露絲', look: { body: '#8a6a8a', hair: '#5a3a2a', art: 'walk_npc_ruth' },
      talk: { script: 'ch1', node: 'ruth' }, requires: LANTERN, side: true, done: 'q_lost_kid_done',
      lines: ['（一位婦人在家門口來回踱步，不時望向鎮門。）'],
    },
    {
      id: 'mia_home', kind: 'npc', x: 18, y: 25, name: '米亞', look: { body: '#c84040', hair: '#7a4a2a', art: 'walk_npc_mia' }, wander: 1,
      when: { flag: 'q_lost_kid_done' },
      lines: ['「大哥哥！項鍊有保護你嗎？」', '「下次採蘑菇，我會帶媽媽一起去。」'],
    },
    // ── 支線：流浪牌手（燼牌，可重複挑戰） ──
    {
      id: 'drifter', kind: 'npc', x: 13, y: 14, name: '流浪牌手', look: { body: '#4a4a6a', hair: '#2a2a2a', art: 'walk_npc_drifter' },
      talk: { script: 'ch1', node: 'drifter' }, requires: LANTERN, side: true, done: 'drifter_beaten',
      lines: ['「燼牌？等你拿到提燈再說吧，小鬼。」'],
    },
    // ── 寶箱 ──
    { id: 'pond_chest', kind: 'chest', x: 19, y: 8, loot: [{ gold: 30 }, { item: 'armor_cloth' }], lootText: '湖畔的樹根下藏著一個包袱。\n獲得 30 金幣、旅人布衣。' },
    { id: 'garden_chest', kind: 'chest', x: 20, y: 25, loot: [{ item: 'potion_s', count: 1 }], lootText: '花叢裡有個舊木箱。\n獲得 小回復藥 ×1。' },
  ],
};
