// 第 3 章「星冠」。來源：docs/design/10-story-ch2-final.md §第 3 章、02-world-and-story.md §5。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
//
// 與前兩章相同，由節點地圖（MapScene）驅動：點擊地點 → 從 CH3_ENTRIES 的入口節點開始，
// 跑到節點結尾（'end'）後交回地圖。進度以 ch3_* 旗標推進。
// 章節卡「第三章 星冠」已在第 2 章結尾播放，本章開頭不再重複。
//
// 本章新增旗標：
//   ch3_entered / ch3_plaza_done / ch3_rourke_met / ch3_tourney_done / ch3_market_done /
//   ch3_academy_done / ch3_betrayal / ch3_duel_done / ch3_complete（進度）
//   gate_vouched / gate_charmed / gate_paid / gate_sewer / gate_cha_failed（入城方式）
//   serin_returned（瑟琳回歸）、tourney_signed、tourney_champion / tourney_lost、academy_pass
//   academy_sneaked（潛入路線）、market_fought / market_talked（夜市街頭）
//   exposed_valderan / double_agent（關鍵選擇）、io_taken
//   rourke_p_codex / rourke_p_bond / rourke_p_cha（說服選項已使用）
//   rourke_turned / rourke_lost（洛克的結局分歧）
//   bond_rourke_2 / bond_serin_2 / bond_liora_2 / bond_rourke_3
import type { ChoiceLine, DialogueScript } from '../../core/dialogue/runner';
import type { Condition } from '../../core/state/gameState';

/** 地圖入口（依劇情順序）。node = 點擊地點時要啟動的節點。 */
export const CH3_ENTRIES: { node: string; location: string; title: string; requires?: Condition }[] = [
  { node: 'gate', location: 'capital_gate', title: '王都城門', requires: { flag: 'ch2_complete' } },
  { node: 'plaza', location: 'crown_plaza', title: '星冠廣場', requires: { flag: 'ch3_entered' } },
  { node: 'rourke_lodging', location: 'rourke_lodging', title: '洛克的住處', requires: { flag: 'ch3_plaza_done' } },
  { node: 'tourney', location: 'tourney_hall', title: '燼牌大賽', requires: { flag: 'ch3_plaza_done' } },
  { node: 'night_market', location: 'night_market', title: '王都夜市', requires: { flag: 'ch3_plaza_done' } },
  {
    node: 'academy',
    location: 'academy',
    title: '星術研究院',
    requires: { all: [{ flag: 'ch3_tourney_done' }, { flag: 'ch3_rourke_met' }] },
  },
  { node: 'inn_night', location: 'inn_night', title: '旅店・深夜', requires: { flag: 'ch3_academy_done' } },
  { node: 'rourke_duel', location: 'rooftop', title: '鐘塔屋頂', requires: { flag: 'ch3_betrayal' } },
  { node: 'ending', location: 'crown_plaza_dawn', title: '黎明的廣場', requires: { flag: 'ch3_duel_done' } },
];

/**
 * 洛克戰的說服選項（每場戰鬥之後一次）。用過的選項以 rourke_p_* 旗標隱藏，不會重複出現。
 * 「（舉起燈。）」永遠可選，確保選單不會是空的。
 */
function persuade(fail: string): ChoiceLine {
  return {
    choice: [
      {
        text: '「你在酒館說過，『乾淨的牌局』。」',
        // 沒有這條筆記就不顯示（避免出現 0% 的選項）
        if: { all: [{ flag: 'rourke_p_codex', not: true }, { hasCodex: 'rourke_cheat_known' }] },
        check: { codex: 'rourke_cheat_known' },
        effects: [{ flag: 'rourke_p_codex' }],
        failEffects: [{ flag: 'rourke_p_codex' }],
        next: 'duel_turned_codex',
        fail,
      },
      {
        text: '「你說過，別讓它發生。」',
        if: { all: [{ affinityAtLeast: ['rourke', 40] }, { flag: 'rourke_p_bond', not: true }] },
        effects: [{ flag: 'rourke_p_bond' }],
        next: 'duel_turned_bond',
      },
      {
        text: '「一個人換一個人？他們不會守約的。」',
        if: { flag: 'rourke_p_cha', not: true },
        check: { stat: 'cha', dc: 8 },
        effects: [{ flag: 'rourke_p_cha' }],
        failEffects: [{ flag: 'rourke_p_cha' }],
        next: 'duel_turned_talk',
        fail,
      },
      { text: '（無話可說。舉起燈。）', next: fail },
    ],
  };
}

