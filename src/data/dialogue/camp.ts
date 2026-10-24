// 營火（E5 自由羈絆，11-open-world §2.6；D-045）：在營火可以隨時找同伴聊天、送禮。
// 聊天話題依好感解鎖（0 / 20 / 40），每個話題第一次聊 +4 好感；聊完了就說一句近況。
// 送禮：每人喜好不同（最愛 +8、喜歡 +4、普通 +1），禮物在商店買。
import type { DialogueScript, ScriptLine } from '../../core/dialogue/runner';
import type { CompanionId } from '../../core/state/gameState';

export const GIFTS = ['gift_flower', 'gift_book', 'gift_gear', 'gift_ribbon', 'gift_wine'] as const;
export type GiftId = (typeof GIFTS)[number];

const COMPANIONS: CompanionId[] = ['io', 'rourke', 'serin', 'liora'];

/** 送禮喜好：2 = 最愛、1 = 喜歡、0 = 普通 */
export const GIFT_TASTE: Record<CompanionId, Record<GiftId, 0 | 1 | 2>> = {
  io: { gift_flower: 2, gift_ribbon: 2, gift_book: 1, gift_gear: 0, gift_wine: 0 },
  rourke: { gift_wine: 2, gift_gear: 1, gift_book: 0, gift_flower: 0, gift_ribbon: 0 },
  serin: { gift_book: 2, gift_ribbon: 1, gift_flower: 1, gift_gear: 0, gift_wine: 0 },
  liora: { gift_gear: 2, gift_book: 1, gift_flower: 1, gift_ribbon: 0, gift_wine: 0 },
};
const TASTE_GAIN = [1, 4, 8] as const;

const NAME: Record<CompanionId, string> = { io: '伊歐', rourke: '洛克', serin: '瑟琳', liora: '莉歐拉' };

type Topic = [title: string, lines: [speaker: string, text: string][]];

/** 每人三個話題（好感 0／20／40 解鎖） */
const TOPICS: Record<CompanionId, Topic[]> = {
  io: [
    ['湖裡的歌', [
      ['lian', '妳在湖邊唱的那首歌，叫什麼名字？'],
      ['io', '……沒有名字。醒來的時候，它就在我嘴裡了。'],
      ['io', '可是唱的時候，霧會變得很安靜。\n像有人在聽。'],
    ]],
    ['星星的形狀', [
      ['io', '連恩，你看。那三顆星，像不像提燈？'],
      ['lian', '……還真的像。妳怎麼看出來的？'],
      ['io', '因為你一直提著它。\n所以我抬頭看星星的時候，也會先找提燈。'],
    ]],
    ['想記住的事', [
      ['io', '我不記得以前的事。有時候會害怕。'],
      ['io', '可是最近……我在想，\n如果以後只能記得一件事。'],
      ['io', '……我想記得這堆營火。\n還有你在旁邊剪燈芯的聲音。'],
      ['lian_inner', '（她說得很輕。我假裝專心剪燈芯，\n其實一個字都沒漏聽。）'],
    ]],
  ],
  rourke: [
    ['牌桌規矩', [
      ['rourke', '小子，知道牌桌上最重要的是什麼嗎？'],
      ['lian', '……運氣？'],
      ['rourke', '是知道什麼時候該離桌。\n很多人輸光，不是因為牌爛，是因為捨不得走。'],
    ]],
    ['老傷', [
      ['lian', '你的左肩，每次下雨都會揉一下。'],
      ['rourke', '……觀察力不錯。三十年前的事了。\n替一個不值得的人擋了一刀。'],
      ['rourke', '不後悔。只是偶爾會想，\n那傢伙現在過得好不好。'],
    ]],
    ['為什麼跟來', [
      ['rourke', '你一定在想，我這種老賭鬼為什麼跟著你們。'],
      ['rourke', '……我看過太多年輕人往死路上衝。\n你也是。但你衝的時候，會回頭看同伴。'],
      ['rourke', '這種人，值得押一把。'],
    ]],
  ],
  serin: [
    ['劍的保養', [
      ['serin', '……你一直盯著我磨劍。'],
      ['lian', '只是覺得妳磨得很仔細。'],
      ['serin', '劍是騎士的承諾。鈍了，承諾就守不住。\n——這是教官說的。我一直記著。'],
    ]],
    ['騎士團的日子', [
      ['serin', '在騎士團，大家都叫我「冰之瑟琳」。'],
      ['serin', '其實我只是……不知道該怎麼跟人說話。\n命令很簡單，聊天很難。'],
      ['lian', '妳現在不就在跟我聊天嗎？'],
      ['serin', '……（別過頭）這不一樣。'],
    ]],
    ['如果不是騎士', [
      ['serin', '連恩。如果我不是騎士……你覺得我能做什麼？'],
      ['lian', '開一間劍術道場？教小孩子揮木劍。'],
      ['serin', '……'],
      ['serin', '（很小聲）聽起來，好像不錯。\n到時候你要來當第一個學生。'],
    ]],
  ],
  liora: [
    ['爆炸的美學', [
      ['liora', '你知道爆炸最美的是哪一瞬間嗎？'],
      ['lian', '……火光最大的時候？'],
      ['liora', '是引信燒到最後一寸、還沒炸開的那一刻！\n所有可能性都在那裡！'],
    ]],
    ['研究院', [
      ['liora', '研究院說我的發明「太危險」，把我趕出來了。'],
      ['liora', '可是危險的東西，用對地方就是救命的東西。\n——你在礦坑裡不是看到了嗎？'],
      ['lian', '嗯。妳救了很多人。'],
      ['liora', '……（搔頭）被這樣直接說，有點不好意思耶。'],
    ]],
    ['設計圖', [
      ['liora', '給你看個東西！這是我在畫的設計圖。'],
      ['liora', '會自己發光、永遠不會熄的提燈。\n燈芯用星燼做，一輩子都不用剪。'],
      ['lian', '……那掌燈人不就失業了？'],
      ['liora', '笨蛋，是送你的啦！\n這樣你就不用每天晚上都那麼累了。'],
    ]],
  ],
};

