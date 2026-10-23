// 第 2 章「沉鐘」。來源：docs/design/10-story-ch2-final.md §第 2 章、02-world-and-story.md §5。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
//
// 與第 1 章相同，由節點地圖（MapScene）驅動：點擊地點 → 從 CH2_ENTRIES 的入口節點開始，
// 跑到節點結尾（'end'）後交回地圖。進度以 ch2_* 旗標推進。
//
// 本章新增旗標：
//   ch2_serin_joined / ch2_camp_done / ch2_liora_joined / ch2_mid_cleared / ch2_bell_done /
//   ch2_campfire / ch2_ore_cart / ch2_deep_done / ch2_complete（進度）
//   ch2_compromise（礦坑折衷方案）、liora_fuse_saved（筆記拆引線）、liora_cards_won
//   serin_told_future / serin_warned / serin_solo（關鍵選擇）、serin_saved / serin_scar
//   bond_serin_1 / bond_liora_1、academy_mark（研究院刻印）、serin_stayed / serin_left_ch2
import type { DialogueScript } from '../../core/dialogue/runner';
import type { Condition } from '../../core/state/gameState';

/** 地圖入口（依劇情順序）。node = 點擊地點時要啟動的節點。 */
export const CH2_ENTRIES: { node: string; location: string; title: string; requires?: Condition }[] = [
  { node: 'plaza', location: 'greylamp_plaza', title: '灰燈鎮廣場', requires: { flag: 'ch1_complete' } },
  { node: 'miners_camp', location: 'miners_camp', title: '礦工營地', requires: { flag: 'ch2_serin_joined' } },
  { node: 'upper_tunnel', location: 'upper_tunnel', title: '上層坑道', requires: { flag: 'ch2_camp_done' } },
  { node: 'mid_tunnel', location: 'mid_tunnel', title: '中層・軌道岔口', requires: { flag: 'ch2_liora_joined' } },
  { node: 'bell_hall', location: 'bell_hall', title: '鐘廳', requires: { flag: 'ch2_mid_cleared' } },
  { node: 'campfire', location: 'mine_campfire', title: '坑道營火', requires: { flag: 'ch2_bell_done' } },
  { node: 'ore_cart', location: 'ore_cart', title: '翻倒的礦車', requires: { flag: 'ch2_campfire' } },
  { node: 'deep_level', location: 'deep_level', title: '深層', requires: { flag: 'ch2_campfire' } },
  { node: 'bell_throat', location: 'bell_throat', title: '鐘喉', requires: { flag: 'ch2_deep_done' } },
];

