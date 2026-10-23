// 終章「燈火」。來源：docs/design/10-story-ch2-final.md §終章、§羈絆事件總表。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
//
// 與前幾章相同，由節點地圖（MapScene）驅動：點擊地點 → 從 CH5_ENTRIES 的入口節點開始，
// 跑到節點結尾（'end'）後交回地圖。進度以 ch5_* 旗標推進。
// 章節卡「終章 燈火」已在第 4 章結尾播放，本章開頭不再重複；結尾播放 fin（終幕）章節卡。
//
// 本章新增旗標：
//   ch5_descent / ch5_vow / ch5_complete / game_clear（進度）
//   rourke_sacrifice（⟦rourke_lost⟧ 時洛克在裂谷入口斷後）
//   vow_serin / vow_liora / vow_io（5-2 心之約定）、vow_all（和大家一起看星星）
//   rourke_card（洛克倒戈：「老子的牌給你」）
//   ending = 'light' | 'crown' | 'dream'（結局判定，先符合者優先）
import type { DialogueScript } from '../../core/dialogue/runner';
import type { Condition } from '../../core/state/gameState';

/** 地圖入口（依劇情順序）。node = 點擊地點時要啟動的節點。 */
export const CH5_ENTRIES: { node: string; location: string; title: string; requires?: Condition }[] = [
  { node: 'descent', location: 'rift_edge', title: '墜星裂谷', requires: { flag: 'ch4_complete' } },
  { node: 'vow', location: 'last_campfire', title: '最後的營火', requires: { flag: 'ch5_descent' } },
  { node: 'core', location: 'rift_core', title: '墜星之心', requires: { flag: 'ch5_vow' } },
];

/** 燈火長明：瑟琳、莉歐拉、洛克中至少 2 人在隊。 */
const TWO_OF_THREE: Condition = {
  any: [
    { all: [{ inParty: 'serin' }, { inParty: 'liora' }] },
    { all: [{ inParty: 'serin' }, { inParty: 'rourke' }] },
    { all: [{ inParty: 'liora' }, { inParty: 'rourke' }] },
  ],
};

const ENDING_LIGHT: Condition = {
  all: [{ divergenceAtLeast: 60 }, { affinityAtLeast: ['io', 60] }, TWO_OF_THREE],
};

const ENDING_CROWN: Condition = {
  all: [{ flag: 'research_kept' }, { repAtLeast: ['order', 30] }, { flag: 'took_core' }],
};