const IDLE: Record<CompanionId, string> = {
  io: '（伊歐靠著你的肩膀，小聲哼著歌。）',
  rourke: '「今晚的火燒得不錯。睡吧，我守夜。」',
  serin: '「明天還要趕路。……你也早點休息。」',
  liora: '「我在想新的炸藥配方！……開玩笑的，大概。」',
};

const THRESHOLD = [0, 20, 40] as const;

function chatNodes(c: CompanionId): Record<string, ScriptLine[]> {
  const out: Record<string, ScriptLine[]> = {};
  const head: ScriptLine[] = [];
  // 依序：還沒聊過、且好感達門檻的第一個話題
  TOPICS[c].forEach((_, i) => {
    head.push({
      goto: `chat_${c}_${i + 1}`,
      if: { all: [{ flag: `talk_${c}_${i + 1}`, not: true }, { affinityAtLeast: [c, THRESHOLD[i]!] }] },
    });
  });
  head.push({ say: c, text: IDLE[c] }, { goto: 'chat_more' });
  out[`chat_${c}`] = head;
  TOPICS[c].forEach(([title, lines], i) => {
    out[`chat_${c}_${i + 1}`] = [
      { say: 'narration', text: `〔話題：${title}〕` },
      ...lines.map(([say, text]): ScriptLine => ({ say, text })),
      { effects: [{ flag: `talk_${c}_${i + 1}` }, { affinity: c, delta: 4 }] },
      { say: 'narration', text: `〔${NAME[c]}的好感上升了。〕` },
      { goto: 'chat_more' },
    ];
  });
  return out;
}

const GIFT_NAME: Record<GiftId, string> = {
  gift_flower: '野花束', gift_book: '舊書', gift_gear: '精巧齒輪', gift_ribbon: '緞帶', gift_wine: '陳年葡萄汁',
};

const REACT: Record<CompanionId, [string, string, string]> = {
  io: ['「……謝謝。」（她小心地收進口袋）', '「好漂亮……我可以一直留著嗎？」', '「！」（伊歐抱著它，眼睛亮得像星星）\n「我會好好珍惜的。」'],
  rourke: ['「哦？給我的？……謝了。」', '「不錯嘛，小子。有眼光。」', '「哈哈！你小子懂我！\n今晚這杯，敬你。」'],
  serin: ['「……收下了。謝謝。」', '「（嘴角微微上揚）……我會用的。」', '「這、這個……你怎麼知道我想要？\n……謝謝。真的。」'],
  liora: ['「嗯？好喔，謝啦！」', '「欸，這個不錯耶！」', '「哇啊啊！這個齒距！這個咬合！\n連恩你是天才！」'],
};

function giftNodes(): Record<string, ScriptLine[]> {
  const out: Record<string, ScriptLine[]> = {};
  out['gift_menu'] = [
    {
      choice: [
        ...GIFTS.map((g) => ({ text: `${GIFT_NAME[g]}`, next: `gift_${g}`, if: { hasItem: g } })),
        { text: '（算了）', next: 'menu' },
      ],
    },
  ];
  for (const g of GIFTS) {
    out[`gift_${g}`] = [
      { say: 'narration', text: `〔要把「${GIFT_NAME[g]}」送給誰？〕` },
      {
        choice: [
          ...COMPANIONS.map((c) => ({ text: NAME[c], next: `gift_${g}_${c}`, if: { inParty: c } })),
          { text: '（再想想）', next: 'gift_menu' },
        ],
      },
    ];
    for (const c of COMPANIONS) {
      const t = GIFT_TASTE[c][g];
      out[`gift_${g}_${c}`] = [
        { say: c, text: REACT[c][t], effects: [{ item: g, count: -1 }, { affinity: c, delta: TASTE_GAIN[t] }] },
        { say: 'narration', text: t === 2 ? `〔${NAME[c]}非常開心！好感大幅上升。〕` : t === 1 ? `〔${NAME[c]}很高興。好感上升了。〕` : `〔${NAME[c]}收下了。〕` },
        { goto: 'menu' },
      ];
    }
  }
  return out;
}

export const CAMP: DialogueScript = {
  id: 'camp',
  start: 'menu',
  nodes: {
    menu: [
      { say: 'narration', text: '〔營火劈啪作響。同伴們圍著火堆坐下。〕' },
      {
        choice: [
          { text: '找人聊聊', next: 'chat_menu', if: { any: COMPANIONS.map((c) => ({ inParty: c })) } },
          { text: '送禮物', next: 'gift_menu', if: { any: GIFTS.map((g) => ({ hasItem: g })) } },
          { text: '起身出發', next: 'end' },
        ],
      },
    ],
    chat_menu: [
      {
        choice: [
          ...COMPANIONS.map((c) => ({ text: NAME[c], next: `chat_${c}`, if: { inParty: c } })),
          { text: '（回到營火邊）', next: 'menu' },
        ],
      },
    ],
    chat_more: [{ goto: 'chat_menu' }],
    ...Object.assign({}, ...COMPANIONS.map(chatNodes)),
    ...giftNodes(),
    end: [],
  },
};