export const CH3: DialogueScript = {
  id: 'ch3',
  start: 'gate',
  nodes: {
    // ───────── 3-1 王都城門 ─────────
    gate: [
      { goto: 'gate_revisit', if: { flag: 'ch3_entered' } },
      { say: 'narration', text: '〔白石城牆高得看不見頂。\n城門上，一頂星形的冠冕閃著光。〕' },
      { say: 'liora', text: '王都星冠城！空氣裡都是\n錢跟規矩的味道！' },
      { say: 'io', text: '好多人……大家都走得好快。' },
      { say: 'lian_inner', text: '（星冠城。原作第三章的舞台。\n也是攻略論壇吵最兇的一章。）' },
      { say: 'gate_captain', text: '站住。入城要通行證，\n或擔保人，或入城費。' },
      { say: 'gate_captain', text: '最近城裡不太平。\n來路不明的，一律不放。' },
      { goto: 'gate_vouch', if: { flag: 'saved_caravan' } },
      { goto: 'gate_choice' },
    ],
    gate_vouch: [
      { say: 'farrow', text: '等等等等！隊長，這位是我的恩人！' },
      { say: 'farrow', text: '霧語森林裡，要不是他，\n燼牌會整支商隊都餵狼了。' },
      { say: 'gate_captain', text: '……燼牌會的擔保？\n出事的話，你們一起負責。' },
      { say: 'farrow', text: '沒問題！我拿招牌擔保！' },
      { say: 'lian_inner', text: '（當初選擇救商隊，原來在這裡回收。\n善有善報，攻略有伏筆。）' },
      {
        say: 'narration',
        text: '〔法洛替你們擔保入城。〕',
        effects: [{ flag: 'gate_vouched' }, { rep: 'caravan', delta: 5 }],
      },
      { goto: 'gate_in' },
    ],
    gate_choice: [
      {
        choice: [
          {
            text: '「我們是來參加燼牌大賽的。」',
            if: { flag: 'gate_cha_failed', not: true },
            check: { stat: 'cha', dc: 7 },
            effects: [{ flag: 'gate_charmed' }],
            failEffects: [{ flag: 'gate_cha_failed' }],
            next: 'gate_charm_ok',
            fail: 'gate_charm_fail',
          },
          {
            text: '繳入城費（50 金）。',
            effects: [{ gold: -50 }, { flag: 'gate_paid' }],
            next: 'gate_pay',
          },
          { text: '（繞到城牆下的水道口。）', next: 'gate_sewer' },
        ],
      },
    ],
    gate_charm_ok: [
      { say: 'gate_captain', text: '大賽啊……今年參賽的怪人特別多。' },
      { say: 'gate_captain', text: '好吧。輸光了別在城裡鬧事。' },
      { say: 'lian_inner', text: '（魅力檢定通過。我的臉，\n總算有一次派上用場。）' },
      { goto: 'gate_in' },
    ],
    gate_charm_fail: [
      { say: 'gate_captain', text: '每個人都這麼說。下一位。' },
      { say: 'liora', text: '被當成騙子了耶。好新鮮！' },
      { say: 'lian_inner', text: '（……換個方法吧。）' },
      { goto: 'gate_choice' },
    ],
    gate_pay: [
      { say: 'gate_captain', text: '收到。歡迎來到星冠城。' },
      { say: 'liora', text: '五十金！夠我炸三次實驗了！' },
      { say: 'lian_inner', text: '（有錢能使城門開。王都很誠實。）' },
      { goto: 'gate_in' },
    ],
    gate_sewer: [
      { say: 'narration', text: '〔城牆下，一道生鏽的鐵柵半掩著。\n裡面飄出難以形容的氣味。〕' },
      { say: 'io', text: '……連恩，這裡好臭。' },
      { say: 'lian', text: '攻略玩家的老傳統。\n大城市，一定有下水道關卡。' },
      { say: 'narration', text: '〔黑暗中，一雙雙紅眼睛亮了起來。〕', effects: [{ flag: 'gate_sewer' }] },
      { goto: 'sewer_fight' },
    ],
    sewer_fight: [
      { event: 'battle', id: 'sewer_rats', outcomes: { win: 'sewer_won', lose: 'sewer_retry' } },
    ],
    sewer_retry: [
      { say: 'lian_inner', text: '（老鼠會一窩蜂衝上來。\n先用燈印圈住牠們。）' },
      { goto: 'sewer_fight' },
    ],
    sewer_won: [
      { say: 'narration', text: '〔爬出井蓋。眼前是石板小巷，\n頭頂傳來市集的喧嘩。〕' },
      { say: 'liora', text: '我們現在聞起來\n大概像一場失敗的實驗。' },
      { goto: 'gate_in' },
    ],
    gate_in: [
      // 第 2 章暫時離隊的瑟琳，在城門內回歸
      { goto: 'gate_serin_return', if: { flag: 'serin_left_ch2' } },
      { goto: 'gate_done' },
    ],
    gate_serin_return: [
      { goto: 'gate_done', if: { inParty: 'serin' } },
      { say: 'narration', text: '〔街角，一個熟悉的銀甲身影\n正靠著牆等人。〕' },
      { say: 'serin', text: '……慢死了，掌燈人。' },
      { say: 'serin', text: '述職結束了。他們問了很多，\n我答得很少。' },
      { say: 'serin', text: '我說過會回來還命。\n——現在開始還。' },
      { say: 'lian_inner', text: '（她用走的回來了。\n這一筆，我要畫兩個圈。）' },
      {
        say: 'narration',
        text: '〔瑟琳回到了隊伍。〕',
        effects: [{ join: 'serin' }, { flag: 'serin_returned' }, { affinity: 'serin', delta: 5 }],
      },
      { goto: 'gate_done' },
    ],
    gate_done: [
      { say: 'serin', text: '星冠城……離開才半年，\n街上的騎士多了一倍。', if: { flag: 'serin_stayed' } },
      {
        say: 'narration',
        text: '〔你們進入了王都星冠城。〕',
        effects: [{ flag: 'ch3_entered' }, { quest: 'ch3_crown', stage: 1 }],
      },
      { goto: 'end' },
    ],
    gate_revisit: [
      { say: 'gate_captain', text: '入城後別惹事。我記得你的臉。' },
      { goto: 'end' },
    ],

    // ───────── 3-2 星冠廣場（樞紐） ─────────
    plaza: [
      { goto: 'plaza_revisit', if: { flag: 'ch3_plaza_done' } },
      { say: 'narration', text: '〔廣場中央，一座星冠形狀的噴泉。\n四周是商店、騎士團本部，\n和研究院高聳的外牆。〕' },
      { say: 'io', text: '那座塔上面，有星星在轉。' },
      { say: 'liora', text: '那是星術研究院的觀星環。\n……據說，裡面在研究「淨化」。' },
      { say: 'lian_inner', text: '（研究院。鐘喉蠕蟲身上的刻印，\n就是從那面牆後面來的。）' },
      { say: 'narration', text: '〔佈告欄上貼滿了告示。〕' },
      { say: 'narration', text: '〔「燼牌大賽 本週開賽　冠軍獎品：\n傳說牌《星冠》＋研究院參觀許可」〕' },
      { say: 'narration', text: '〔「尋人：近月內城南失蹤者七名，\n知情者請洽騎士團」〕' },
      { say: 'serin', text: '七個人……騎士團沒有公告過這件事。' },
      { say: 'lian_inner', text: '（研究院參觀許可。原作裡，\n這是進入第三章後半的唯一鑰匙。）' },
      { say: 'announcer', text: '燼牌大賽報名最後一天——！\n騎士、礦工、商人，誰都能挑戰！' },
      {
        choice: [
          {
            text: '「我報名。」',
            effects: [{ flag: 'tourney_signed' }, { affinity: 'liora', delta: 3 }],
            next: 'plaza_signup',
          },
          { text: '「先逛逛再說。」', next: 'plaza_browse' },
        ],
      },
    ],
    plaza_signup: [
      { say: 'announcer', text: '好！挑戰者一名！大名是——？' },
      { say: 'lian', text: '連恩。灰燈鎮的掌燈人。' },
      { say: 'liora', text: '我負責解說！你負責贏！' },
      { goto: 'plaza_common' },
    ],
    plaza_browse: [
      { say: 'liora', text: '欸——不報名？那個牌很稀有耶！' },
      { say: 'lian', text: '會報的。我只是想先看看對手。' },
      {
        say: 'narration',
        text: '〔你最後還是在報名表上簽了名。〕',
        effects: [{ flag: 'tourney_signed' }],
      },
      { goto: 'plaza_common' },
    ],
    plaza_common: [
      { say: 'narration', text: '〔人群裡，一個熟悉的背影一閃而過。\n灰外套、舊傷的左手。〕' },
      { say: 'io', text: '……洛克叔叔？' },
      { say: 'farrow', text: '你們在找洛克？他住城西的舊公寓，\n最近都不來牌桌了。', if: { flag: 'saved_caravan' } },
      { say: 'liora', text: '城西的公寓區，問一下就知道了。', if: { flag: 'saved_caravan', not: true } },
      { say: 'lian_inner', text: '（洛克在王都。原作的時間表，\n一分不差。……這反而讓我不安。）' },
      { say: 'liora', text: '對了，晚上有夜市喔！\n王都的夜市，我等好久了！' },
      { say: 'narration', text: '〔廣場旁的商店開張了。〕' },
      { event: 'shop', id: 'capital' },
      {
        say: 'narration',
        text: '〔可以前往：洛克的住處、燼牌大賽、王都夜市。〕',
        effects: [{ flag: 'ch3_plaza_done' }, { quest: 'ch3_crown', stage: 2 }],
      },
      { goto: 'end' },
    ],
    plaza_revisit: [
      { say: 'narration', text: '〔噴泉的水，在陽光下碎成星點。〕', if: { flag: 'ch3_complete', not: true } },
      { say: 'narration', text: '〔黎明後的廣場，人群照常來去。〕', if: { flag: 'ch3_complete' } },
      { event: 'shop', id: 'capital' },
      { goto: 'end' },
    ],

    // ───────── 3-4 洛克的住處：洛克-2「舊傷」 ─────────
    rourke_lodging: [
      { goto: 'lodging_revisit', if: { flag: 'ch3_rourke_met' } },
      { say: 'narration', text: '〔狹窄的閣樓。桌上攤著燼牌，\n牆上釘著一張歪歪扭扭的蠟筆畫。〕' },
      { say: 'rourke', text: '……小鬼？你怎麼會在這。' },
      { say: 'io', text: '洛克叔叔！' },
      { say: 'rourke', text: '……嗯。長高了一點，丫頭。' },
      { say: 'lian_inner', text: '（他笑了。可是眼睛沒有。\n手指一直在洗同一副牌。）' },
      {
        say: 'rourke',
        text: '酒館那局乾淨的牌，我還記得。',
        if: { flag: 'rourke_cheat_known' },
        effects: [{ codex: 'rourke_cheat_known' }],
      },
      { say: 'lian', text: '你看起來很糟。發生什麼事了？' },
      { say: 'rourke', text: '王都的空氣不合我的肺。就這樣。' },
      { say: 'serin', text: '……葛萊姆。我聽過這個名字。\n十二年前，團長的副手。' },
      { say: 'rourke', text: '騎士團的丫頭也在啊。\n……那就瞞不住了。' },
      { say: 'rourke', text: '十二年前，研究院借了騎士團的\n訓練場，做「星燼強化」實驗。' },
      { say: 'rourke', text: '出事那天，三個新兵沒再醒過來。' },
      { say: 'rourke', text: '上頭命令我改報告。\n「訓練意外」。我簽了名。' },
      { say: 'rourke', text: '隔天，我把劍放在團長桌上，走了。' },
      { say: 'serin', text: '……騎士團的紀錄上，\n那只是一場意外。' },
      { say: 'lian_inner', text: '（早期蝕化實驗。原作只用一句話\n帶過——「洛克知道騎士團的黑暗面」。）' },
      {
        choice: [
          {
            text: '「那不是你的錯。但你可以不再沉默。」',
            effects: [{ affinity: 'rourke', delta: 5 }],
            next: 'lodging_kind',
          },
          {
            text: '「所以你知道研究院在做什麼。」',
            effects: [{ affinity: 'rourke', delta: 2 }, { codex: 'early_experiments' }],
            next: 'lodging_press',
          },
        ],
      },
    ],
    lodging_kind: [
      { say: 'rourke', text: '……你這小鬼，講話老是\n往人心口上戳。' },
      { say: 'rourke', text: '沉默是我唯一會的事。\n這十二年，都是這樣過的。' },
      { goto: 'lodging_daughter' },
    ],
    lodging_press: [
      { say: 'rourke', text: '知道一點。知道得越多，\n睡得越少。' },
      { say: 'rourke', text: '別往裡面挖，小鬼。\n那面牆後面，什麼都吃。' },
      { goto: 'lodging_daughter' },
    ],
    lodging_daughter: [
      { say: 'narration', text: '〔你注意到牆上的蠟筆畫：\n一個大人牽著一個小孩。\n角落寫著「緹雅」。〕' },
      { say: 'io', text: '這幅畫好可愛。緹雅是誰？' },
      { say: 'rourke', text: '……房東家的孩子畫的。別亂碰。' },
      { say: 'narration', text: '〔洛克把畫翻了過去。動作很輕。〕' },
      { say: 'lian_inner', text: '（房東家的孩子？……他在說謊。\n而且，筆記裡沒有「緹雅」這個名字。）' },
      { say: 'lian_inner', text: '（筆記只寫：第三章，洛克會交出\n「傳承之燈」。……我得盯緊這盞燈。）' },
      { say: 'rourke', text: '你們要進研究院？\n……那我跟著。至少，我認得路。' },
      {
        say: 'narration',
        text: '〔洛克加入了隊伍。〕',
        effects: [
          { join: 'rourke' },
          { flag: 'bond_rourke_2' },
          { flag: 'ch3_rourke_met' },
          { affinity: 'rourke', delta: 3 },
        ],
      },
      { goto: 'end' },
    ],
    lodging_revisit: [
      { say: 'narration', text: '〔閣樓空著。牆上的畫，\n依然翻在背面。〕' },
      { goto: 'end' },
    ],

    // ───────── 3-3 燼牌大賽（三連戰） ─────────
    tourney: [
      { goto: 'tourney_revisit', if: { flag: 'ch3_tourney_done' } },
      { say: 'narration', text: '〔圓形大廳座無虛席。\n星燈從穹頂垂下，照亮中央的牌桌。〕' },
      { say: 'announcer', text: '各位觀眾！星冠城燼牌大賽，\n正式開打——！' },
      { say: 'announcer', text: '第一戰！騎士團代表，\n「鐵壁」貝洛！' },
      { say: 'duelist_knight', text: '燼牌講究陣形與紀律。\n灰燈鎮來的鄉下牌，撐得住嗎？' },
      { say: 'liora', text: '解說一下！騎士團的牌組防守很硬，\n要用「夜」系的牌繞過去！' },
      { say: 'serin', text: '……貝洛前輩。他從沒輸過新人。', if: { inParty: 'serin' } },
      { event: 'cards', id: 'tourney_knight', outcomes: { win: 'tourney_r2', lose: 'tourney_out' } },
    ],
    tourney_r2: [
      { say: 'duelist_knight', text: '……陣形被拆穿了。\n你的牌，很像在照著誰的路走。' },
      { say: 'lian_inner', text: '（照著前世三百場對戰紀錄走。\n這樣說他大概不會懂。）' },
      { say: 'announcer', text: '第二戰！礦工公會代表，\n「火坑」葛蘭妲！' },
      { goto: 'tourney_r2_friend', if: { repAtLeast: ['miners', 5] } },
      { say: 'duelist_miner', text: '幫騎士團封礦的那個？\n今天讓你嚐嚐礦工的火氣。' },
      { goto: 'tourney_r2_match' },
    ],
    tourney_r2_friend: [
      { say: 'duelist_miner', text: '沉鐘礦坑的鐘聲停了。\n聽說是你幹的？' },
      { say: 'duelist_miner', text: '那這局，我不放水。\n——是尊重的意思。' },
      { goto: 'tourney_r2_match' },
    ],
    tourney_r2_match: [
      { say: 'liora', text: '礦工牌組全是爆發！先擋，\n再一口氣反打！' },
      { event: 'cards', id: 'tourney_miner', outcomes: { win: 'tourney_r3', lose: 'tourney_out' } },
    ],
    tourney_r3: [
      { say: 'duelist_miner', text: '哈！輸得痛快。替我贏下去。' },
      { say: 'announcer', text: '決賽！燼牌會首席莊家——\n「無面」薩伊！' },
      { say: 'dealer', text: '晚安，掌燈人。燼牌會的規矩：\n莊家從不出千。' },
      { say: 'dealer', text: '因為莊家不需要。' },
      { say: 'lian_inner', text: '（薩伊。原作的大賽冠軍，\n牌組是「計算」。每一手都算到底。）' },
      { say: 'rourke', text: '小鬼。他算牌，你就亂他的算。', if: { inParty: 'rourke' } },
      { event: 'cards', id: 'tourney_dealer', outcomes: { win: 'tourney_champion', lose: 'tourney_out' } },
    ],
    tourney_champion: [
      { say: 'narration', text: '〔最後一張牌落下。大廳安靜了一瞬，\n然後爆出歡呼。〕' },
      { say: 'dealer', text: '……我算到了一切，\n除了你會「不按牌理」。' },
      { say: 'announcer', text: '冠軍誕生——！灰燈鎮的掌燈人，連恩！' },
      {
        say: 'narration',
        text: '〔取得傳說牌「星冠」。\n取得「研究院參觀許可」。〕',
        effects: [
          { card: 'n_starcrown' },
          { flag: 'tourney_champion' },
          { flag: 'academy_pass' },
          { rep: 'caravan', delta: 5 },
          { divergence: 3 },
        ],
      },
      { say: 'liora', text: '冠軍！冠軍！我的解說果然是天才級！' },
      { say: 'lian_inner', text: '（原作主角在這裡輸給了薩伊，\n是洛克偷來許可證的。……又偏了一格。）' },
      { goto: 'tourney_serin' },
    ],
    tourney_out: [
      { say: 'announcer', text: '勝負已分！挑戰者連恩，\n止步於此！' },
      { say: 'narration', text: '〔觀眾席傳來嘆息。牌桌上，\n你的燈牌靜靜躺著。〕', effects: [{ flag: 'tourney_lost' }] },
      { say: 'liora', text: '可惡！那手牌明明有機會的……' },
      { say: 'lian_inner', text: '（輸了。參觀許可沒了。\n……那就換條路。研究院總有牆。）' },
      { say: 'rourke', text: '許可證進不去，就翻牆。\n我年輕時翻過。', if: { inParty: 'rourke' } },
      { goto: 'tourney_serin' },
    ],
    // 瑟琳-2「第一次輸」：她在觀眾席看完了全場
    tourney_serin: [
      { goto: 'tourney_serin_talk', if: { all: [{ inParty: 'serin' }, { flag: 'bond_serin_2', not: true }] } },
      { goto: 'tourney_done' },
    ],
    tourney_serin_talk: [
      { say: 'narration', text: '〔散場後，瑟琳還坐在觀眾席最高處。〕' },
      { say: 'serin', text: '十二歲那年，我在這個大廳，\n輸掉了第一場劍術比賽。' },
      { say: 'serin', text: '父親在觀眾席上，一句話都沒說，\n就先走了。' },
      { say: 'serin', text: '那之後，我就決定再也不輸。' },
      { say: 'serin', text: '……你剛才輸的時候，\n為什麼還能笑？', if: { flag: 'tourney_lost' } },
      { say: 'serin', text: '你贏的時候，第一眼在找我們。\n不是在看觀眾。', if: { flag: 'tourney_champion' } },
      {
        choice: [
          {
            text: '「輸一場，不等於輸掉自己。」',
            effects: [{ affinity: 'serin', delta: 10 }],
            next: 'tourney_serin_self',
          },
          {
            text: '「下次換妳上場，我坐這裡看。」',
            effects: [{ affinity: 'serin', delta: 5 }],
            next: 'tourney_serin_watch',
          },
        ],
      },
    ],
    tourney_serin_self: [
      { say: 'serin', text: '……這句話，十二歲的我\n很需要聽到。' },
      { say: 'serin', text: '現在的我，也是。' },
      { goto: 'tourney_serin_end' },
    ],
    tourney_serin_watch: [
      { say: 'serin', text: '你會一句話都不說就先走嗎？' },
      { say: 'lian', text: '我會留到最後，吵到被趕出去。' },
      { say: 'serin', text: '……那很丟臉。不過，好吧。' },
      { goto: 'tourney_serin_end' },
    ],
    tourney_serin_end: [
      { say: 'narration', text: '〔瑟琳站起身，拍了拍你的肩。\n很輕，但很確定。〕', effects: [{ flag: 'bond_serin_2' }] },
      { goto: 'tourney_done' },
    ],
    tourney_done: [
      { say: 'narration', text: '〔燼牌大賽落幕了。〕', effects: [{ flag: 'ch3_tourney_done' }] },
      { goto: 'end' },
    ],
    tourney_revisit: [
      { say: 'announcer', text: '冠軍大人！今天也來看牌嗎？', if: { flag: 'tourney_champion' } },
      { say: 'announcer', text: '明年再來挑戰吧！', if: { flag: 'tourney_lost' } },
      { goto: 'end' },
    ],

    // ───────── 支線：王都夜市（莉歐拉-2「王都的夜市」） ─────────
    night_market: [
      { goto: 'market_revisit', if: { flag: 'ch3_market_done' } },
      { say: 'narration', text: '〔燈籠沿著運河排成一條光帶。\n烤栗子、糖霜星星、會唱歌的風鈴。〕' },
      { say: 'liora', text: '哇啊——！跟小時候聽說的一模一樣！' },
      { say: 'io', text: '連恩，那個星星可以吃嗎？' },
      { say: 'lian', text: '可以。一人一支，我請客。' },
      { say: 'narration', text: '〔一個攤位前，莉歐拉忽然停下腳步。\n攤上擺著小巧的「星燼暖爐」。〕' },
      { say: 'vendor', text: '研究院的新發明！一顆星燼\n能暖一整晚，只要十金！' },
      { say: 'liora', text: '……這個結構，是我三年前\n寄給研究院的設計圖。' },
      { say: 'liora', text: '他們回信說「缺乏實用價值」。' },
      { say: 'lian_inner', text: '（莉歐拉的才華被研究院拿走——\n原作裡，這只是開始。）' },
      {
        choice: [
          {
            text: '「那證明妳是對的。他們只是偷了答案。」',
            effects: [{ affinity: 'liora', delta: 10 }],
            next: 'market_liora_right',
          },
          {
            text: '「下次的發明，只給相信妳的人看。」',
            effects: [{ affinity: 'liora', delta: 5 }],
            next: 'market_liora_trust',
          },
        ],
      },
    ],
    market_liora_right: [
      { say: 'liora', text: '……對耶。我是對的。\n我三年前就是對的！' },
      { say: 'liora', text: '哈哈，好奇怪，\n明明很生氣，卻有點想哭。' },
      { goto: 'market_liora_end' },
    ],
    market_liora_trust: [
      { say: 'liora', text: '相信我的人……\n那現在名單上有三個人喔。' },
      { say: 'liora', text: '你、伊歐，還有……\n那個嘴硬的騎士，勉強算一個。' },
      { goto: 'market_liora_end' },
    ],
    market_liora_end: [
      { say: 'liora', text: '我小時候發誓，有一天要在\n王都夜市擺自己的攤位。' },
      { say: 'liora', text: '賣不會爆炸的東西。……大部分。' },
      { say: 'narration', text: '〔莉歐拉買了一支糖霜星星，\n分成四份。〕', effects: [{ flag: 'bond_liora_2' }] },
      { say: 'narration', text: '〔巷口傳來叫罵聲。幾個混混\n圍住了一個賣花的小攤。〕' },
      {
        choice: [
          {
            text: '「放開她。」（出手）',
            effects: [{ flag: 'market_fought' }, { rep: 'town', delta: 3 }],
            next: 'market_fight',
          },
          {
            text: '「燼牌會的人在附近巡邏喔。」',
            check: { stat: 'cha', dc: 6 },
            effects: [{ flag: 'market_talked' }, { divergence: 1 }],
            next: 'market_talk_ok',
            fail: 'market_fight',
          },
        ],
      },
    ],
    market_fight: [
      { event: 'battle', id: 'alley_thugs', outcomes: { win: 'market_won', lose: 'market_lost' } },
    ],
    market_lost: [
      { say: 'narration', text: '〔混混們搶了錢袋就跑。\n賣花的少女嚇得說不出話。〕', effects: [{ gold: -20 }] },
      { say: 'lian_inner', text: '（……大意了。至少，沒人受傷。）' },
      { goto: 'market_done' },
    ],
    market_won: [
      { say: 'narration', text: '〔混混們落荒而逃。〕' },
      { say: 'liora', text: '我的煙霧彈終於用在\n正確的地方了！' },
      { goto: 'market_done' },
    ],
    market_talk_ok: [
      { say: 'narration', text: '〔混混們互看一眼，嘖了一聲走了。〕' },
      { say: 'liora', text: '哇，靠嘴巴就贏了。好沒有爆炸感。' },
      { goto: 'market_done' },
    ],
    market_done: [
      { say: 'narration', text: '〔賣花的少女塞給伊歐一朵白花。〕' },
      { say: 'io', text: '謝謝。……我會記住你的。' },
      {
        say: 'narration',
        text: '〔夜市的燈，一盞一盞亮到很晚。〕',
        effects: [{ flag: 'ch3_market_done' }, { item: 'potion_s' }],
      },
      { goto: 'end' },
    ],
    market_revisit: [
      { say: 'vendor', text: '糖霜星星，一支三金喔！' },
      { goto: 'end' },
    ],

    // ───────── 3-5 星術研究院 ─────────
    academy: [
      { goto: 'academy_revisit', if: { flag: 'ch3_academy_done' } },
      { goto: 'academy_tour', if: { flag: 'academy_pass' } },
      { goto: 'academy_sneak' },
    ],
    academy_tour: [
      { say: 'narration', text: '〔研究院正門。純白的長廊，\n每一步都有回音。〕' },
      { say: 'researcher', text: '大賽冠軍閣下，歡迎參觀。\n請勿離開導覽路線。' },
      { say: 'liora', text: '（小聲）導覽路線，\n就是他們想讓我們看的東西。' },
      { say: 'rourke', text: '左邊第三扇門。\n導覽不會經過那裡。', if: { inParty: 'rourke' } },
      { say: 'narration', text: '〔趁研究員轉身，你們溜進了側廊。〕' },
      { goto: 'academy_evidence' },
    ],
    // 潛入路線（大賽落敗）
    academy_sneak: [
      { say: 'narration', text: '〔深夜。研究院後牆，\n巡邏的燈光規律地掃過。〕' },
      { say: 'rourke', text: '排水溝上面那段牆最矮。\n我十二年前就是從這裡出去的。', if: { inParty: 'rourke' } },
      { say: 'lian_inner', text: '（潛入任務。原作沒有這段——\n因為原作主角拿到了許可證。）', effects: [{ flag: 'academy_sneaked' }] },
      {
        choice: [
          {
            text: '翻過矮牆。',
            check: { stat: 'agi', dc: 6 },
            next: 'sneak_inside',
            fail: 'sneak_noisy',
          },
          { text: '等巡邏換班再走。', next: 'sneak_inside' },
        ],
      },
    ],
    sneak_noisy: [
      { say: 'narration', text: '〔落地時踢到了花盆。\n遠處的燈光停了一下。〕' },
      { say: 'liora', text: '……我發誓這次不是我。' },
      { goto: 'sneak_inside' },
    ],
    sneak_inside: [
      { say: 'narration', text: '〔中庭。一名守衛提著星燈，\n正朝檔案室的方向巡過來。〕' },
      {
        choice: [
          { text: '「上，速戰速決。」', next: 'sneak_fight' },
          {
            text: '躲進柱子的陰影。',
            check: { stat: 'agi', dc: 8 },
            effects: [{ divergence: 1 }],
            next: 'sneak_hidden',
            fail: 'sneak_fight',
          },
        ],
      },
    ],
    sneak_hidden: [
      { say: 'narration', text: '〔守衛從你們面前走過，\n什麼都沒發現。〕' },
      { say: 'io', text: '（小聲）……心臟跳好大聲。' },
      { goto: 'academy_evidence' },
    ],
    sneak_fight: [
      { event: 'battle', id: 'academy_guard', outcomes: { win: 'sneak_won', lose: 'sneak_retry' } },
    ],
    sneak_retry: [
      { say: 'lian_inner', text: '（守衛的星術盾會反彈光。\n先打破盾，再點燈。）' },
      { goto: 'sneak_fight' },
    ],
    sneak_won: [
      { say: 'narration', text: '〔守衛倒下前，沒來得及吹響警笛。〕' },
      { say: 'serin', text: '……他只是奉命行事。綁好就好。', if: { inParty: 'serin' } },
      { goto: 'academy_evidence' },
    ],
    academy_evidence: [
      { say: 'narration', text: '〔檔案室深處，一排玻璃櫃。\n櫃裡的結晶布滿裂紋，\n裂紋裡流著暗紅的光。〕' },
      { say: 'liora', text: '這是……蝕化的星燼。\n他們把蝕化「培養」在結晶裡。' },
      { say: 'liora', text: '標籤上寫：「淨化兵器 第七號」。\n和鐘喉蠕蟲的刻印一樣。', if: { flag: 'academy_mark' } },
      { say: 'liora', text: '標籤上寫：「淨化兵器 第七號」。', if: { flag: 'academy_mark', not: true } },
      { say: 'serin', text: '城南失蹤的七個人……\n難道，「第七號」是——', if: { inParty: 'serin' } },
      { say: 'rourke', text: '……跟十二年前一樣。\n他們從來沒停過。', if: { inParty: 'rourke' } },
      { say: 'valderan', text: '請不要碰那個櫃子。\n它比看起來還要脆弱。' },
      { say: 'narration', text: '〔門口站著一位白袍老人。\n笑容溫和，像在迎接遲到的學生。〕' },
      {
        say: 'lian_inner',
        text: '（大司星，瓦爾德蘭。原作最終章\n之前的最後一道門。）',
        effects: [{ codex: 'valderan' }],
      },
      { say: 'valderan', text: '別緊張。我不叫守衛，\n只是想說說話。' },
      { say: 'valderan', text: '蝕化會吞噬世界，孩子。\n礦脈、森林、人心，一樣一樣地。' },
      { say: 'valderan', text: '要對抗蝕化，就得先理解它。\n理解，總是需要代價。' },
      { say: 'serin', text: '用失蹤的人當代價嗎？', if: { inParty: 'serin' } },
      { say: 'valderan', text: '用「少數」換「全部」。\n騎士團教妳的，不也是這個嗎？' },
      { say: 'narration', text: '〔瓦爾德蘭的目光，停在伊歐身上。\n停得有點太久。〕' },
      { say: 'valderan', text: '……真是個特別的孩子。\n她的光，不屬於這個世界。' },
      { say: 'io', text: '……連恩。我不喜歡他看我的樣子。' },
      { say: 'valderan', text: '掌燈人。你提著燈，\n卻還不知道燈該照向誰。' },
      { say: 'valderan', text: '加入我吧。研究院需要你這種，\n看得見「未來」的眼睛。' },
      { say: 'lian_inner', text: '（他知道多少？……不，冷靜。\n現在的選擇，會決定第四章怎麼打。）' },
      {
        choice: [
          {
            text: '「你的『淨化』，我會讓全城知道。」',
            effects: [
              { rep: 'order', delta: -20 },
              { rep: 'town', delta: 10 },
              { divergence: 5 },
              { flag: 'exposed_valderan' },
              { affinity: 'liora', delta: 5 },
            ],
            next: 'academy_expose',
          },
          {
            text: '「……我需要時間考慮。」（假裝合作）',
            effects: [{ flag: 'double_agent' }, { affinity: 'rourke', delta: 3 }],
            next: 'academy_double',
          },
        ],
      },
    ],
    academy_expose: [
      { say: 'valderan', text: '……可惜。年輕人總是\n把真相當成武器。' },
      { say: 'valderan', text: '那就讓我們看看，\n這座城會站在誰那邊。' },
      { say: 'narration', text: '〔警鐘響徹研究院。你們一路衝出側門，\n把結晶的紀錄撒向夜空。〕' },
      { say: 'serin', text: '……從今天起，我是騎士團的叛徒了。', if: { inParty: 'serin' } },
      { say: 'serin', text: '不過，感覺意外地不差。', if: { inParty: 'serin' } },
      { say: 'lian_inner', text: '（被通緝了。第四章會很難打。\n但至少，城裡的人開始抬頭看了。）' },
      { goto: 'academy_done' },
    ],
    academy_double: [
      { say: 'valderan', text: '聰明的回答。三天後，\n我會派人去你的旅店。' },
      { say: 'valderan', text: '在那之前，好好休息。' },
      { say: 'narration', text: '〔你們被客氣地「送」出了研究院。〕' },
      { say: 'liora', text: '你不會真的要加入吧？' },
      { say: 'lian', text: '要從裡面拆掉一面牆，\n得先走進牆裡。' },
      { say: 'liora', text: '……好吧。那我負責準備炸藥。' },
      { goto: 'academy_done' },
    ],
    academy_done: [
      { say: 'rourke', text: '……小鬼。今晚早點睡。', if: { inParty: 'rourke' } },
      { say: 'lian_inner', text: '（洛克的聲音，有點啞。\n我把傳承之燈，壓在枕頭底下。）' },
      {
        say: 'narration',
        text: '〔你們回到旅店。夜深了。〕',
        effects: [{ flag: 'ch3_academy_done' }, { quest: 'ch3_crown', stage: 3 }],
      },
      { goto: 'end' },
    ],
    academy_revisit: [
      { say: 'narration', text: '〔研究院的大門緊閉。\n觀星環在夜空裡無聲地轉。〕' },
      { goto: 'end' },
    ],

    // ───────── 3-6 背叛（第一次知識失準） ─────────
    inn_night: [
      { goto: 'inn_revisit', if: { flag: 'ch3_betrayal' } },
      { say: 'narration', text: '〔下雨了。雨聲裡，\n伊歐在隔壁床輕輕哼著那五個音。〕' },
      { say: 'io', text: '連恩，下雨的時候，\n歌聲會傳得比較遠嗎？' },
      { say: 'lian', text: '會吧。睡吧，明天還要忙。' },
      { say: 'io', text: '嗯。晚安。……明天也要在喔。' },
      { say: 'narration', text: '〔……不知過了多久。\n門軸發出一聲極輕的響。〕' },
      { say: 'lian_inner', text: '（來了。原作的這一晚。\n我一直醒著，手按在燈上。）' },
      { say: 'lian_inner', text: '（燈還在。——那他要拿走的是……）' },
      { say: 'narration', text: '〔窗外的雨幕中，洛克抱著熟睡的伊歐，\n走向一輛研究院的馬車。〕' },
      { say: 'lian', text: '洛克！！' },
      { say: 'rourke', text: '……對不起，小鬼。' },
      { say: 'rourke', text: '他們抓了緹雅。我的女兒。\n用一個人，換一個人。' },
      { say: 'rourke', text: '這筆帳，你以後再找我算。' },
      {
        say: 'narration',
        text: '〔馬車消失在雨夜裡。\n伊歐和洛克，都不見了。〕',
        effects: [{ leave: 'io' }, { leave: 'rourke' }, { flag: 'io_taken' }],
      },
      { say: 'lian_inner', text: '（筆記。筆記上寫的是——）' },
      { say: 'narration', text: '〔攻略筆記・第三章：「洛克背叛：\n交出傳承之燈」。〕' },
      { say: 'lian_inner', text: '（不是燈。是伊歐。\n——筆記，錯了。）' },
      { event: 'codexBurn', id: 'rourke_betrayal' },
      {
        say: 'narration',
        text: '〔書頁從邊緣開始燃燒。\n字跡化成灰，再也讀不出來。〕',
        effects: [{ codex: 'rourke_betrayal' }, { divergence: 5 }],
      },
      { say: 'lian_inner', text: '（我改變了太多。燈在我手上，\n所以他們要了別的東西。）' },
      { say: 'lian_inner', text: '（從這一頁開始，\n我不再是「知道結局的人」了。）' },
      { say: 'liora', text: '連恩！外面怎麼了？伊歐呢？！' },
      { say: 'serin', text: '馬車往鐘塔的方向去了……\n不，有人上了鐘塔屋頂。', if: { inParty: 'serin' } },
      { say: 'lian', text: '是洛克。他在等我們。' },
      {
        say: 'narration',
        text: '〔雨還在下。〕',
        effects: [{ flag: 'ch3_betrayal' }, { quest: 'ch3_crown', stage: 4 }],
      },
      { goto: 'end' },
    ],
    inn_revisit: [
      { say: 'narration', text: '〔伊歐的床鋪還是亂的。\n枕邊留著那朵白花。〕' },
      { goto: 'end' },
    ],

    // ───────── Boss：洛克（鐘塔屋頂，最多三場，中間以說服打斷） ─────────
    rourke_duel: [
      { goto: 'duel_revisit', if: { flag: 'ch3_duel_done' } },
      { say: 'narration', text: '〔鐘塔屋頂。雨水順著石瓦流下。\n洛克背對著你們，盾斜靠在腳邊。〕' },
      { say: 'rourke', text: '馬車已經走了。追不上的。' },
      { say: 'rourke', text: '我答應他們，攔住你們到天亮。' },
      { say: 'lian', text: '你明明可以跟我們說。' },
      { say: 'rourke', text: '說了，你們就會去救緹雅。\n然後你們也會被關進去。' },
      { say: 'rourke', text: '……拔劍吧，小鬼。\n這是我最後一場不乾淨的牌局。' },
      {
        say: 'lian_inner',
        text: '（洛克，Lv 13。坦克型，反擊很重。\n——但我不想打倒他。我想把他打醒。）',
        effects: [{ codex: 'boss_rourke' }],
      },
      { goto: 'duel_fight_1' },
    ],
    duel_fight_1: [
      { event: 'battle', id: 'rourke_1', outcomes: { win: 'duel_persuade_1', lose: 'duel_retry_1' } },
    ],
    duel_retry_1: [
      { say: 'lian_inner', text: '（他舉盾時別出手，會被反擊。\n等他放下盾的那一拍。）' },
      { goto: 'duel_fight_1' },
    ],
    duel_persuade_1: [
      { say: 'rourke', text: '……哈。還站得起來啊。' },
      { say: 'lian_inner', text: '（他在喘氣。現在，他聽得見。）' },
      persuade('duel_fail_1'),
    ],
    duel_fail_1: [
      { say: 'rourke', text: '……說得好聽。可緹雅不在你那邊。' },
      { say: 'narration', text: '〔洛克重新舉起了盾。〕' },
      { goto: 'duel_fight_2' },
    ],
    duel_fight_2: [
      { event: 'battle', id: 'rourke_2', outcomes: { win: 'duel_persuade_2', lose: 'duel_retry_2' } },
    ],
    duel_retry_2: [
      { say: 'lian_inner', text: '（他越打越慢。撐住，\n讓他先累。）' },
      { goto: 'duel_fight_2' },
    ],
    duel_persuade_2: [
      { say: 'rourke', text: '別再過來了……我不想傷你。' },
      { say: 'lian_inner', text: '（他的盾在發抖。還有機會。）' },
      persuade('duel_fail_2'),
    ],
    duel_fail_2: [
      { say: 'rourke', text: '別說了！你不懂……\n她才九歲！' },
      { say: 'narration', text: '〔雷聲。洛克咆哮著衝了過來。〕' },
      { goto: 'duel_fight_3' },
    ],
    duel_fight_3: [
      { event: 'battle', id: 'rourke_3', outcomes: { win: 'duel_persuade_3', lose: 'duel_retry_3' } },
    ],
    duel_retry_3: [
      { say: 'lian_inner', text: '（最後一段了。他已經\n站不太穩。我也是。）' },
      { goto: 'duel_fight_3' },
    ],
    duel_persuade_3: [
      { say: 'narration', text: '〔洛克單膝跪在積水裡，\n盾從手中滑落。〕' },
      { say: 'lian_inner', text: '（最後的機會。說錯了，\n他就會一個人扛到最後。）' },
      persuade('duel_fail_3'),
    ],
    duel_fail_3: [
      { say: 'rourke', text: '……抱歉啊，小鬼。\n老子的牌，已經打完了。' },
      { say: 'narration', text: '〔洛克倒在雨中。〕' },
      { goto: 'duel_lost' },
    ],
    duel_lost: [
      { say: 'narration', text: '〔你轉身去拿傷藥的那一瞬，\n他撐著盾，消失在屋頂的另一側。〕' },
      { say: 'narration', text: '〔積水裡，留下一張研究院的通行牌。\n背面寫著：「星核爐」。〕' },
      { say: 'lian_inner', text: '（……我沒能把他拉回來。\n這一頁，筆記也救不了。）' },
      {
        say: 'narration',
        text: '〔洛克離開了。〕',
        effects: [{ flag: 'rourke_lost' }, { affinity: 'rourke', delta: -5 }],
      },
      { goto: 'duel_done' },
    ],
    duel_turned_codex: [
      { say: 'rourke', text: '……乾淨的牌局。' },
      { say: 'rourke', text: '那天我輸給你，是第一次\n覺得輸了也不錯。' },
      { say: 'lian', text: '那就再打一局乾淨的。\n這次，把緹雅贏回來。' },
      { goto: 'duel_turned' },
    ],
    duel_turned_bond: [
      { say: 'rourke', text: '……「別讓它發生」。\n那是我在營火邊說的。' },
      { say: 'rourke', text: '結果，讓它發生的人，\n是我自己。' },
      { say: 'lian', text: '還沒結束。現在回頭，\n就還來得及。' },
      { goto: 'duel_turned' },
    ],
    duel_turned_talk: [
      { say: 'lian', text: '你一個人換不回緹雅。\n他們不會守約的，你比我清楚。' },
      { say: 'lian', text: '但我們一起，就能兩個都救。' },
      { say: 'rourke', text: '……十二年前，要是有人\n這樣對我說就好了。' },
      { goto: 'duel_turned' },
    ],
    // 洛克-3「女兒」
    duel_turned: [
      { say: 'narration', text: '〔洛克放下了盾。雨，小了一點。〕' },
      { say: 'rourke', text: '緹雅是我離開騎士團那年出生的。\n她媽媽走得早。' },
      { say: 'rourke', text: '一個月前，研究院的人說，\n她有「適合研究的天分」。' },
      { say: 'rourke', text: '然後就把她帶走了。\n每週給我一封她寫的信。' },
      { say: 'rourke', text: '伊歐……被帶去研究院地下。\n他們叫那裡「星核爐」。' },
      { say: 'rourke', text: '緹雅應該也在那附近。\n……我會帶路。這次是真的。' },
      { say: 'liora', text: '你這個大笨蛋……早說的話，\n我就不用哭這麼久了！' },
      {
        say: 'narration',
        text: '〔洛克回到了隊伍。〕',
        effects: [
          { flag: 'rourke_turned' },
          { join: 'rourke' },
          { flag: 'bond_rourke_3' },
          { affinity: 'rourke', delta: 5 },
          { divergence: 5 },
        ],
      },
      { say: 'lian_inner', text: '（原作裡，主角在這裡打倒了洛克。\n——這一頁，是我自己寫的。）' },
      { goto: 'duel_done' },
    ],
    duel_done: [
      {
        say: 'narration',
        text: '〔東方的天空，開始泛白。〕',
        effects: [{ flag: 'ch3_duel_done' }, { quest: 'ch3_crown', stage: 5 }],
      },
      { goto: 'end' },
    ],
    duel_revisit: [
      { say: 'narration', text: '〔鐘塔屋頂。積水裡映著灰白的天。〕' },
      { goto: 'end' },
    ],

    // ───────── 3-7 結尾：黎明的廣場 ─────────
    ending: [
      { goto: 'ending_revisit', if: { flag: 'ch3_complete' } },
      { say: 'narration', text: '〔黎明。星冠噴泉的水聲，\n比昨天冷了一些。〕' },
      { say: 'rourke', text: '研究院地下三層。星核爐在最底，\n守備最嚴的地方。', if: { flag: 'rourke_turned' } },
      { say: 'liora', text: '這張通行牌……只能到地下二層。\n剩下的，得自己想辦法。', if: { flag: 'rourke_lost' } },
      {
        say: 'lian_inner',
        text: '（星核爐。筆記裡只有一行：\n「第四章最終區域」。其他的，燒掉了。）',
        effects: [{ codex: 'star_core_furnace' }],
      },
      { say: 'narration', text: '〔廣場的牆上，貼滿了研究院的告示。\n有人把它們撕了下來。〕', if: { flag: 'exposed_valderan' } },
      { say: 'narration', text: '〔旅店櫃檯留了一封信。\n封蠟上，是研究院的星冠印。〕', if: { flag: 'double_agent' } },
      // 莉歐拉、瑟琳的小片段
      { say: 'liora', text: '連恩。我要做一個新發明。' },
      { say: 'liora', text: '能把伊歐從那個爐子裡\n拉出來的東西。……這次，為了她。' },
      { say: 'serin', text: '我在大廳說過，不想再輸。', if: { inParty: 'serin' } },
      { say: 'serin', text: '昨晚，我們輸了一次。\n所以接下來，一次都不准輸。', if: { inParty: 'serin' } },
      { say: 'lian', text: '嗯。這次，換我們去接她。' },
      { say: 'lian_inner', text: '（筆記燒掉了一頁。\n可是伊歐說過——「我們一起寫上去」。）' },
      // 章末畫面「你的選擇」
      { event: 'summary', id: 'ch3' },
      { effects: [{ flag: 'ch3_complete' }, { quest: 'ch3_crown', stage: 6, done: true }] },
      { say: 'narration', text: '〔研究院的觀星環，在晨光中緩緩停下。〕' },
      { say: 'lian_inner', text: '（第四章「星核」。\n從這裡開始，沒有攻略了。）' },
      { event: 'chapterCard', id: 'ch4' },
      { goto: 'end' },
    ],
    ending_revisit: [
      { say: 'narration', text: '〔廣場上的人們，偶爾抬頭望向研究院。〕' },
      { goto: 'end' },
    ],

    // ───────── 王都商店街（探索中隨時可以買賣） ─────────
    capital_shop: [
      { say: 'vendor', text: '王都的貨，品質保證！慢慢挑。' },
      { event: 'shop', id: 'capital' },
      { goto: 'end' },
    ],

    end: [],
  },
};