export const CH5: DialogueScript = {
  id: 'ch5',
  start: 'descent',
  nodes: {
    // ───────── 5-1 裂谷降下 ─────────
    descent: [
      { goto: 'descent_revisit', if: { flag: 'ch5_descent' } },
      { say: 'narration', text: '〔墜星裂谷。風從深淵往上吹，\n帶著灰燼與微光。〕' },
      { say: 'lian_inner', text: '（筆記的最後一頁是空白的。\n好，至少不會再劇透了。）' },
      { say: 'serin', text: '腳下踩穩。這裡掉下去，\n可沒有騎士團來撈人。', if: { inParty: 'serin' } },
      { say: 'serin', text: '……臉上的疤在發燙。\n大概是在提醒我，別再退。', if: { flag: 'serin_scar' } },
      { say: 'liora', text: '我帶了十二種照明彈！\n其中十一種不會爆炸！', if: { inParty: 'liora' } },
      { say: 'liora', text: '……那份研究，我還帶著。\n今天，它要用來救人。', if: { flag: 'research_kept' } },
      { say: 'io', text: '這裡的聲音，我聽過。\n在被刪除之前，在很久以前。', if: { inParty: 'io' } },
      { say: 'rourke', text: '緹雅在上面等著。老子\n答應過她，要活著回去。', if: { flag: 'rourke_turned' } },
      { say: 'lian', text: '……謝謝大家，願意走到這裡。' },
      { goto: 'descent_pursuit', if: { flag: 'rourke_lost' } },
      { goto: 'descent_fight' },
    ],
    descent_pursuit: [
      { say: 'narration', text: '〔身後傳來整齊的腳步聲。\n研究院的追兵到了。〕' },
      { say: 'guard', text: '叛徒在下面！封鎖裂谷入口！' },
      { say: 'narration', text: '〔一道熟悉的身影，\n擋在了窄道的正中央。〕' },
      { say: 'rourke', text: '……喲。來得真慢啊，小子。' },
      { say: 'lian', text: '洛克？你怎麼——' },
      { say: 'rourke', text: '上次那一局，是老子輸了。\n輸家，總得付點什麼。' },
      { say: 'rourke', text: '這條路只容一個人。\n剛好，老子就一個人。' },
      { say: 'lian_inner', text: '（不對。這一幕筆記裡沒有。\n是他自己選的。）' },
      { say: 'rourke', text: '替我跟緹雅說——\n她爸，這次沒有作弊。', if: { flag: 'tia_rescued' } },
      { say: 'rourke', text: '走吧。別回頭。\n回頭的話，牌就不靈了。' },
      {
        say: 'narration',
        text: '〔你們往深處跑去。身後，\n洛克的笑聲和燈光，久久不散。〕',
        effects: [{ flag: 'rourke_sacrifice' }],
      },
      { goto: 'descent_fight' },
    ],
    descent_fight: [
      { say: 'narration', text: '〔裂谷的岩壁裡，\n蝕化的影子一個個爬了出來。〕' },
      { goto: 'rift_fight' },
    ],
    rift_fight: [{ event: 'battle', id: 'ch5_rift', outcomes: { win: 'rift_won', lose: 'rift_retry' } }],
    rift_retry: [
      { say: 'lian_inner', text: '（牠們怕光。先把燈印\n鋪在退路上，再一口氣推進。）' },
      { goto: 'rift_fight' },
    ],
    rift_won: [
      { say: 'narration', text: '〔影子散去。谷底有一處\n安靜的平台，可以稍作休息。〕' },
      { effects: [{ flag: 'ch5_descent' }, { quest: 'ch5_light', stage: 1 }] },
      { goto: 'end' },
    ],
    descent_revisit: [
      { say: 'narration', text: '〔裂谷的風依舊往上吹，\n像在替誰送行。〕' },
      { goto: 'end' },
    ],

    // ───────── 5-2 心之約定 ─────────
    vow: [
      { goto: 'vow_revisit', if: { flag: 'ch5_vow' } },
      { say: 'narration', text: '〔最後的營火。頭頂的裂縫外，\n是一整片星空。〕' },
      { say: 'lian_inner', text: '（明天就是最後一戰。\n今晚，至少讓我選一次座位。）' },
      { goto: 'vow_rourke', if: { flag: 'rourke_turned' } },
      { goto: 'vow_choice' },
    ],
    vow_rourke: [
      { say: 'rourke', text: '小子，過來。這給你。' },
      { say: 'narration', text: '〔一張磨得發亮的燼牌。\n是洛克的「老兵」。〕' },
      { say: 'rourke', text: '老子的牌給你。\n別弄丟了，那可是幸運牌。' },
      { say: 'lian', text: '那你呢？' },
      {
        say: 'rourke',
        text: '老子有緹雅就夠了。\n……去吧，有人在等你。',
        effects: [{ card: 'c_veteran' }, { flag: 'rourke_card' }, { affinity: 'rourke', delta: 5 }],
      },
      { goto: 'vow_choice' },
    ],
    vow_choice: [
      {
        choice: [
          { text: '（坐到瑟琳身邊。）', if: { affinityAtLeast: ['serin', 50] }, next: 'vow_serin' },
          { text: '（坐到莉歐拉身邊。）', if: { affinityAtLeast: ['liora', 50] }, next: 'vow_liora' },
          { text: '（坐到伊歐身邊。）', if: { affinityAtLeast: ['io', 50] }, next: 'vow_io' },
          { text: '「和大家一起看星星。」', next: 'vow_all' },
        ],
      },
    ],
    vow_serin: [
      { say: 'serin', text: '……你坐這裡，我會分心。' },
      { say: 'serin', text: '以前，我的人生都是別人選的。\n家名、劍、婚約。' },
      { say: 'serin', text: '但跟著你走到這裡，\n是我自己選的。' },
      { say: 'narration', text: '〔她握住了你的手。\n劍繭有點粗，卻很溫暖。〕' },
      { say: 'serin', text: '答應我。結束之後，\n陪我回家，看一次日出。' },
      { say: 'lian', text: '……嗯。我答應你。' },
      { say: 'narration', text: '〔你與瑟琳立下了約定。〕', effects: [{ flag: 'vow_serin' }, { affinity: 'serin', delta: 10 }] },
      { goto: 'vow_done' },
    ],
    vow_liora: [
      { say: 'liora', text: '來得正好！這個給你！\n……不會爆炸，我保證。' },
      { say: 'narration', text: '〔一盞小小的燈。燈罩上，\n刻著兩顆並排的星星。〕' },
      { say: 'liora', text: '以前我只想讓大家笑。\n這一個……是只為你做的。' },
      { say: 'narration', text: '〔她的手悄悄碰了碰你的手，\n然後緊緊握住。〕' },
      { say: 'liora', text: '回去以後，當我的第一個客人。\n不准拒絕喔。' },
      { say: 'lian', text: '一言為定。' },
      { say: 'narration', text: '〔你與莉歐拉立下了約定。〕', effects: [{ flag: 'vow_liora' }, { affinity: 'liora', delta: 10 }] },
      { goto: 'vow_done' },
    ],
    vow_io: [
      { say: 'io', text: '連恩。你看，那顆星。\n它以前沒有名字。' },
      { say: 'io', text: '我以前也沒有。\n是你一直叫我，我才留了下來。' },
      { say: 'io', text: '我想被記住。\n不是被世界，是被你。' },
      { say: 'narration', text: '〔你握住伊歐的手。\n她輕輕哼起湖邊那首歌。〕' },
      { say: 'lian', text: '我會記住。每一天，\n都多記一點。' },
      { say: 'io', text: '……那就說好了。\n明天之後，還有明天。' },
      { say: 'narration', text: '〔你與伊歐立下了約定。〕', effects: [{ flag: 'vow_io' }, { affinity: 'io', delta: 10 }] },
      { goto: 'vow_done' },
    ],
    vow_all: [
      { say: 'narration', text: '〔大家圍著營火，\n一起仰望星空。〕' },
      { say: 'liora', text: '那顆像不像爆炸？\n——好啦，像花。', if: { inParty: 'liora' } },
      { say: 'serin', text: '……這樣也不錯。', if: { inParty: 'serin' } },
      { say: 'io', text: '我會記住今晚。\n大家的聲音，全部。', if: { inParty: 'io' } },
      { say: 'lian_inner', text: '（原作裡，這一幕只有我一個人。\n現在，擠得剛剛好。）', effects: [{ flag: 'vow_all' }] },
      { goto: 'vow_done' },
    ],
    vow_done: [
      { say: 'narration', text: '〔營火漸漸轉弱。\n星光，替你們守了一整夜。〕' },
      { effects: [{ flag: 'ch5_vow' }, { quest: 'ch5_light', stage: 2 }] },
      { goto: 'end' },
    ],
    vow_revisit: [
      { say: 'narration', text: '〔營火的餘燼還溫溫的。〕' },
      { goto: 'end' },
    ],

    // ───────── 5-3 墜星之心 ─────────
    core: [
      { goto: 'core_revisit', if: { flag: 'ch5_complete' } },
      { say: 'narration', text: '〔裂谷最深處。一顆巨大的\n黑色星辰，緩緩跳動。〕' },
      { say: 'ancient_voice', text: '燼……之……子……\n你們……本該……被遺忘……' },
      { say: 'io', text: '它是墜星的殘響。\n它想把一切，都變回灰燼。' },
      { say: 'lian', text: '抱歉。這個世界，\n我們還想再多住一陣子。' },
      { goto: 'boss_fight' },
    ],
    boss_fight: [
      { event: 'battle', id: 'boss_starfall', outcomes: { win: 'boss_won', lose: 'boss_retry' } },
    ],
    boss_retry: [
      { say: 'lian_inner', text: '（「刪除之眼」先打！\n伊歐撐不了太久。）' },
      { goto: 'boss_fight' },
    ],
    boss_won: [
      { say: 'ancient_voice', text: '……那麼……最後……\n連你們的名字……一起……' },
      { say: 'narration', text: '〔蝕星者聚起最後的光。\n足以吞沒整座裂谷。〕' },
      { say: 'serin', text: '連恩，接著！', if: { inParty: 'serin' } },
      { say: 'liora', text: '我的燈也給你！', if: { inParty: 'liora' } },
      { say: 'rourke', text: '全押了，小子！', if: { inParty: 'rourke' } },
      { say: 'narration', text: '〔一盞、兩盞、十盞——\n所有的燈，都交到你的手上。〕' },
      { say: 'narration', text: '〔全員共鳴。\n燈印化作一整片星河。〕' },
      { say: 'io', text: '還差一點……讓我來。\n——「回溯」。' },
      { say: 'narration', text: '〔時間倒轉。那最後一擊，\n退回了它來的地方。〕' },
      { say: 'ancient_voice', text: '……原來……被記住的……\n不會……熄滅……' },
      { say: 'narration', text: '〔黑色的星辰碎成光點，\n像雪一樣落下。〕' },
      { goto: 'ending_light', if: ENDING_LIGHT },
      { goto: 'ending_crown', if: ENDING_CROWN },
      { goto: 'ending_dream' },
    ],

    // ───────── 結局 ─────────
    ending_light: [
      { effects: [{ flag: 'ending', value: 'light' }] },
      { say: 'narration', text: '〔結局：燈火長明〕' },
      { say: 'narration', text: '〔光點落在大地上，\n每一處都亮起一盞小燈。〕' },
      { say: 'io', text: '連恩，我還在。\n明天，後天，也還在。' },
      { say: 'lian_inner', text: '（原作的結局叫「餘燼」。\n這一次，燈沒有熄。）' },
      { say: 'lian', text: '回家吧。大家一起。' },
      { goto: 'epilogue' },
    ],
    ending_crown: [
      { effects: [{ flag: 'ending', value: 'crown' }] },
      { say: 'narration', text: '〔結局：新的大司星〕' },
      { say: 'narration', text: '〔星核的力量在你掌中安定下來。\n王都派來了迎接的車隊。〕' },
      { say: 'liora', text: '那份研究，就交給你了。\n這次，要用在對的地方。', if: { inParty: 'liora' } },
      { say: 'lian_inner', text: '（新的大司星。肩膀好重。\n但至少，知道要為誰扛。）' },
      { say: 'lian', text: '星星的光，要分給所有人。' },
      { goto: 'epilogue' },
    ],
    ending_dream: [
      { effects: [{ flag: 'ending', value: 'dream' }] },
      { say: 'narration', text: '〔結局：餘燼之夢〕' },
      { say: 'narration', text: '〔光點落盡，裂谷歸於寂靜。\n世界得救了，卻少了些什麼。〕' },
      { say: 'io', text: '……連恩，我好像，\n開始記不太清楚了。', if: { inParty: 'io' } },
      { say: 'lian', text: '沒關係。我替你記著。' },
      { say: 'lian_inner', text: '（餘燼也是燈火的一部分。\n只要還有人記得。）' },
      { goto: 'epilogue' },
    ],

    // ───────── 後日談 ─────────
    epilogue: [
      { say: 'narration', text: '〔——後日談——〕' },
      { say: 'narration', text: '〔瑟琳回到艾凡斯家。\n約定的日出，兩人一起看了。〕', if: { flag: 'vow_serin' } },
      {
        say: 'narration',
        text: '〔瑟琳成了騎士團的教官。\n她總說：劍要為自己選的人揮。〕',
        if: { all: [{ inParty: 'serin' }, { flag: 'vow_serin', not: true }] },
      },
      { say: 'narration', text: '〔莉歐拉的燈具店開張了。\n第一位客人，坐在最前排。〕', if: { flag: 'vow_liora' } },
      {
        say: 'narration',
        text: '〔莉歐拉的新發明是礦燈。\n這次只爆炸了一次，算成功。〕',
        if: { all: [{ inParty: 'liora' }, { flag: 'vow_liora', not: true }] },
      },
      { say: 'narration', text: '〔伊歐在湖邊教孩子唱歌。\n她的名字，刻在了燈塔上。〕', if: { flag: 'vow_io' } },
      {
        say: 'narration',
        text: '〔伊歐四處旅行，收集歌謠。\n每封信都寫：別忘了我喔。〕',
        if: { all: [{ inParty: 'io' }, { flag: 'vow_io', not: true }] },
      },
      { say: 'narration', text: '〔洛克開了間小酒館。緹雅\n負責發牌，從不讓他作弊。〕', if: { flag: 'rourke_turned' } },
      {
        say: 'narration',
        text: '〔酒館角落，擺著一張舊燼牌\n和一杯沒人喝的酒。〕',
        if: { flag: 'rourke_sacrifice' },
      },
      { say: 'narration', text: '〔緹雅常來坐。她說，\n爸爸最後一局，一定贏了。〕', if: { all: [{ flag: 'rourke_sacrifice' }, { flag: 'tia_rescued' }] } },
      { say: 'narration', text: '〔灰燈鎮孤兒院的窗邊，\n每晚都亮著一盞小燈。〕' },
      { say: 'narration', text: '〔商隊重新走上了大路。\n車頂掛著星星形狀的燈籠。〕' },
      { say: 'narration', text: '〔礦工們在坑道裡唱歌。\n燼礦的燈，再也不會變紅了。〕' },
      { say: 'narration', text: '〔伯恩依舊站在鎮口。\n「回來啦。」他只說了這句。〕' },
      { event: 'summary', id: 'ch5' },
      {
        effects: [{ flag: 'ch5_complete' }, { flag: 'game_clear' }, { quest: 'ch5_light', stage: 3, done: true }],
      },
      { say: 'lian_inner', text: '（攻略筆記，到此為止。\n接下來的日子，不需要劇透。）' },
      { event: 'chapterCard', id: 'fin' },
      { goto: 'end' },
    ],
    core_revisit: [
      { say: 'narration', text: '〔墜星之心只剩一片星塵。\n風很輕，像有人在道別。〕' },
      { goto: 'end' },
    ],

    end: [],
  },
};
