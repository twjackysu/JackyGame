// 第 1 章「灰燈與霧」。來源：docs/design/08-script-ch0-ch1.md §第 1 章、04-content-plan.md §3。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
//
// 本章由節點地圖（MapScene）驅動：玩家點擊地點 → 從 CH1_ENTRIES 對應的入口節點開始對話，
// 每個入口節點跑到節點結尾（'end'）後把控制權交回地圖。進度以旗標推進（ch1_* 系列）。
import type { DialogueScript } from '../../core/dialogue/runner';
import type { Condition } from '../../core/state/gameState';

/** 三枚燈芯是否到齊（古燈塔遺跡的解鎖條件）。 */
const ALL_WICKS: Condition = {
  all: [{ flag: 'wick_lake' }, { flag: 'wick_hunter' }, { flag: 'wick_shrine' }],
};

/** 地圖入口（依劇情順序）。node = 點擊地點時要啟動的節點。 */
export const CH1_ENTRIES: { node: string; location: string; title: string; requires?: Condition }[] = [
  { node: 'orphanage', location: 'orphanage', title: '孤兒院' },
  { node: 'tavern', location: 'tavern', title: '酒館「醉燈」', requires: { flag: 'ch1_got_lantern' } },
  { node: 'store', location: 'general_store', title: '雜貨店', requires: { flag: 'ch1_got_lantern' } },
  { node: 'town_gate', location: 'town_gate', title: '鎮門', requires: { flag: 'ch1_rourke_joined' } },
  { node: 'forest_edge', location: 'forest_edge', title: '森林入口', requires: { flag: 'ch1_left_town' } },
  { node: 'mist_lake', location: 'mist_lake', title: '霧之湖', requires: { flag: 'ch1_caravan_done' } },
  { node: 'hunter_hut', location: 'hunter_hut', title: '獵人小屋', requires: { flag: 'ch1_io_joined' } },
  { node: 'wolf_path', location: 'wolf_path', title: '狼徑', requires: { flag: 'ch1_met_bern' } },
  { node: 'lighthouse', location: 'lighthouse', title: '古燈塔遺跡', requires: ALL_WICKS },
  { node: 'campfire', location: 'campfire', title: '林間營火', requires: { flag: 'ch1_legacy' } },
  { node: 'fallen_log', location: 'fallen_log', title: '倒木下的寶箱', requires: { flag: 'ch1_legacy' } },
  { node: 'wolf_den', location: 'wolf_den', title: '狼王巢穴', requires: { flag: 'ch1_campfire' } },
];