export const CH2: DialogueScript = {
  id: 'ch2',
  start: 'plaza',
  nodes: {
    // ───────── 2-1 灰燈鎮廣場 ─────────
    plaza: [
      { goto: 'plaza_revisit', if: { flag: 'ch2_serin_joined' } },
      { say: 'narration', text: '〔廣場的噴水池旁，銀甲在陽光下發亮。〕' },
      { say: 'serin', text: '騎士團見習生，瑟琳·艾凡斯。\n奉命調查沉鐘礦坑的蝕化事件。' },
      { say: 'serin', text: '……你就是那個掌燈人。', if: { flag: 'serin_met', not: true } },
      { say: 'serin', text: '掌燈人。光柱的事，我還沒問完。', if: { flag: 'serin_met' } },
      { say: 'lian_inner', text: '（瑟琳·艾凡斯。原作第二章，\n她會在礦坑深處獨自衝鋒——然後不再回來。）' },
      {
        say: 'lian_inner',
        text: '（攻略筆記：「沉鐘礦坑」。這一頁，我讀過太多次。）',
        effects: [{ codex: 'serin_fate' }],
      },
      { say: 'serin', text: '隊長的星核……後來被查出來了。', if: { flag: 'exposed_captain' } },
      {
        say: 'serin',
        text: '你是怎麼知道的？',
        if: { flag: 'exposed_captain' },
        effects: [{ affinity: 'serin', delta: 5 }],
      },
      { say: 'lian', text: '直覺。掌燈人的直覺。', if: { flag: 'exposed_captain' } },
      { say: 'lian_inner', text: '（以及一本她看不見的攻略。）', if: { flag: 'exposed_captain' } },
      { say: 'serin', text: '礦坑裡沒有光，騎士團的地圖也過時了。\n我需要一個掌燈人帶路。' },
      { say: 'io', text: '連恩，她的劍好亮喔。可以摸嗎？' },
      { say: 'serin', text: '……不可以。' },
      {
        choice: [
          {
            text: '「好，我帶路。但下面我說停，妳就停。」',
            effects: [{ affinity: 'serin', delta: 5 }],
            next: 'plaza_accept',
          },
          { text: '「掌燈人很貴喔。」', next: 'plaza_fee' },
        ],
      },
    ],
    plaza_fee: [
      { say: 'serin', text: '騎士團會付。……按規定的時薪。' },
      { say: 'lian_inner', text: '（規定的時薪。原來騎士團也有「勞基法」。）' },
      { goto: 'plaza_accept' },
    ],
    plaza_accept: [
      { say: 'serin', text: '成交。別拖我後腿，掌燈人。' },
      {
        say: 'narration',
        text: '〔瑟琳加入了隊伍。〕',
        effects: [{ join: 'serin' }, { flag: 'ch2_serin_joined' }, { quest: 'ch2_mine', stage: 1 }],
      },
      { say: 'lian_inner', text: '（這次，我會讓她走出礦坑。\n用走的，不是用抬的。）' },
      { goto: 'end' },
    ],
    plaza_revisit: [
      { say: 'narration', text: '〔噴水池叮咚作響。遠方的礦坑傳來鐘聲。〕' },
      { goto: 'end' },
    ],

    // ───────── 2-2 礦坑入口・礦工營地 ─────────
    miners_camp: [
      { goto: 'camp_revisit', if: { flag: 'ch2_camp_done' } },
      { say: 'narration', text: '〔礦坑入口。礦工們舉著鎬，\n擋在一排騎士面前。〕' },
      { say: 'knight', text: '奉騎士團命令，礦坑即日起封閉！' },
      { say: 'dorn', text: '封了，我們吃什麼？吃石頭嗎？' },
      { say: 'dorn', text: '我是礦工公會的多恩。這礦，\n養活了灰燈鎮三代人。' },
      { say: 'serin', text: '深處有蝕化。再挖下去，會死人。' },
      { say: 'miner', text: '不挖，也會餓死人啊！' },
      { say: 'lian_inner', text: '（經典的兩難。原作這裡沒有選項，\n騎士團直接封礦，礦工公會從此敵視騎士團。）' },
      {
        choice: [
          {
            text: '「礦工有權決定自己的礦。」',
            effects: [{ rep: 'miners', delta: 15 }, { rep: 'order', delta: -10 }],
            next: 'camp_miners',
          },
          {
            text: '「蝕化不是開玩笑的，先封礦。」',
            effects: [{ rep: 'order', delta: 10 }, { rep: 'miners', delta: -15 }, { affinity: 'serin', delta: 3 }],
            next: 'camp_order',
          },
          {
            text: '「只封深層，上層照常開工。」',
            check: { stat: 'cha', dc: 6 },
            effects: [
              { rep: 'miners', delta: 5 },
              { rep: 'order', delta: 5 },
              { flag: 'ch2_compromise' },
              { divergence: 2 },
            ],
            next: 'camp_compromise',
            fail: 'camp_compromise_fail',
          },
        ],
      },
    ],
    camp_miners: [
      { say: 'dorn', text: '說得好！小子，你懂礦工。' },
      { say: 'serin', text: '……你這樣讓我很難交代。' },
      { say: 'lian', text: '那就交代「深處的東西我們會處理」。' },
      { goto: 'camp_done' },
    ],
    camp_order: [
      { say: 'dorn', text: '哼。騎士團的狗。' },
      { say: 'serin', text: '……謝謝你站在正確的一邊。' },
      { say: 'lian_inner', text: '（正確的一邊，通常只是比較大聲的那邊。）' },
      { goto: 'camp_done' },
    ],
    camp_compromise: [
      { say: 'dorn', text: '……上層照常？那還行。' },
      { say: 'knight', text: '深層封鎖的話，我們也能回報了。' },
      { say: 'serin', text: '你……很會說話。這是稱讚。大概。' },
      { goto: 'camp_done' },
    ],
    camp_compromise_fail: [
      { say: 'dorn', text: '折衷？折到最後，倒楣的總是我們。' },
      { say: 'knight', text: '外人別插嘴。' },
      { say: 'lian_inner', text: '（兩邊都不買帳。外交果然不是點燈。）' },
      { goto: 'camp_done' },
    ],
    camp_done: [
      { say: 'dorn', text: '對了……上層坑道今早炸了一聲，\n有個怪丫頭進去之後就沒出來。' },
      { say: 'lian_inner', text: '（怪丫頭。爆炸。——是她。）' },
      {
        say: 'narration',
        text: '〔礦坑入口開放了。〕',
        effects: [{ flag: 'ch2_camp_done' }, { quest: 'ch2_mine', stage: 2 }],
      },
      { goto: 'end' },
    ],
    camp_revisit: [
      { say: 'dorn', text: '下面的事，就拜託你們了。', if: { repAtLeast: ['miners', 10] } },
      { say: 'miner', text: '……騎士團的人又來了。', if: { repAtLeast: ['order', 10] } },
      { say: 'narration', text: '〔營地裡飄著燉豆子的味道。〕' },
      { goto: 'end' },
    ],

    // ───────── 2-3 上層坑道：莉歐拉 ─────────
    upper_tunnel: [
      { goto: 'upper_revisit', if: { flag: 'ch2_liora_joined' } },
      { say: 'narration', text: '〔坑道裡瀰漫焦味。碎石堆後，有人在喊。〕' },
      { say: 'liora', text: '有人嗎——！我被我的天才發明\n困住了！不是失敗，是「意外的成功」！' },
      { say: 'serin', text: '……先處理附近的魔物。' },
      { goto: 'upper_fight' },
    ],
    upper_fight: [
      { event: 'battle', id: 'mine_a', outcomes: { win: 'upper_rescue', lose: 'upper_retry' } },
    ],
    upper_retry: [
      { say: 'lian_inner', text: '（岩甲蟲很硬。先破防，再打。）' },
      { goto: 'upper_fight' },
    ],
    upper_rescue: [
      { say: 'narration', text: '〔碎石縫裡，一台冒煙的機關滴答作響。〕' },
      { say: 'liora', text: '喔對，那台還沒炸完。大概三十秒。' },
      { say: 'serin', text: '「大概」？！' },
      {
        say: 'lian_inner',
        text: '（莉歐拉的星燼機關……原作攻略寫過：\n拔藍色引線，留紅色。）',
        effects: [{ codex: 'liora_fuse' }],
      },
      {
        choice: [
          {
            text: '拔掉藍色引線。',
            check: { codex: 'liora_fuse' },
            effects: [{ flag: 'liora_fuse_saved' }, { affinity: 'liora', delta: 5 }, { divergence: 2 }],
            next: 'upper_defused',
          },
          { text: '「全員退後！」', next: 'upper_boom' },
        ],
      },
    ],
    upper_defused: [
      { say: 'narration', text: '〔滴答聲停了。〕' },
      { say: 'liora', text: '……欸？你怎麼知道是藍色？\n連我都是用猜的耶！' },
      { say: 'lian', text: '……也是用猜的。' },
      { say: 'lian_inner', text: '（猜了大概三百次，在前世的存檔裡。）' },
      { goto: 'upper_meet' },
    ],
    upper_boom: [
      { say: 'narration', text: '〔轟！碎石堆被炸開一個洞。〕' },
      { say: 'liora', text: '看吧！出口！我就說是意外的成功！' },
      { say: 'serin', text: '妳的頭髮在冒煙。' },
      { goto: 'upper_meet' },
    ],
    upper_meet: [
      { say: 'liora', text: '我是莉歐拉，流浪鍊金術師！\n專長是發明，副專長是爆炸。' },
      { say: 'liora', text: '說正經的——深處有東西\n在「吃」星燼礦脈。' },
      { say: 'liora', text: '整條礦脈的光，一夜之間變暗。\n像被誰喝掉一樣。' },
      { say: 'serin', text: '那正是我們要調查的事。' },
      { say: 'liora', text: '那帶我去！不過——先打一局燼牌？\n我的規矩：先打牌，再交朋友。' },
      { say: 'io', text: '燼牌！我會！洛克叔叔教過！' },
      { say: 'liora', text: '那今天教你們「月相」。\n夜晚的牌，會隨月亮變強喔。' },
      { event: 'cards', id: 'liora_intro', outcomes: { win: 'upper_cards_win', lose: 'upper_cards_lose' } },
    ],
    upper_cards_win: [
      { say: 'liora', text: '哇，第一次就贏我？你作弊了吧！\n……開玩笑的。這個給你。' },
      {
        say: 'narration',
        text: '〔取得「爆燈瓶」×2。〕',
        effects: [{ item: 'blast_bottle', count: 2 }, { affinity: 'liora', delta: 5 }, { flag: 'liora_cards_won' }],
      },
      { goto: 'upper_join' },
    ],
    upper_cards_lose: [
      { say: 'liora', text: '嘿嘿，我贏了！不過你很有天分，\n這個當學費——反過來的那種。' },
      { say: 'narration', text: '〔取得「爆燈瓶」。〕', effects: [{ item: 'blast_bottle' }] },
      { goto: 'upper_join' },
    ],
    upper_join: [
      { say: 'liora', text: '好，決定了！我加入！\n反正我的工作室剛剛炸掉了。' },
      {
        say: 'narration',
        text: '〔莉歐拉加入了隊伍。〕',
        effects: [{ join: 'liora' }, { flag: 'ch2_liora_joined' }, { quest: 'ch2_mine', stage: 3 }],
      },
      { say: 'narration', text: '〔隊伍已滿四人。戰鬥上場三人，\n可在選單「隊伍」頁替換。〕' },
      { say: 'lian_inner', text: '（莉歐拉。原作中被研究院利用，\n最後失蹤的天才。……這條線，也要改。）' },
      { goto: 'end' },
    ],
    upper_revisit: [
      { say: 'liora', text: '這面牆的焦痕，是我的代表作喔。' },
      { goto: 'end' },
    ],

    // ───────── 中層・軌道岔口 ─────────
    mid_tunnel: [
      { goto: 'mid_revisit', if: { flag: 'ch2_mid_cleared' } },
      { say: 'narration', text: '〔鐘聲。整條坑道跟著震了一下。〕' },
      { say: 'io', text: '……石頭在唱歌。好難過的歌。' },
      { say: 'liora', text: '幽魂討厭光喔，連恩。你的燈很好用。' },
      { goto: 'mid_fight' },
    ],
    mid_fight: [
      { event: 'battle', id: 'mine_b', outcomes: { win: 'mid_won', lose: 'mid_retry' } },
    ],
    mid_retry: [
      { say: 'lian_inner', text: '（幽魂怕光，蜥蜴怕水。別硬碰硬。）' },
      { goto: 'mid_fight' },
    ],
    mid_won: [
      { say: 'serin', text: '你的燈……比我想的有用。' },
      { say: 'lian', text: '這句話我要裱框。' },
      { say: 'serin', text: '敢裱就砍你。' },
      { say: 'narration', text: '〔岔口深處，傳來比剛才更沉的鐘聲。〕', effects: [{ flag: 'ch2_mid_cleared' }] },
      { goto: 'end' },
    ],
    mid_revisit: [
      { say: 'narration', text: '〔廢棄的軌道延伸進黑暗。〕' },
      { goto: 'end' },
    ],

    // ───────── 2-4 鐘廳 ─────────
    bell_hall: [
      { goto: 'hall_revisit', if: { flag: 'ch2_bell_done' } },
      { say: 'narration', text: '〔巨大的古鐘懸在岩頂。\n每響一次，整座礦坑就震動一次。〕' },
      { say: 'liora', text: '這鐘不是礦工做的。\n刻紋太精密了……像是古代的東西。' },
      { say: 'serin', text: '魔物圍過來了！' },
      { goto: 'hall_fight' },
    ],
    hall_fight: [
      { event: 'battle', id: 'bell_hall', outcomes: { win: 'hall_won', lose: 'hall_retry' } },
    ],
    hall_retry: [
      { say: 'lian_inner', text: '（三種敵人一起來。先處理會爆炸的。）' },
      { goto: 'hall_fight' },
    ],
    hall_won: [
      { say: 'serin', text: '鐘聲是從更深處傳上來的。\n我去探路，你們在這裡等。' },
      { say: 'lian_inner', text: '（來了。原作裡，就是這一句。\n她一個人下去，然後——）' },
      { say: 'lian_inner', text: '（要告訴她嗎？「妳會死在這裡」。\n……誰會相信這種話？）' },
      {
        choice: [
          {
            text: '「瑟琳。妳會在這裡死。」',
            effects: [{ divergence: 10 }, { affinity: 'serin', delta: 10 }, { flag: 'serin_told_future' }],
            next: 'hall_truth',
          },
          {
            text: '「下面很危險，別一個人去。」',
            check: { stat: 'cha', dc: 7 },
            effects: [{ divergence: 3 }, { affinity: 'serin', delta: 5 }, { flag: 'serin_warned' }],
            failEffects: [{ flag: 'serin_solo' }],
            next: 'hall_warn_ok',
            fail: 'hall_warn_fail',
          },
          {
            text: '（什麼都不說。）',
            effects: [{ flag: 'serin_solo' }],
            next: 'hall_silent',
          },
        ],
      },
    ],
    hall_truth: [
      { say: 'serin', text: '……你說什麼？' },
      { say: 'lian', text: '妳會為了證明自己，一個人衝下去。\n然後不會回來。' },
      { say: 'serin', text: '你憑什麼——！你根本不認識我！' },
      { say: 'narration', text: '〔鐘聲響起。瑟琳別過頭，握劍的手在抖。〕' },
      { say: 'serin', text: '……我會記住你的話。不是因為相信。' },
      { say: 'serin', text: '是因為你說的時候，看起來很害怕。' },
      { say: 'lian_inner', text: '（……原來，我看起來是那樣。）' },
      { goto: 'hall_done' },
    ],
    hall_warn_ok: [
      { say: 'serin', text: '……我是首席見習生。不需要人陪。' },
      { say: 'lian', text: '首席也需要有人幫她點燈。\n下面很黑，我比妳清楚。' },
      { say: 'serin', text: '……好吧。一起走。只有這次。' },
      { say: 'lian_inner', text: '（「只有這次」。我會讓它變成很多次。）' },
      { goto: 'hall_done' },
    ],
    hall_warn_fail: [
      { say: 'serin', text: '危險？騎士本來就是往危險走的人。' },
      { say: 'serin', text: '我不需要保母，掌燈人。' },
      { say: 'lian_inner', text: '（……說服失敗。她的眼神，\n和原作那張插圖一模一樣。）' },
      { goto: 'hall_done' },
    ],
    hall_silent: [
      { say: 'lian', text: '……休息一下再說吧。' },
      { say: 'serin', text: '嗯。' },
      { say: 'lian_inner', text: '（我選擇了沉默。\n就像原作裡，那個什麼都不知道的主角。）' },
      { goto: 'hall_done' },
    ],
    hall_done: [
      {
        say: 'liora',
        text: '那個……我在附近找到能紮營的地方喔。',
        effects: [{ flag: 'ch2_bell_done' }, { quest: 'ch2_mine', stage: 4 }],
      },
      { goto: 'end' },
    ],
    hall_revisit: [
      { say: 'narration', text: '〔古鐘靜靜懸著。鐘面上，有一道新的裂痕。〕' },
      { goto: 'end' },
    ],

    // ───────── 2-5 營火：瑟琳-1「家名」、莉歐拉-1「爆炸是藝術的一部分」 ─────────
    campfire: [
      { goto: 'campfire_revisit', if: { flag: 'ch2_campfire' } },
      { say: 'narration', text: '〔坑道的凹處，營火映亮岩壁。伊歐睡著了。〕' },
      { say: 'serin', text: '……艾凡斯家，曾經是王都最好的劍。' },
      { say: 'serin', text: '現在只剩一間漏水的宅邸，\n和一個被期待「復興家名」的女兒。' },
      { say: 'serin', text: '所以我不能輸。一次都不能。' },
      {
        choice: [
          {
            text: '「妳想復興的，是家名，還是妳自己？」',
            effects: [{ affinity: 'serin', delta: 10 }],
            next: 'camp_serin_self',
          },
          { text: '「妳已經很強了。」', effects: [{ affinity: 'serin', delta: 3 }], next: 'camp_serin_praise' },
        ],
      },
    ],
    camp_serin_self: [
      { say: 'serin', text: '……從來沒有人這樣問過我。' },
      { say: 'serin', text: '我不知道。這就是答案吧。' },
      { goto: 'camp_serin_end' },
    ],
    camp_serin_praise: [
      { say: 'serin', text: '強，不夠。要「被看見」的強。' },
      { goto: 'camp_serin_end' },
    ],
    camp_serin_end: [
      { say: 'narration', text: '〔瑟琳把劍橫放膝上，靜靜擦拭。〕', effects: [{ flag: 'bond_serin_1' }] },
      { say: 'liora', text: '換我換我！嚴肅時間結束！' },
      { say: 'liora', text: '你們知道嗎？爆炸是藝術的一部分。' },
      { say: 'serin', text: '……我只知道它是我頭髮的敵人。' },
      { say: 'liora', text: '每次失敗，都會炸出一點新東西。\n顏色、聲音、形狀……都是線索。' },
      { say: 'liora', text: '可是大人們只會說：「又是那個瘋丫頭。」' },
      {
        choice: [
          {
            text: '「下次炸的時候，叫我來看。」',
            effects: [{ affinity: 'liora', delta: 10 }],
            next: 'camp_liora_watch',
          },
          {
            text: '「能不能……炸小一點？」',
            effects: [{ affinity: 'liora', delta: 3 }],
            next: 'camp_liora_small',
          },
        ],
      },
    ],
    camp_liora_watch: [
      { say: 'liora', text: '……真的？說好了喔！\n第一排，特等席！' },
      { say: 'lian_inner', text: '（特等席，大概也是最危險的位置。）' },
      { goto: 'camp_end' },
    ],
    camp_liora_small: [
      { say: 'liora', text: '小一點就不是藝術了啦！\n……不過，我考慮看看。' },
      { goto: 'camp_end' },
    ],
    camp_end: [
      {
        say: 'narration',
        text: '〔營火劈啪作響。遠處，鐘聲又響了一次。〕',
        effects: [{ flag: 'bond_liora_1' }, { flag: 'ch2_campfire' }],
      },
      { say: 'narration', text: '〔深夜。瑟琳的鋪蓋，空了。〕', if: { flag: 'serin_solo' } },
      { say: 'lian_inner', text: '（……果然。她去了。）', if: { flag: 'serin_solo' } },
      { goto: 'end' },
    ],
    campfire_revisit: [
      { say: 'narration', text: '〔營火的餘燼還溫著。〕' },
      { goto: 'end' },
    ],

    // ───────── 支線：翻倒的礦車 ─────────
    ore_cart: [
      { goto: 'ore_cart_empty', if: { flag: 'ch2_ore_cart' } },
      { say: 'narration', text: '〔翻倒的礦車下，壓著一個上鎖的工具箱。〕' },
      { say: 'liora', text: '炸開它？' },
      { say: 'lian', text: '不。' },
      {
        choice: [
          {
            text: '抬起礦車。',
            check: { stat: 'str', dc: 5 },
            effects: [{ item: 'potion_s', count: 2 }, { gold: 80 }, { flag: 'ch2_ore_cart' }],
            next: 'ore_cart_ok',
            fail: 'ore_cart_fail',
          },
          { text: '算了。', next: 'end' },
        ],
      },
    ],
    ore_cart_ok: [
      { say: 'narration', text: '〔取得「小回復藥」×2、80 金。〕' },
      { say: 'liora', text: '……用手抬的，好沒有藝術感。' },
      { goto: 'end' },
    ],
    ore_cart_fail: [
      { say: 'lian_inner', text: '（抬不動。掌燈人的肌肉，主要長在信念裡。）' },
      { goto: 'end' },
    ],
    ore_cart_empty: [
      { say: 'narration', text: '〔礦車已經扶正了。輪子吱呀作響。〕' },
      { goto: 'end' },
    ],

    // ───────── 2-6 深層 ─────────
    deep_level: [
      { goto: 'deep_revisit', if: { flag: 'ch2_deep_done' } },
      { goto: 'deep_chase', if: { flag: 'serin_solo' } },
      { say: 'narration', text: '〔深層。岩壁上的星燼礦脈，暗得像熄掉的炭。〕' },
      { say: 'serin', text: '我走前面。……但會等你的燈。', if: { flag: 'serin_told_future' } },
      { say: 'serin', text: '一起走，說好的。', if: { flag: 'serin_warned' } },
      { goto: 'deep_fight' },
    ],
    deep_fight: [
      { event: 'battle', id: 'deep_2', outcomes: { win: 'deep_won', lose: 'deep_retry' } },
    ],
    deep_retry: [
      { say: 'lian_inner', text: '（一步一步來。她就在旁邊，這就夠了。）' },
      { goto: 'deep_fight' },
    ],
    deep_won: [
      { say: 'serin', text: '……如果是我一個人，大概撐不過剛才。' },
      { say: 'lian_inner', text: '（她自己說出來了。偏移，成立。）' },
      { goto: 'deep_done' },
    ],

    // 獨自衝鋒：瑟琳先行，三場連戰追上（不能回營火）
    deep_chase: [
      {
        say: 'narration',
        text: '〔瑟琳先一步衝進了深層。〕',
        effects: [{ leave: 'serin' }],
      },
      { say: 'liora', text: '那個笨蛋騎士！地上有血跡……還很新！' },
      { say: 'io', text: '連恩，快！她的腳步聲越來越遠了。' },
      { say: 'narration', text: '〔限時追趕：三場連戰，途中無法休息。〕' },
      { goto: 'chase_1' },
    ],
    chase_1: [
      { event: 'battle', id: 'deep_1', outcomes: { win: 'chase_2', lose: 'chase_fail' } },
    ],
    chase_2: [
      { say: 'lian_inner', text: '（還有兩場。燈，別熄。）' },
      { event: 'battle', id: 'deep_2', outcomes: { win: 'chase_3', lose: 'chase_fail' } },
    ],
    chase_3: [
      { say: 'liora', text: '前面！我聽到劍的聲音了！' },
      { event: 'battle', id: 'deep_3', outcomes: { win: 'chase_caught', lose: 'chase_fail' } },
    ],
    chase_fail: [
      {
        say: 'narration',
        text: '〔來不及了——瑟琳的慘叫在坑道裡迴盪。〕',
        effects: [{ flag: 'serin_scar' }],
      },
      { say: 'lian_inner', text: '（不。不准這樣結束。再快一點！）' },
      { goto: 'chase_1' },
    ],
    chase_caught: [
      { say: 'narration', text: '〔瑟琳倒在岩壁旁，劍還握在手裡。〕' },
      { say: 'serin', text: '……掌燈人。你……來了啊。' },
      { say: 'serin', text: '我想證明……我一個人也行。', if: { flag: 'serin_scar', not: true } },
      {
        say: 'serin',
        text: '……結果，還是要人來救。',
        if: { flag: 'serin_scar', not: true },
        effects: [{ flag: 'serin_saved' }, { affinity: 'serin', delta: 10 }, { divergence: 5 }],
      },
      { say: 'serin', text: '傷口……沒關係。留疤而已。', if: { flag: 'serin_scar' } },
      {
        say: 'lian_inner',
        text: '（她活著。可是那道傷，會一直跟著她。）',
        if: { flag: 'serin_scar' },
        effects: [{ affinity: 'serin', delta: 5 }, { divergence: 3 }],
      },
      { say: 'lian', text: '下次要衝，叫我一起。我幫妳照路。' },
      {
        say: 'serin',
        text: '……嗯。',
        effects: [{ join: 'serin' }],
      },
      { goto: 'deep_done' },
    ],
    deep_done: [
      {
        say: 'narration',
        text: '〔坑道盡頭，鐘聲近得像心跳。〕',
        effects: [{ flag: 'ch2_deep_done' }, { quest: 'ch2_mine', stage: 5 }],
      },
      { goto: 'end' },
    ],
    deep_revisit: [
      { say: 'narration', text: '〔深層一片寂靜。只有水滴聲。〕' },
      { goto: 'end' },
    ],

    // ───────── Boss：鐘喉蠕蟲 → 2-7 結尾 ─────────
    bell_throat: [
      { goto: 'throat_revisit', if: { flag: 'ch2_complete' } },
      { say: 'narration', text: '〔岩層裂開。巨大的蠕蟲張開喉嚨，\n裡面——掛著一口鐘。〕' },
      {
        say: 'lian_inner',
        text: '（鐘喉蠕蟲。原來鐘聲，是牠的心跳。）',
        effects: [{ codex: 'boss_bellworm' }],
      },
      { say: 'lian_inner', text: '（鐘響四連擊，跟著節拍格擋。\n鑽地時，反方向閃。）' },
      { say: 'lian_inner', text: '（牠會吞星燼——被吸走之前，先用掉。）' },
      { say: 'liora', text: '牠就是吃掉礦脈的傢伙！\n弱點……光跟水！火沒用，我好傷心！' },
      { say: 'serin', text: '這次，我不會一個人衝。', if: { flag: 'serin_scar', not: true } },
      { say: 'serin', text: '……這道傷，我會討回來。', if: { flag: 'serin_scar' } },
      { goto: 'boss_fight' },
    ],
    boss_fight: [
      // 3 階段演出（鐘響節拍 → 鑽地 → 吞噬星燼）由戰鬥場景依 boss_bellworm 處理
      { event: 'battle', id: 'boss_bellworm', outcomes: { win: 'boss_won', lose: 'boss_retry' } },
    ],
    boss_retry: [
      { say: 'lian_inner', text: '（聽鐘聲。節奏就是答案。再來。）' },
      { goto: 'boss_fight' },
    ],
    boss_won: [
      { say: 'narration', text: '〔最後一聲鐘響，餘音很長、很長。\n礦脈重新亮起微光。〕' },
      { say: 'serin', text: '……謝謝。我欠你一條命。', effects: [{ affinity: 'serin', delta: 5 }] },
      { say: 'lian', text: '那我先記帳。利息算便宜一點。' },
      { say: 'liora', text: '等等，你們看這個——蠕蟲體內的鱗片上，\n有刻印。' },
      {
        say: 'liora',
        text: '這是王都研究院的刻印。牠……是被做出來的。',
        effects: [{ flag: 'academy_mark' }, { codex: 'academy_mark' }],
      },
      { say: 'lian_inner', text: '（研究院。原作第三章才出現的名字。\n劇本，提早翻頁了。）' },
      { say: 'narration', text: '〔礦坑出口。一名騎士正在等候。〕' },
      { say: 'gwen', text: '瑟琳·艾凡斯。辛苦了。' },
      { say: 'gwen', text: '騎士團命令：即刻回王都述職。' },
      { goto: 'ending_stay', if: { affinityAtLeast: ['serin', 30] } },
      { goto: 'ending_leave' },
    ],
    ending_stay: [
      { say: 'serin', text: '……葛文前輩。恕我拒絕。' },
      { say: 'gwen', text: '妳知道拒絕命令代表什麼吧？' },
      { say: 'serin', text: '知道。但我想看看——\n掌燈人看見的未來。' },
      { say: 'gwen', text: '……妳變了。我會如實回報。\n「她被掌燈人拐走了」。' },
      { say: 'liora', text: '拐走！好浪漫！' },
      { say: 'serin', text: '閉嘴。' },
      { say: 'narration', text: '〔瑟琳留在了隊伍。〕', effects: [{ flag: 'serin_stayed' }, { divergence: 5 }] },
      { goto: 'ending_common' },
    ],
    ending_leave: [
      { say: 'serin', text: '……是。' },
      { say: 'serin', text: '掌燈人。這條命，我會回來還。' },
      { say: 'serin', text: '在那之前……別死了。' },
      {
        say: 'narration',
        text: '〔瑟琳暫時離開了隊伍。〕',
        effects: [{ leave: 'serin' }, { flag: 'serin_left_ch2' }],
      },
      { say: 'lian_inner', text: '（她回王都了。至少，是用走的。）' },
      { goto: 'ending_common' },
    ],
    ending_common: [
      { say: 'dorn', text: '鐘聲停了……礦脈又亮了！\n小子，礦工公會欠你一次！', if: { repAtLeast: ['miners', 5] } },
      { say: 'liora', text: '王都啊……研究院在那裡。\n我也一起去，我要知道是誰做的。' },
      // 章末畫面「你的選擇」：本章關鍵選擇與偏移值變化
      { event: 'summary', id: 'ch2' },
      { effects: [{ flag: 'ch2_complete' }, { quest: 'ch2_mine', stage: 6, done: true }] },
      { say: 'narration', text: '〔一行人踏上前往王都星冠城的路。〕' },
      { say: 'lian_inner', text: '（第三章「星冠」。原作裡，\n洛克在那裡背叛了主角。）' },
      { event: 'chapterCard', id: 'ch3' },
      { goto: 'end' },
    ],
    throat_revisit: [
      { say: 'narration', text: '〔蠕蟲的巢穴已經崩塌。古鐘碎片在微光中閃爍。〕' },
      { goto: 'end' },
    ],

    end: [],
  },
};
