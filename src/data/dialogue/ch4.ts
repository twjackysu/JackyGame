// 第 4 章「星核」。來源：docs/design/10-story-ch2-final.md §第 4 章、§羈絆事件總表。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
//
// 與前幾章相同，由節點地圖（MapScene）驅動：點擊地點 → 從 CH4_ENTRIES 的入口節點開始，
// 跑到節點結尾（'end'）後交回地圖。進度以 ch4_* 旗標推進。
// 章節卡「第四章 星核」已在第 3 章結尾播放，本章開頭不再重複；結尾播放 ch5 的章節卡。
//
// 本章新增旗標：
//   ch4_entered / ch4_archive_done / ch4_cells_done / ch4_lab_done / ch4_campfire /
//   ch4_complete（進度）
//   ch4_quiet_entry（內應潛入）/ ch4_gate_breached（正面突破）/ ch4_spotted（潛入時被瞥見）
//   research_destroyed / research_kept（4-2 莉歐拉的選擇，影響結局）、bond_liora_3
//   tia_rescued（收容區，可選）
//   lab_int_failed / lab_str_failed（實驗區檢定失敗，隱藏該選項）、lab_hacked / lab_pried
//   bond_serin_3、rourke_campfire
//   valderan_refused / valderan_tempted（瓦爾德蘭的邀請）
//   io_rescued、took_core / core_sealed（星核爐的抉擇）、rift_open
import type { DialogueScript } from '../../core/dialogue/runner';
import type { Condition } from '../../core/state/gameState';

/** 地圖入口（依劇情順序）。node = 點擊地點時要啟動的節點。收容區為可選支線。 */
export const CH4_ENTRIES: { node: string; location: string; title: string; requires?: Condition }[] = [
  { node: 'infiltrate', location: 'academy_entrance', title: '研究院入口', requires: { flag: 'ch3_complete' } },
  { node: 'archive', location: 'archive', title: '研究檔案室', requires: { flag: 'ch4_entered' } },
  { node: 'cells', location: 'holding_cells', title: '收容區', requires: { flag: 'ch4_entered' } },
  { node: 'lab', location: 'lab', title: '實驗區', requires: { flag: 'ch4_archive_done' } },
  { node: 'camp', location: 'hidden_camp', title: '通風井的營火', requires: { flag: 'ch4_lab_done' } },
  { node: 'furnace', location: 'star_furnace', title: '星核爐', requires: { flag: 'ch4_campfire' } },
];