export const CH1: DialogueScript = {
  id: 'ch1',
  start: 'orphanage',
  nodes: {
    // ───────── 1-1 孤兒院 ─────────
    orphanage: [
      { goto: 'orphanage_revisit', if: { flag: 'ch1_got_lantern' } },
      { say: 'mara', text: '連恩？你怎麼……回來了。' },
      { say: 'lian', text: '被遠征隊解雇了。說掌燈人太慢。' },
      { say: 'mara', text: '（輕笑）那很好啊。\n這個鎮子，本來就需要點燈的人。' },
      {
        say: 'mara',
        text: '這個給你。是撿到你那天，你身邊的提燈。',
        effects: [{ item: 'old_lantern' }],
      },
      { say: 'lian_inner', text: '（「舊提燈」……傳承任務的鑰匙道具！\n原作要到第三章才拿得到。）' },
      {
        say: 'lian_inner',
        text: '（攻略筆記：「古燈塔遺跡」，需要三枚燈芯。）',
        effects: [{ codex: 'legacy_lighthouse' }, { quest: 'legacy', stage: 1 }, { flag: 'ch1_got_lantern' }],
      },
      { goto: 'end' },
    ],
    orphanage_revisit: [
      { say: 'mara', text: '路上小心。燈，要記得添油。' },
      { goto: 'end' },
    ],

    // ───────── 1-2 酒館「醉燈」 ─────────
    tavern: [
      { goto: 'tavern_revisit', if: { flag: 'ch1_rourke_joined' } },
      { say: 'hanna', text: '歡迎……哎呀，是孤兒院的小鬼。喝牛奶？' },
      { say: 'narration', text: '〔角落桌：一個大塊頭老兵正在收錢。〕' },
      { say: 'rourke', text: '又贏了。這鎮上沒人能打燼牌嗎？' },
      {
        say: 'lian_inner',
        text: '（洛克·葛萊姆。原作中的燼牌老千……\n和最後背叛主角的人。）',
        // 前世記憶：洛克的老千手法
        effects: [{ codex: 'rourke_cheat' }],
      },
      {
        choice: [
          { text: '「我陪你打一局。」', next: 'tavern_tutorial' },
          {
            text: '「你袖子裡藏的『餘燼騎士』，\n拿出來打才公平吧？」',
            check: { codex: 'rourke_cheat' },
            effects: [
              { divergence: 3 },
              { affinity: 'rourke', delta: 5 },
              { flag: 'rourke_cheat_known' },
            ],
            next: 'tavern_exposed',
          },
          { text: '「先不了。」', next: 'tavern_decline' },
        ],
      },
    ],
    tavern_decline: [
      { say: 'rourke', text: '哼，膽小鬼。想輸錢隨時歡迎。' },
      { goto: 'end' },
    ],
    tavern_tutorial: [
      // 教學局（腳本化）
      { event: 'cards', id: 'rourke_tutorial', outcomes: { win: 'tavern_official', lose: 'tavern_official' } },
    ],
    tavern_official: [
      { say: 'rourke', text: '新手運不錯。來場真的？' },
      // 正式局：洛克暗中作弊（餘燼騎士必在起手）
      { event: 'cards', id: 'rourke_official', outcomes: { win: 'tavern_win', lose: 'tavern_cheat_lost' } },
    ],
    tavern_cheat_lost: [
      { say: 'rourke', text: '哈哈哈！老實說吧，騎士是我袖子裡變出來的。' },
      { say: 'rourke', text: '贏小鬼贏成這樣，太難看了。重來，這次不作弊。' },
      { goto: 'tavern_clean' },
    ],
    tavern_exposed: [
      { say: 'rourke', text: '……哈！小鬼眼睛挺尖。好，來場乾淨的。' },
      { goto: 'tavern_clean' },
    ],
    tavern_clean: [
      // 正式局（不作弊、餘燼騎士抽出牌組）
      { event: 'cards', id: 'rourke_clean', outcomes: { win: 'tavern_win', lose: 'tavern_lose' } },
    ],
    tavern_win: [
      {
        say: 'rourke',
        text: '哼，運氣不錯。拿去，這張牌跟了我二十年。',
        effects: [{ card: 'c_veteran' }, { affinity: 'rourke', delta: 5 }, { flag: 'beat_rourke' }],
      },
      { goto: 'tavern_join' },
    ],
    tavern_lose: [
      { say: 'rourke', text: '輸了就付學費。——開玩笑的，下次再來。' },
      { goto: 'tavern_join' },
    ],
    tavern_join: [
      { say: 'rourke', text: '小鬼，要去霧語森林？\n最近狼多，商隊都不敢走。' },
      {
        say: 'rourke',
        text: '……正好，有個商隊欠我錢。\n我跟你走一段，順路討債。',
        effects: [
          { join: 'rourke', guest: true },
          { flag: 'ch1_rourke_joined' },
          { quest: 's1_caravan', stage: 0 },
        ],
      },
      { say: 'lian_inner', text: '（洛克加入……原作沒有這個發展。\n偏移，開始了。）' },
      { goto: 'end' },
    ],
    tavern_revisit: [
      { say: 'hanna', text: '又是你啊。牛奶還是燼牌？' },
      {
        choice: [
          {
            text: '「洛克，再來一局。」',
            if: { flag: 'beat_rourke', not: true },
            next: 'tavern_rematch',
          },
          { text: '「只是路過。」', next: 'end' },
        ],
      },
    ],
    tavern_rematch: [
      { say: 'rourke', text: '還不服氣？好，來。' },
      { event: 'cards', id: 'rourke_clean', outcomes: { win: 'tavern_rematch_win', lose: 'tavern_rematch_lose' } },
    ],
    tavern_rematch_win: [
      {
        say: 'rourke',
        text: '……行，你贏了。這張牌，歸你。',
        effects: [{ card: 'c_veteran' }, { affinity: 'rourke', delta: 5 }, { flag: 'beat_rourke' }],
      },
      { goto: 'end' },
    ],
    tavern_rematch_lose: [
      { say: 'rourke', text: '再練練吧，小鬼。' },
      { goto: 'end' },
    ],

    // ───────── 灰燈鎮支線「廣場的四盞燈」（自由探索：老燈伕） ─────────
    lamplighter: [
      { goto: 'lamplighter_reward', if: { all: [{ flag: 'q_lamps_lit' }, { flag: 'q_lamps_rewarded', not: true }] } },
      { goto: 'lamplighter_thanks', if: { flag: 'q_lamps_rewarded' } },
      { goto: 'lamplighter_wait', if: { flag: 'q_lamps' } },
      { say: 'lamplighter', text: '掌燈人？……真難得，這行還有年輕人。' },
      { say: 'lamplighter', text: '廣場那四盞燈，鎮長說沒錢添油，\n就這樣熄了半年。我這把老骨頭，梯子爬不上去囉。' },
      { say: 'lian_inner', text: '（原作裡，這是灰燈鎮最早的支線。\n報酬不多——但點燈，本來就是我的工作。）' },
      {
        choice: [
          { text: '「交給我。」', next: 'lamplighter_accept' },
          { text: '「下次吧。」', next: 'end' },
        ],
      },
    ],
    lamplighter_accept: [
      { say: 'lamplighter', text: '好、好！燈油我這有。\n廣場四個角各一盞，點亮了再來找我。', effects: [{ flag: 'q_lamps' }] },
      { goto: 'end' },
    ],
    lamplighter_wait: [
      { say: 'lamplighter', text: '四個角各一盞。點亮的燈，從遠處就看得到。' },
      { goto: 'end' },
    ],
    lamplighter_reward: [
      { say: 'narration', text: '〔廣場四盞燈都亮了。石板路上，久違地映出人影。〕' },
      { say: 'lamplighter', text: '……是我年輕時親手掛上去的燈。\n謝謝你，掌燈人。這點心意，你拿著。' },
      {
        say: 'lian_inner',
        text: '（金幣 40、小回復藥 ×2。\n還有——鎮上的人，開始叫我「掌燈人」了。）',
        effects: [{ flag: 'q_lamps_rewarded' }, { gold: 40 }, { item: 'potion_s', count: 2 }],
      },
      { goto: 'end' },
    ],
    lamplighter_thanks: [
      { say: 'lamplighter', text: '燈亮著，晚上出門的人也多了。好啊。' },
      { goto: 'end' },
    ],

    // ───────── 1-3 雜貨店 ─────────
    store: [
      { say: 'toby', text: '要點什麼？最近藥草難進，\n森林那邊……唉。' },
      {
        say: 'toby',
        text: '聽說你在遺跡裡頂了騎士團隊長？\n痛快！這次算你便宜點。',
        if: { flag: 'exposed_captain' },
        effects: [{ flag: 'shop_discount_ch1', value: 10 }],
      },
      // 商品：小回復藥、燈油（戰鬥中回 2 SP）、解毒草
      { event: 'shop', id: 'ch1_general' },
      { goto: 'end' },
    ],

    // ───────── 1-4 鎮門 → 森林入口 ─────────
    town_gate: [
      {
        say: 'guard',
        text: '要出鎮？森林裡狼多，小心點。',
      },
      { say: 'guard', text: '……掌燈人啊，順手把路燈點了吧。' },
      {
        say: 'lian_inner',
        text: '（在原作，這句台詞是嘲諷。\n現在聽來，倒像是個委託。）',
        effects: [{ flag: 'ch1_left_town' }],
      },
      { goto: 'end' },
    ],

    // ───────── 1-5 支線 S1「迷路的商隊」 ─────────
    forest_edge: [
      { goto: 'forest_edge_revisit', if: { flag: 'ch1_caravan_done' } },
      { say: 'narration', text: '〔馬車翻覆，狼群環伺。〕' },
      { say: 'farrow', text: '救、救命！貨……不，命比較重要！' },
      {
        say: 'lian_inner',
        text: '（攻略筆記：霧狼是狼王的眷屬。\n東邊的哨音，會讓牠們回巢。）',
        effects: [{ codex: 'wolf_whistle' }],
      },
      {
        choice: [
          { text: '「交給我！」', effects: [{ quest: 's1_caravan', stage: 1 }], next: 'caravan_fight' },
          {
            text: '用提燈的光引開狼群（狼怕強光）',
            check: { stat: 'int', dc: 5 },
            effects: [{ gold: 50 }, { quest: 's1_caravan', stage: 1 }],
            failEffects: [{ flag: 'caravan_ambushed' }, { quest: 's1_caravan', stage: 1 }],
            next: 'caravan_lured',
            fail: 'caravan_lure_fail',
          },
          {
            text: '「……先趕路。」（不管他們）',
            effects: [
              { flag: 'caravan_abandoned' },
              { affinity: 'rourke', delta: -5 },
              { quest: 's1_caravan', stage: 9, done: true },
              { flag: 'ch1_caravan_done' },
            ],
            next: 'caravan_abandon',
          },
          {
            text: '「往東邊吹哨，狼王會召回牠們。」',
            check: { codex: 'wolf_whistle' },
            effects: [{ divergence: 4 }, { flag: 'wolfpack_returned' }, { quest: 's1_caravan', stage: 1 }],
            next: 'caravan_whistle',
          },
        ],
      },
    ],
    caravan_fight: [
      { event: 'battle', id: 'caravan', outcomes: { win: 'caravan_saved', lose: 'caravan_retry' } },
    ],
    caravan_retry: [
      { say: 'lian_inner', text: '（……還沒完。再一次！）' },
      { goto: 'caravan_fight' },
    ],
    caravan_lured: [
      { say: 'narration', text: '〔提燈光芒大盛。狼群哀嚎著退入霧中。〕' },
      { goto: 'caravan_saved' },
    ],
    caravan_lure_fail: [
      { say: 'narration', text: '〔光閃了一下就暗了。狼群從背後撲來！〕' },
      // 失敗：先手被奪（以 caravan_ambushed 旗標告知戰鬥場景）
      { goto: 'caravan_fight' },
    ],
    caravan_whistle: [
      { say: 'narration', text: '〔尖銳的哨音向東傳去。狼群豎耳，轉身離去。〕' },
      { say: 'rourke', text: '……小鬼，你連這種事都知道？' },
      { goto: 'caravan_saved' },
    ],
    caravan_saved: [
      {
        say: 'farrow',
        text: '恩人！我們商隊「燼牌會」會記住你的。',
        effects: [
          { rep: 'caravan', delta: 15 },
          { item: 'ember_card_pack' },
          { flag: 'saved_caravan' },
          { quest: 's1_caravan', stage: 2, done: true },
          { flag: 'ch1_caravan_done' },
        ],
      },
      { say: 'lian_inner', text: '（燼牌會……在原作，\n第三章王都裡唯一肯幫主角的勢力。）' },
      { goto: 'end' },
    ],
    caravan_abandon: [
      { say: 'rourke', text: '……哼。' },
      { say: 'narration', text: '〔身後的哀嚎聲，漸漸被霧吞沒。〕' },
      { goto: 'end' },
    ],
    forest_edge_revisit: [
      { say: 'narration', text: '〔林間小路。霧氣比鎮上濃得多。〕' },
      { goto: 'end' },
    ],

    // ───────── 1-6 霧之湖（燈芯 1 + 伊歐） ─────────
    mist_lake: [
      { goto: 'mist_lake_revisit', if: { flag: 'ch1_io_joined' } },
      { say: 'narration', text: '〔湖面濃霧。遠處傳來哼唱聲，\n五個音，反覆。〕' },
      { say: 'lian_inner', text: '（這裡……原作沒有這段音樂。）' },
      { say: 'narration', text: '〔霧散，白髮少女坐在湖中央的石上，\n腳尖輕點水面。〕' },
      { say: 'girl', text: '……你，看得見我？' },
      { say: 'lian', text: '看得見。你是誰？' },
      { say: 'girl', text: '……不知道。名字、從哪裡來，都不記得。' },
      { say: 'girl', text: '只記得這首歌。' },
      { say: 'narration', text: '〔連恩翻開攻略筆記，\n頁面出現雜訊：「查無此人」。〕' },
      { say: 'lian_inner', text: '（筆記裡沒有她。\n全成就的我，從沒見過她。）' },
      { say: 'lian_inner', text: '（……這不可能。）' },
      { say: 'girl', text: '你手上的燈，很溫暖。我可以……跟著你嗎？' },
      {
        choice: [
          { text: '「當然。我叫連恩。」', next: 'lake_name' },
          {
            text: '「你先告訴我，你是什麼東西。」',
            effects: [{ affinity: 'io', delta: -5 }],
            next: 'lake_harsh',
          },
        ],
      },
    ],
    lake_harsh: [
      { say: 'girl', text: '……我也想知道。' },
      { goto: 'lake_name' },
    ],
    lake_name: [
      { say: 'girl', text: '那……你幫我取個名字吧。' },
      {
        choice: [
          { text: '「伊歐。」', next: 'lake_named' },
          { text: '（自己取個名字）', next: 'lake_rename' },
        ],
      },
    ],
    lake_rename: [
      // 名字輸入（預設「伊歐」）；台詞仍以預設名呈現
      { event: 'rename', id: 'io' },
      { goto: 'lake_named' },
    ],
    lake_named: [
      { say: 'io', text: '伊歐……嗯。伊歐。', effects: [{ flag: 'io_named' }, { join: 'io' }] },
      { say: 'io', text: '石頭下面……有什麼在發光。' },
      {
        say: 'narration',
        text: '〔湖心石下，一枚燈芯靜靜燃著。〕',
        effects: [
          { flag: 'wick_lake' },
          { item: 'lamp_wick' },
          { quest: 'legacy', stage: 2 },
          { flag: 'ch1_io_joined' },
        ],
      },
      { goto: 'end' },
    ],
    mist_lake_revisit: [
      { say: 'io', text: '……湖，好安靜。' },
      { goto: 'end' },
    ],

    // ───────── 1-7 獵人小屋（燈芯 2） ─────────
    hunter_hut: [
      { goto: 'hunter_done', if: { flag: 'wick_hunter' } },
      // 狼徑已清（不論是否先答應過伯恩）→ 伯恩讓步，避免燼牌一直輸而卡關
      { goto: 'hunter_return', if: { flag: 'ch1_path_cleared' } },
      { goto: 'hunter_waiting', if: { flag: 'bern_wait' } },
      { goto: 'hunter_ask', if: { flag: 'ch1_met_bern' } },
      { say: 'bern', text: '燈芯？那是我亡妻留下的。不能給。' },
      { say: 'bern', text: '……那頭狼王，奪走了她。', effects: [{ flag: 'ch1_met_bern' }] },
      { goto: 'hunter_ask' },
    ],
    hunter_ask: [
      {
        choice: [
          {
            text: '「我會打倒狼王，\n用燈芯照亮她回家的路。」',
            if: { flag: 'bern_refused', not: true },
            check: { stat: 'cha', dc: 5 },
            effects: [{ flag: 'bern_promise' }],
            failEffects: [{ flag: 'bern_refused' }],
            next: 'hunter_promise',
            fail: 'hunter_promise_fail',
          },
          { text: '「用燼牌決定吧。」', next: 'hunter_cards' },
          { text: '「我先去狼徑幫你清掉狼群。」', effects: [{ flag: 'bern_wait' }], next: 'hunter_wait' },
        ],
      },
    ],
    hunter_promise: [
      { say: 'bern', text: '……好。拿去吧。' },
      { say: 'bern', text: '但狼王那一戰——讓我也去。', effects: [{ quest: 's4_oath', stage: 0 }] },
      { goto: 'hunter_wick' },
    ],
    hunter_promise_fail: [
      { say: 'bern', text: '說得好聽。我聽過太多次了。' },
      { goto: 'hunter_ask' },
    ],
    hunter_cards: [
      // 伯恩：鎮民牌組，會用「月相」
      { event: 'cards', id: 'bern', outcomes: { win: 'hunter_cards_win', lose: 'hunter_cards_lose' } },
    ],
    hunter_cards_win: [
      { say: 'bern', text: '……輸了就是輸了。燈芯，你拿去。' },
      { goto: 'hunter_wick' },
    ],
    hunter_cards_lose: [
      { say: 'bern', text: '牌都打不好，還想打狼王？' },
      { say: 'bern', text: '……去狼徑把狼群清掉。做得到，燈芯就是你的。', effects: [{ flag: 'bern_lost_cards' }] },
      { say: 'narration', text: '〔也可以之後再回來找伯恩打一局。〕' },
      { goto: 'end' },
    ],
    hunter_wait: [
      { say: 'bern', text: '……狼徑的狼群？你要是做得到，再說。' },
      { goto: 'end' },
    ],
    hunter_waiting: [
      { say: 'bern', text: '狼徑的狼還在。清完再來。' },
      {
        choice: [
          { text: '「我這就去狼徑。」', next: 'end' },
          { text: '「還是用燼牌決定吧。」', next: 'hunter_cards' },
        ],
      },
    ],
    hunter_return: [
      { say: 'bern', text: '狼徑安靜了……你真的做到了。' },
      { say: 'bern', text: '我讓步。這枚燈芯，交給你。' },
      { goto: 'hunter_wick' },
    ],
    hunter_wick: [
      {
        say: 'narration',
        text: '〔取得燈芯。〕',
        effects: [{ flag: 'wick_hunter' }, { item: 'lamp_wick' }],
      },
      { goto: 'end' },
    ],
    hunter_done: [
      { say: 'bern', text: '狼王……拜託你了。' },
      { goto: 'end' },
    ],

    // ───────── 1-8 狼徑（燈芯 3） ─────────
    wolf_path: [
      { goto: 'wolf_path_revisit', if: { flag: 'ch1_path_cleared' } },
      { say: 'narration', text: '〔路旁，一輛翻倒的馬車。車板下壓著一封信。〕', if: { flag: 'caravan_abandoned' } },
      { say: 'lian_inner', text: '（……是那個商隊。）', if: { flag: 'caravan_abandoned' } },
      { say: 'narration', text: '〔狼徑盡頭的祠堂，燈芯被蝕化野豬守著。〕' },
      {
        say: 'lian_inner',
        text: '（蝕化野豬。紫光攻擊要用「引路之光」\n——可是我還沒解鎖。）',
        effects: [{ codex: 'umbra_boar' }],
      },
      { say: 'rourke', text: '小鬼，紫色那招躲不掉就硬吃，我扛著。' },
      { say: 'rourke', text: '紅色那招讓牠撞牆。' },
      { say: 'lian_inner', text: '（……老兵的直覺，和攻略筆記一樣準。）' },
      { goto: 'boar_fight' },
    ],
    boar_fight: [
      // 衝鋒撞牆 → 自我破防的機制教學
      { event: 'battle', id: 'shrine_boar', outcomes: { win: 'boar_won', lose: 'boar_retry' } },
    ],
    boar_retry: [
      { say: 'rourke', text: '還站得起來吧？再上！' },
      { goto: 'boar_fight' },
    ],
    boar_won: [
      {
        say: 'narration',
        text: '〔祠堂裡，燈芯微微發亮。〕',
        effects: [{ flag: 'wick_shrine' }, { item: 'lamp_wick' }, { flag: 'ch1_path_cleared' }],
      },
      {
        say: 'lian_inner',
        text: '（狼徑清乾淨了。回去找伯恩吧。）',
        if: { all: [{ flag: 'bern_wait' }, { flag: 'wick_hunter', not: true }] },
      },
      { goto: 'end' },
    ],
    wolf_path_revisit: [
      { say: 'narration', text: '〔祠堂靜悄悄的，只剩撞裂的石牆。〕' },
      { goto: 'end' },
    ],

    // ───────── 1-9 古燈塔遺跡（傳承） ─────────
    lighthouse: [
      { goto: 'lighthouse_revisit', if: { flag: 'ch1_legacy' } },
      { say: 'narration', text: '〔三枚燈芯放入，燈塔頂端亮起，\n光柱直衝天際。〕' },
      { say: 'ancient_voice', text: '繼承者啊。燈，不是用來照亮道路的。' },
      { say: 'ancient_voice', text: '是用來，讓迷途者知道——這裡有人。' },
      {
        say: 'narration',
        text: '〔傳承解鎖：技能「引路之光」。〕',
        effects: [
          { item: 'lamp_wick', count: -3 },
          { skill: 'guiding_light' },
          { flag: 'skill_tree_unlocked' },
          { codex: 'lamplighter_true' },
          { quest: 'legacy', stage: 3, done: true },
          { flag: 'ch1_legacy' },
        ],
      },
      { say: 'lian_inner', text: '（傳承解鎖。和原作一樣……\n只是，原作的台詞沒有後半句。）' },
      { say: 'io', text: '……這個聲音，好像在哪裡聽過。' },
      { goto: 'end' },
    ],
    lighthouse_revisit: [
      { say: 'narration', text: '〔燈塔的光，穩穩照著森林。〕' },
      { goto: 'end' },
    ],

    // ───────── 1-10 林間營火（伊歐-1「湖邊旋律」→ 洛克-1「營火旁的一杯」） ─────────
    campfire: [
      { goto: 'campfire_revisit', if: { flag: 'ch1_campfire' } },
      { say: 'io', text: '連恩。那本書，是什麼？' },
      { say: 'lian', text: '嗯……算是，未來的日記吧。' },
      { say: 'io', text: '上面有寫我嗎？' },
      {
        choice: [
          { text: '「沒有。」（誠實）', effects: [{ affinity: 'io', delta: 10 }], next: 'camp_io_honest' },
          {
            text: '「有啊，寫你是個好人。」（說謊）',
            effects: [{ affinity: 'io', delta: -5 }],
            next: 'camp_io_lie',
          },
        ],
      },
    ],
    camp_io_honest: [
      { say: 'io', text: '……那，我們一起寫上去吧。' },
      { goto: 'camp_io_song' },
    ],
    camp_io_lie: [
      { say: 'io', text: '（看著你）……騙人。' },
      { say: 'narration', text: '〔燈光晃了一下。〕' },
      { goto: 'camp_io_song' },
    ],
    camp_io_song: [
      { say: 'narration', text: '〔伊歐哼起那五個音。〕' },
      {
        say: 'io',
        text: '這是我唯一擁有的東西。現在，也給你聽了。',
        effects: [{ flag: 'bond_io_1' }],
      },
      { say: 'narration', text: '〔伊歐睡著了。洛克遞來酒壺。〕' },
      { say: 'rourke', text: '……喝不了？那就水。' },
      { say: 'rourke', text: '小鬼，你看人的眼神，\n像是早就知道對方會怎麼死。' },
      {
        choice: [
          { text: '「只是錯覺。」', next: 'camp_rourke_deny' },
          {
            text: '「如果我說，我真的知道呢？」',
            effects: [
              { affinity: 'rourke', delta: 5 },
              { divergence: 2 },
            ],
            next: 'camp_rourke_truth',
          },
        ],
      },
    ],
    camp_rourke_deny: [
      { say: 'rourke', text: '哼。那最好。' },
      { goto: 'camp_end' },
    ],
    camp_rourke_truth: [
      { say: 'rourke', text: '……那就別讓它發生。' },
      { say: 'rourke', text: '這種話，我年輕時沒人對我說過。' },
      { goto: 'camp_end' },
    ],
    camp_end: [
      { say: 'narration', text: '〔營火劈啪作響。夜，很長。〕', effects: [{ flag: 'bond_rourke_1' }, { flag: 'ch1_campfire' }] },
      { goto: 'end' },
    ],
    campfire_revisit: [
      { say: 'narration', text: '〔營火的餘燼還溫著。〕' },
      { goto: 'end' },
    ],

    // ───────── 隱藏節點：倒木下的寶箱（引路之光揭露） ─────────
    fallen_log: [
      { goto: 'fallen_log_empty', if: { flag: 'ch1_fallen_log' } },
      { say: 'narration', text: '〔引路之光照過倒木，底下有什麼在反光。〕' },
      {
        say: 'narration',
        text: '〔取得「霧之墜飾」。〕',
        effects: [{ item: 'mist_pendant' }, { flag: 'ch1_fallen_log' }],
      },
      { goto: 'end' },
    ],
    fallen_log_empty: [
      { say: 'narration', text: '〔空空的寶箱，長滿了青苔。〕' },
      { goto: 'end' },
    ],

    // ───────── 1-11 Boss：霧角狼王 ─────────
    wolf_den: [
      { goto: 'wolf_den_revisit', if: { flag: 'ch1_complete' } },
      { say: 'narration', text: '〔巨大的狼，雙角纏繞紫色霧氣。〕' },
      {
        say: 'lian_inner',
        text: '（霧角狼王。弱點是火與光，角可以破防。）',
        effects: [{ codex: 'boss_wolfking' }],
      },
      { say: 'lian_inner', text: '（第二階段會放霧——那時用引路之光。）' },
      { say: 'lian_inner', text: '（……這次，是我真正的第一場 Boss 戰。）' },
      { say: 'narration', text: '〔狼群自四方歸巢，圍在狼王身旁。〕', if: { flag: 'wolfpack_returned' } },
      { say: 'rourke', text: '狼王啊。我扛前面，你們負責把燈點滿。' },
      // 伯恩同行為 P1（S4）；目前僅以台詞演出
      { say: 'bern', text: '這一天，我等了七年。', if: { flag: 'bern_promise' } },
      { goto: 'boss_fight' },
    ],
    boss_fight: [
      // 2 階段；wolfpack_returned → 第一階段多一隻霧狼（由戰鬥場景讀旗標）
      { event: 'battle', id: 'boss_wolfking', outcomes: { win: 'boss_won', lose: 'boss_retry' } },
    ],
    boss_retry: [
      { say: 'lian_inner', text: '（……還沒結束。記住節奏，再來。）' },
      { goto: 'boss_fight' },
    ],
    boss_won: [
      { say: 'io', text: '結束了……？' },
      { say: 'lian_inner', text: '（狼王消散時，牠的眼神不是憤怒，\n而是……解脫。）' },
      { say: 'lian_inner', text: '（蝕化。星燼的副作用。\n原作中，這只是一句設定說明。）' },
      { say: 'narration', text: '〔法洛的信：「恩人！我們在王都等你。」〕', if: { flag: 'saved_caravan' } },
      { say: 'rourke', text: '……那個商隊，最後沒能出森林。', if: { flag: 'caravan_abandoned' } },
      { say: 'narration', text: '〔沉默。〕', if: { flag: 'caravan_abandoned' } },
      { say: 'rourke', text: '我要去王都了。小鬼，牌技練好點，' },
      {
        say: 'rourke',
        text: '下次見面別讓我太無聊。',
        effects: [{ leave: 'rourke' }],
      },
      // 章末畫面「你的選擇」：本章關鍵選擇與偏移值變化
      { event: 'summary', id: 'ch1' },
      { effects: [{ flag: 'ch1_complete' }] },
      { say: 'narration', text: '〔數日後。瑟琳出現在灰燈鎮，\n帶著騎士團命令「調查沉鐘礦坑」。〕' },
      { say: 'lian_inner', text: '（沉鐘礦坑……原作中，瑟琳死去的地方。）' },
      { event: 'chapterCard', id: 'ch2' },
      { goto: 'end' },
    ],

    wolf_den_revisit: [
      { say: 'narration', text: '〔巢穴裡只剩霧氣，和風聲。〕' },
      { goto: 'end' },
    ],

    // ───────── 支線「霧菇與紅頭巾」（灰燈鎮露絲 → 森林西南蕈圈的米亞） ─────────
    ruth: [
      { goto: 'ruth_reward', if: { all: [{ flag: 'q_lost_kid_found' }, { flag: 'q_lost_kid_done', not: true }] } },
      { goto: 'ruth_thanks', if: { flag: 'q_lost_kid_done' } },
      { goto: 'ruth_wait', if: { flag: 'q_lost_kid' } },
      { say: 'ruth', text: '請問……有沒有看到一個綁紅頭巾的小女孩？' },
      { say: 'ruth', text: '米亞說要去森林採霧菇給我煮湯，\n一大早出去，到現在都沒回來……' },
      { say: 'lian_inner', text: '（原作裡沒有這段——\n還是說，原作的我根本沒停下來聽？\n森林裡有狼。）' },
      {
        choice: [
          { text: '「我去找她。」', next: 'ruth_accept' },
          { text: '「自衛團呢？」', next: 'ruth_guard' },
        ],
      },
    ],
    ruth_guard: [
      { say: 'ruth', text: '他們說狼太多，要等明天……\n明天就太晚了啊！' },
      {
        choice: [
          { text: '「……我去。」', next: 'ruth_accept' },
          { text: '「抱歉，我還有事。」', next: 'end' },
        ],
      },
    ],
    ruth_accept: [
      { say: 'ruth', text: '謝謝你！她說過，要去找「會發光的蘑菇」……', effects: [{ flag: 'q_lost_kid' }] },
      { say: 'lian_inner', text: '（發光的蘑菇——霧角森林西南角的蕈圈。\n出鎮門往南，沿著湖往下走。）' },
      { goto: 'end' },
    ],
    ruth_wait: [
      { say: 'ruth', text: '森林西南邊……她說那裡有發光的蘑菇。\n拜託你了。' },
      { goto: 'end' },
    ],
    mia: [
      { say: 'narration', text: '〔蕈圈中央，一個綁紅頭巾的小女孩抱著籃子縮成一團。〕' },
      { say: 'mia', text: '……你、你是誰？狼、狼走了嗎？' },
      { say: 'lian', text: '走了。妳媽媽在找妳，我帶妳回家。' },
      { say: 'io', text: '……別怕。回去的路上，我唱歌給妳聽。', if: { inParty: 'io' }, effects: [{ affinity: 'io', delta: 3 }] },
      { say: 'rourke', text: '小鬼，籃子給我拿。……蘑菇採得不錯嘛。', if: { inParty: 'rourke' }, effects: [{ affinity: 'rourke', delta: 2 }] },
      { say: 'mia', text: '……嗯！', effects: [{ flag: 'q_lost_kid_found' }] },
      { say: 'narration', text: '〔米亞緊緊抓著你的衣角。帶她回灰燈鎮吧。〕' },
      { goto: 'end' },
    ],
    ruth_reward: [
      { say: 'narration', text: '〔米亞放開你的衣角，撲進母親懷裡。〕' },
      { say: 'ruth', text: '米亞！妳這孩子……！' },
      { say: 'mia', text: '媽媽，我找到發光的蘑菇了……\n可是狼好大隻。是大哥哥救我的。' },
      { say: 'ruth', text: '這條項鍊，本來是要等她長大才給她的。\n可是她說——要給救她的人。' },
      {
        say: 'mia',
        text: '給大哥哥！它會保護你！',
        effects: [{ flag: 'q_lost_kid_done' }, { item: 'amulet_guard' }, { gold: 20 }, { rep: 'town', delta: 5 }],
      },
      { say: 'lian_inner', text: '（守護項鍊、金幣 20。\n……收下吧。這是她們的心意。）' },
      { goto: 'end' },
    ],
    ruth_thanks: [
      { say: 'ruth', text: '米亞現在只敢在院子裡採蘑菇了。\n謝謝你，掌燈人。' },
      { goto: 'end' },
    ],

    // ───────── 支線「流浪牌手」（灰燈鎮廣場，可重複挑戰） ─────────
    drifter: [
      { goto: 'drifter_again', if: { flag: 'drifter_beaten' } },
      { say: 'drifter', text: '嘿，提燈的。會打燼牌嗎？\n我從南方一路贏過來，這鎮上沒人敢跟我玩。' },
      { say: 'drifter', text: '贏了我，這張「吞火人」歸你。\n輸了嘛……就當學費。' },
      {
        choice: [
          { text: '「來一局。」', next: 'drifter_play' },
          { text: '「改天。」', next: 'end' },
        ],
      },
    ],
    drifter_play: [
      { event: 'cards', id: 'drifter', outcomes: { win: 'drifter_win', lose: 'drifter_lose' } },
    ],
    drifter_win: [
      {
        say: 'drifter',
        text: '……哈！好手氣。說好的，牌給你。',
        effects: [{ flag: 'drifter_beaten' }, { card: 'c_fire_eater' }, { gold: 25 }],
      },
      { say: 'lian_inner', text: '（燼牌「吞火人」、金幣 25。\n收藏的牌會自動加進我的牌組。）' },
      { goto: 'end' },
    ],
    drifter_lose: [
      { say: 'drifter', text: '再練練吧。我會在廣場待上幾天。' },
      { goto: 'end' },
    ],
    drifter_again: [
      { say: 'drifter', text: '輸給你之後，我想通了。\n牌桌上最強的，是不怕輸的人。' },
      { goto: 'end' },
    ],

    end: [],
  },
};