export const CH4: DialogueScript = {
  id: 'ch4',
  start: 'infiltrate',
  nodes: {
    // ───────── 4-1 潛入 ─────────
    infiltrate: [
      { goto: 'infiltrate_revisit', if: { flag: 'ch4_entered' } },
      { say: 'narration', text: '〔深夜。研究院的觀星環停在半空，\n像一隻閉上的眼睛。〕' },
      { say: 'lian_inner', text: '（第四章。筆記上這一區，\n只剩一行字和一圈焦痕。）' },
      { say: 'rourke', text: '地下三層，我走過兩次。\n第三次，換我帶你們走。', if: { inParty: 'rourke' } },
      { say: 'liora', text: '這張通行牌只到地下二層。\n剩下的路，靠我們自己。', if: { flag: 'rourke_lost' } },
      { goto: 'infiltrate_contact', if: { flag: 'double_agent' } },
      { goto: 'infiltrate_breach' },
    ],
    infiltrate_contact: [
      { say: 'narration', text: '〔側門無聲地開了一條縫。\n一個抱著卷宗的研究員探出頭。〕' },
      { say: 'contact', text: '是你吧，那位「合作者」？\n……我也是。假裝了三年。' },
      { say: 'contact', text: '巡邏每六十息換一班。\n換班的空檔，跟緊我。' },
      { say: 'lian_inner', text: '（假裝合作那一步，原來在這裡兌現。\n雙面人也有雙面人的朋友。）' },
      {
        choice: [
          {
            text: '[敏 6] 貼著陰影，數著腳步跟上。',
            check: { stat: 'agi', dc: 6 },
            next: 'contact_ok',
            fail: 'contact_spotted',
          },
          { text: '（讓瑟琳開路，自己殿後。）', next: 'contact_ok' },
        ],
      },
    ],
    contact_ok: [
      { say: 'narration', text: '〔巡邏的燈光從頭頂掠過。\n沒有人回頭。〕' },
      { say: 'contact', text: '到了。往下就是檔案室。\n我只能送到這裡——祝好運。' },
      { say: 'narration', text: '〔你們悄悄進入了研究院地下。〕', effects: [{ flag: 'ch4_quiet_entry' }] },
      { goto: 'infiltrate_done' },
    ],
    contact_spotted: [
      { say: 'narration', text: '〔腳下的鐵板「喀」地響了一聲。\n守衛轉過頭來。〕' },
      { say: 'contact', text: '是、是老鼠！最近好多老鼠！' },
      { say: 'lian_inner', text: '（……被當成老鼠。\n轉生之後，我的待遇一路下滑。）' },
      { say: 'narration', text: '〔守衛嘀咕著走遠了。〕', effects: [{ flag: 'ch4_spotted' }, { flag: 'ch4_quiet_entry' }] },
      { goto: 'infiltrate_done' },
    ],
    infiltrate_breach: [
      { say: 'narration', text: '〔正門前，一排星術守衛\n早已舉起法杖。〕' },
      { say: 'serin', text: '揭發了大司星，就別指望\n他們替我們開門。' },
      { say: 'lian', text: '那就敲門。用力一點。' },
      { goto: 'gate_fight' },
    ],
    gate_fight: [{ event: 'battle', id: 'ch4_gate', outcomes: { win: 'gate_won', lose: 'gate_retry' } }],
    gate_retry: [
      { say: 'lian_inner', text: '（守衛輪流施法。先打斷\n舉杖最久的那一個。）' },
      { goto: 'gate_fight' },
    ],
    gate_won: [
      { say: 'narration', text: '〔大門倒下。警鐘在走廊深處響起。〕' },
      { say: 'liora', text: '好！門是我炸的！\n這次絕對是藝術！' },
      { say: 'narration', text: '〔你們衝進了研究院地下。〕', effects: [{ flag: 'ch4_gate_breached' }] },
      { goto: 'infiltrate_done' },
    ],
    infiltrate_done: [
      { effects: [{ flag: 'ch4_entered' }, { quest: 'ch4_core', stage: 1 }] },
      { goto: 'end' },
    ],
    infiltrate_revisit: [
      { say: 'narration', text: '〔入口的燈忽明忽暗。\n往下的階梯一片寂靜。〕' },
      { goto: 'end' },
    ],

    // ───────── 4-2 研究檔案室（莉歐拉-3「為誰而創造」） ─────────
    archive: [
      { goto: 'archive_revisit', if: { flag: 'ch4_archive_done' } },
      { say: 'narration', text: '〔一整面牆的卷宗，\n標籤上寫著「蝕化應用」。〕' },
      { say: 'liora', text: '……這個筆跡。這是我的。' },
      { say: 'liora', text: '「燼能穩定式」。我十五歲寫的，\n本來是給礦燈用的。' },
      { say: 'liora', text: '他們把它改成了……\n讓人變成蝕化兵器的東西。' },
      { say: 'lian_inner', text: '（原作裡，莉歐拉在這裡崩潰，\n然後離隊。那條線叫「餘燼」。）' },
      { say: 'liora', text: '連恩，我做東西，是為了\n讓人笑。不是為了這個。' },
      {
        choice: [
          { text: '「燒掉吧。它不該存在。」', next: 'archive_destroy' },
          { text: '「留著。知道它怎麼運作，\n才知道怎麼阻止它。」', next: 'archive_keep' },
        ],
      },
    ],
    archive_destroy: [
      { say: 'liora', text: '……嗯。我自己來。' },
      { say: 'narration', text: '〔莉歐拉點燃了卷宗。\n火光映著她的臉，很安靜。〕' },
      { say: 'liora', text: '下一個發明，我想好了。\n要做給「誰」，我也想好了。' },
      {
        say: 'lian_inner',
        text: '（她沒有離隊。\n「餘燼」那條線，在這裡斷了。）',
        effects: [{ flag: 'research_destroyed' }, { affinity: 'liora', delta: 5 }, { divergence: 5 }],
      },
      { goto: 'archive_done' },
    ],
    archive_keep: [
      { say: 'liora', text: '……你說得對。逃避的話，\n它還是會被別人寫出來。' },
      { say: 'narration', text: '〔莉歐拉把卷宗收進背包。\n她的手抖了一下，然後停住。〕' },
      { say: 'liora', text: '這次，我會決定它被用在哪裡。', effects: [{ flag: 'research_kept' }] },
      { goto: 'archive_done' },
    ],
    archive_done: [
      {
        say: 'narration',
        text: '〔莉歐拉的羈絆加深了。〕',
        effects: [{ flag: 'bond_liora_3' }, { flag: 'ch4_archive_done' }, { quest: 'ch4_core', stage: 2 }],
      },
      { goto: 'end' },
    ],
    archive_revisit: [
      { say: 'liora', text: '這裡……我不想再待太久。' },
      { goto: 'end' },
    ],

    // ───────── 收容區（可選）：緹雅 ─────────
    cells: [
      { goto: 'cells_revisit', if: { flag: 'ch4_cells_done' } },
      { say: 'narration', text: '〔一排玻璃房間。大多是空的。\n最裡面那間，亮著一盞小燈。〕' },
      { say: 'tia', text: '……你們是誰？\n今天不是寫信的日子。' },
      { goto: 'cells_rourke', if: { flag: 'rourke_turned' } },
      { goto: 'cells_alone' },
    ],
    cells_rourke: [
      { say: 'rourke', text: '……緹雅。' },
      { say: 'tia', text: '爸爸！？你的鬍子變長了！' },
      { say: 'rourke', text: '對不起。爸爸做了很多……\n不該做的事。' },
      { say: 'tia', text: '我知道。信上你寫錯好多字，\n每次都是。' },
      { say: 'lian_inner', text: '（原作裡沒有這一幕。\n因為原作的洛克，沒能走到這裡。）' },
      {
        say: 'narration',
        text: '〔洛克打碎了玻璃，緊緊抱住女兒。〕',
        effects: [{ flag: 'tia_rescued' }, { affinity: 'rourke', delta: 10 }],
      },
      { say: 'rourke', text: '小鬼。這份情，\n老子用一輩子還。' },
      { goto: 'cells_done' },
    ],
    cells_alone: [
      { say: 'lian', text: '我們是洛克的朋友。\n——你是緹雅吧？' },
      { say: 'tia', text: '爸爸呢？他說過會來接我。' },
      { say: 'lian_inner', text: '（他走了。我沒能拉住他。\n……但這件事，我還能做。）' },
      { say: 'lian', text: '他在路上。在那之前，\n我先帶你出去。我保證。' },
      { say: 'tia', text: '……打勾勾。騙人的要吞燈芯。' },
      {
        say: 'narration',
        text: '〔緹雅握住了你的小指。\n你們把她送往通風井的安全處。〕',
        effects: [{ flag: 'tia_rescued' }, { divergence: 3 }],
      },
      { goto: 'cells_done' },
    ],
    cells_done: [{ effects: [{ flag: 'ch4_cells_done' }] }, { goto: 'end' }],
    cells_revisit: [
      { say: 'narration', text: '〔空了的玻璃房裡，\n留著一張畫了燈的圖。〕' },
      { goto: 'end' },
    ],

    // ───────── 4-3 實驗區（筆記失準） ─────────
    lab: [
      { goto: 'lab_revisit', if: { flag: 'ch4_lab_done' } },
      { say: 'narration', text: '〔一扇刻滿星紋的閘門。\n門後傳來沉重的腳步聲。〕' },
      { say: 'lian_inner', text: '（筆記，「實驗區配置」那頁——\n……空白。邊緣燒焦了。）' },
      { say: 'lian_inner', text: '（不只這頁。密碼、路線、弱點，\n全都在冒煙。）' },
      { say: 'serin', text: '連恩？你的臉色很差。' },
      { say: 'lian', text: '沒事。只是從現在開始，\n我跟你們一樣，什麼都不知道。' },
      { goto: 'lab_choice' },
    ],
    lab_choice: [
      {
        choice: [
          {
            // 筆記已燒毀 → 不會持有此條目，選項不顯示
            text: '[筆記] 照攻略輸入閘門密碼。',
            if: { hasCodex: 'lab_layout' },
            check: { codex: 'lab_layout' },
            next: 'lab_hacked',
          },
          {
            text: '[智 7] 解讀星紋的排列規則。',
            if: { flag: 'lab_int_failed', not: true },
            check: { stat: 'int', dc: 7 },
            failEffects: [{ flag: 'lab_int_failed' }],
            next: 'lab_hacked',
            fail: 'lab_int_fail',
          },
          {
            text: '[力 6] 把閘門硬撬開。',
            if: { flag: 'lab_str_failed', not: true },
            check: { stat: 'str', dc: 6 },
            failEffects: [{ flag: 'lab_str_failed' }],
            next: 'lab_pried',
            fail: 'lab_str_fail',
          },
          { text: '（等守衛開門，正面迎擊。）', next: 'lab_fight_a' },
        ],
      },
    ],
    lab_int_fail: [
      { say: 'narration', text: '〔星紋閃了一下紅光。錯誤。〕' },
      { say: 'liora', text: '我也看不懂！這是故意\n寫得很醜的那種密碼！' },
      { goto: 'lab_choice' },
    ],
    lab_str_fail: [
      { say: 'narration', text: '〔閘門紋絲不動。你的肩膀\n倒是發出了奇怪的聲音。〕' },
      { say: 'lian_inner', text: '（力量 6……我高估了自己。）' },
      { goto: 'lab_choice' },
    ],
    lab_hacked: [
      { say: 'narration', text: '〔星紋一圈圈熄滅，閘門滑開。〕', effects: [{ flag: 'lab_hacked' }] },
      { say: 'lian_inner', text: '（不靠筆記，自己解開的。\n……原來是這種感覺。）' },
      { goto: 'lab_fight_a' },
    ],
    lab_pried: [
      { say: 'narration', text: '〔金屬尖叫著扭開一道縫。〕', effects: [{ flag: 'lab_pried' }] },
      { say: 'serin', text: '……你什麼時候變這麼壯的？' },
      { goto: 'lab_fight_a' },
    ],
    lab_fight_a: [
      { say: 'narration', text: '〔培養槽裂開。半透明的蝕化兵器\n原型，搖搖晃晃地站了起來。〕' },
      { event: 'battle', id: 'ch4_lab_a', outcomes: { win: 'lab_a_won', lose: 'lab_a_retry' } },
    ],
    lab_a_retry: [
      { say: 'lian_inner', text: '（沒有弱點表。那就看它\n出手前，哪裡先發光。）' },
      { goto: 'lab_fight_a' },
    ],
    lab_a_won: [
      { say: 'liora', text: '那個核心的排列……\n用的就是我的穩定式。' },
      { say: 'narration', text: '〔走廊盡頭，一具星燼魔像\n睜開了雙眼。〕' },
      { goto: 'lab_fight_b' },
    ],
    lab_fight_b: [{ event: 'battle', id: 'ch4_lab_b', outcomes: { win: 'lab_b_won', lose: 'lab_b_retry' } }],
    lab_b_retry: [
      { say: 'serin', text: '它很慢。別硬碰，\n繞到背後打關節。' },
      { goto: 'lab_fight_b' },
    ],
    lab_b_won: [
      { say: 'narration', text: '〔魔像碎成一地星屑。\n頭頂傳來微弱的風聲——通風井。〕' },
      {
        say: 'lian_inner',
        text: '（筆記不可靠了。\n但隊伍，比筆記可靠多了。）',
        effects: [{ flag: 'ch4_lab_done' }, { quest: 'ch4_core', stage: 3 }],
      },
      { goto: 'end' },
    ],
    lab_revisit: [
      { say: 'narration', text: '〔碎掉的培養槽，還在滴著光。〕' },
      { goto: 'end' },
    ],

    // ───────── 通風井的營火（瑟琳-3「劍的重量」） ─────────
    camp: [
      { goto: 'camp_revisit', if: { flag: 'ch4_campfire' } },
      { say: 'narration', text: '〔通風井底，一小塊乾燥的地方。\n莉歐拉用燈芯升起了小火。〕' },
      { say: 'narration', text: '〔緹雅裹著毯子，在火邊睡著了。〕', if: { flag: 'tia_rescued' } },
      { say: 'serin', text: '連恩。這把劍，你拿拿看。' },
      { say: 'lian', text: '……好重。你每天揮這個？' },
      { say: 'serin', text: '小時候覺得，重的是家名。\n後來覺得，是騎士團的命令。' },
      { say: 'serin', text: '剛才砍魔像的時候，我才發現。\n重的，是我想保護的東西。' },
      {
        choice: [
          { text: '「那就分一點給我扛。」', next: 'camp_share' },
          { text: '「重，是因為你選了它。」', next: 'camp_chosen' },
        ],
      },
    ],
    camp_share: [
      { say: 'serin', text: '……你的力氣，連門都撬不太開。' },
      { say: 'serin', text: '不過，嗯。分你一點也可以。', effects: [{ affinity: 'serin', delta: 5 }] },
      { goto: 'camp_serin_end' },
    ],
    camp_chosen: [
      { say: 'serin', text: '選了它……是嗎。\n第一次有人這樣說。' },
      { say: 'serin', text: '那我就繼續選它。\n直到最後。', effects: [{ affinity: 'serin', delta: 5 }] },
      { goto: 'camp_serin_end' },
    ],
    camp_serin_end: [
      { say: 'lian_inner', text: '（羈絆事件「劍的重量」。原作在第三章。\n……時間表也偏了。）', effects: [{ flag: 'bond_serin_3' }] },
      { goto: 'camp_rourke', if: { inParty: 'rourke' } },
      { goto: 'camp_done' },
    ],
    camp_rourke: [
      { say: 'rourke', text: '喂，小鬼。明天那個大司星，\n第一刀讓給老子。' },
      { say: 'rourke', text: '欠伊歐的，我得親手還。', effects: [{ flag: 'rourke_campfire' }] },
      { goto: 'camp_done' },
    ],
    camp_done: [
      {
        say: 'narration',
        text: '〔火光漸弱。井底傳來低沉的鳴動，\n像是某種巨大的心跳。〕',
        effects: [{ flag: 'ch4_campfire' }, { quest: 'ch4_core', stage: 4 }],
      },
      { goto: 'end' },
    ],
    camp_revisit: [
      { say: 'narration', text: '〔營火的餘燼，還有一點溫度。〕' },
      { goto: 'end' },
    ],

    // ───────── 4-4 星核爐 / Boss 瓦爾德蘭 / 4-5 結尾 ─────────
    furnace: [
      { goto: 'furnace_revisit', if: { flag: 'ch4_complete' } },
      { say: 'narration', text: '〔巨大的球形爐心，在黑暗中脈動。\n伊歐被光的絲線懸在中央。〕' },
      { say: 'io', text: '……連恩？你真的來了。' },
      { say: 'valderan', text: '歡迎，掌燈人。\n她是這座爐的「穩定器」。' },
      { say: 'valderan', text: '她本不該存在。世界的規則\n一直想抹去她，你知道嗎？' },
      { say: 'lian_inner', text: '（……Beta 版。原作測試版裡，\n有一位被刪掉的女主角。）' },
      { say: 'io', text: '我想起來了。我是「被刪掉的」。\n本來，早該消失了。' },
      { say: 'io', text: '可是每次你做出不一樣的選擇，\n我的輪廓就清楚一點。' },
      { say: 'io', text: '你改寫的每一件事，\n都讓我更能留在這裡。', if: { divergenceAtLeast: 60 } },
      { say: 'valderan', text: '所以，與其救她——不如接管星核。\n你來改寫規則，我來守護秩序。' },
      { say: 'valderan', text: '沒有人會再被刪除。\n這不是你一直想要的嗎？' },
      {
        choice: [
          { text: '「規則由你守著，就不叫改寫。」', next: 'furnace_refuse' },
          { text: '「……條件很誘人。可惜。」', next: 'furnace_tempted' },
        ],
      },
    ],
    furnace_refuse: [
      { say: 'valderan', text: '溫柔的孩子。那就用溫柔\n的方式，讓你明白吧。', effects: [{ flag: 'valderan_refused' }] },
      { goto: 'boss_fight' },
    ],
    furnace_tempted: [
      { say: 'valderan', text: '你猶豫了。很好。\n猶豫的人，才配得上星核。', effects: [{ flag: 'valderan_tempted' }] },
      { say: 'io', text: '連恩……？' },
      { say: 'lian', text: '放心。我只是想看清楚\n他的牌，再全部掀掉。' },
      { goto: 'boss_fight' },
    ],
    boss_fight: [
      { say: 'rourke', text: '說好的，第一刀是老子的！', if: { flag: 'rourke_campfire' } },
      { event: 'battle', id: 'boss_valderan', outcomes: { win: 'boss_won', lose: 'boss_retry' } },
    ],
    boss_retry: [
      { say: 'lian_inner', text: '（反燈印！三回合內\n一定要用引路之光清掉。）' },
      { goto: 'boss_fight' },
    ],
    boss_won: [
      { say: 'valderan', text: '……原來如此。被刪除的歌，\n也能唱到最後啊。' },
      { say: 'narration', text: '〔瓦爾德蘭跪倒。光的絲線\n一根根斷開。〕' },
      { say: 'lian', text: '伊歐！抓住我的手！' },
      { say: 'io', text: '……抓到了。這次，換我記住你。' },
      {
        say: 'narration',
        text: '〔伊歐回到了隊伍。〕',
        effects: [{ join: 'io' }, { flag: 'io_rescued' }, { affinity: 'io', delta: 10 }],
      },
      { say: 'narration', text: '〔失去穩定器的爐心開始龜裂。\n紅光從裂縫中湧出。〕' },
      { say: 'liora', text: '要炸了！不是藝術的那種！' },
      { say: 'lian_inner', text: '（兩條路。接手它，或讓它熄滅。\n筆記上，一個字都沒有。）' },
      {
        choice: [
          {
            text: '「接管星核。」',
            effects: [{ flag: 'took_core' }, { rep: 'order', delta: 10 }],
            next: 'core_taken',
          },
          { text: '「讓它熄滅。」', effects: [{ flag: 'core_sealed' }], next: 'core_dark' },
        ],
      },
    ],
    core_taken: [
      { say: 'narration', text: '〔你把手按在爐心上。\n灼熱的星光，順著手臂流進來。〕' },
      { say: 'valderan', text: '……你比我，更適合那個位置。' },
      { goto: 'rift' },
    ],
    core_dark: [
      { say: 'narration', text: '〔燈印一盞盞覆上爐心。\n光，慢慢地暗了下去。〕' },
      { say: 'io', text: '好安靜……像湖邊那天。' },
      { goto: 'rift' },
    ],
    rift: [
      { say: 'narration', text: '〔下一瞬，大地裂開。\n地底深處，有什麼睜開了眼。〕' },
      { say: 'ancient_voice', text: '……燼……歸來……' },
      { say: 'io', text: '是「蝕星者」。墜星的殘響，\n醒過來了。' },
      { say: 'narration', text: '〔研究院的地板崩落，\n一道通往裂谷的深淵張開。〕', effects: [{ flag: 'rift_open' }] },
      { say: 'lian', text: '……走吧。這次，大家一起。' },
      { event: 'summary', id: 'ch4' },
      { effects: [{ flag: 'ch4_complete' }, { quest: 'ch4_core', stage: 5, done: true }] },
      { say: 'lian_inner', text: '（終章「燈火」。\n最後一頁，我們自己寫。）' },
      { event: 'chapterCard', id: 'ch5' },
      { goto: 'end' },
    ],
    furnace_revisit: [
      { say: 'narration', text: '〔冷卻的爐心旁，裂谷的風\n不斷向上吹。〕' },
      { goto: 'end' },
    ],

    // ───────── 內應的補給（探索中隨時可以買賣） ─────────
    depths_shop: [
      { say: 'contact', text: '我從倉庫摸出來一些東西。\n要的話，照王都的價錢給我就好。' },
      { event: 'shop', id: 'capital' },
      { goto: 'end' },
    ],

    end: [],
  },
};
