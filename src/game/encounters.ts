// 路上的相遇（第 36 輪，D-159）：每張地圖有一到兩個「碰到才觸發」的小劇情——走到旁邊就跳抉擇面板。
// 「取」＝馬上拿好處；「助」＝現在什麼都沒拿，下次回到這張地圖時對方會來道謝（回禮比「取」多一點）。
// 和討伐後的抉擇（D-157）同一套面板與口吻；純畫面＋存檔層：不動戰鬥核心、不影響 stateHash。存 localStorage `jg_encounters`。
import type { ChoiceOption, ChoicePick } from './choices';

export type EncounterNpc = 'hunter' | 'mule' | 'miner' | 'herbalist' | 'thief' | 'pilgrim' | 'courier';

export interface Encounter {
  id: string;
  map: string;
  /** 格子座標（中心點＝格子 ×100＋50），要在可以走的地上（測試會檢查） */
  tx: number;
  ty: number;
  /** 畫哪一種人（RtBattleScene.drawEncounter） */
  npc: EncounterNpc;
  title: string;
  prompt: string;
  take: ChoiceOption & { coin?: number; crystal?: number };
  spare: ChoiceOption;
  /** 選「助」之後，下次回到這張地圖的回禮 */
  thanks: { lines: string; coin?: number; crystal?: number };
  /** ☰ 紀錄裡怎麼稱呼你的選擇 */
  short: Record<ChoicePick, string>;
  /**
   * 護送（第 37 輪，D-160）：選「助」之後對方跟在你身後（純畫面），走到 (tx, ty) 附近就當場道謝；
   * 半路離開地圖的話，照一般相遇下次回來在原地道謝。
   */
  escort?: { tx: number; ty: number; place: string };
}

/** 護送：跟著你的人走到目的地幾格內就算送到 */
export const ESCORT_RADIUS = 2.5;
/** 護送的人附近幾格內有在打的怪就停下來縮著（第 40 輪），打完再跟上 */
export const ESCORT_SCARED_TILES = 6;

export const ENCOUNTERS: readonly Encounter[] = [
  {
    id: 'mw_hunter',
    map: 'mistwood',
    tx: 18,
    ty: 86,
    npc: 'hunter',
    title: '樹下的少年獵人',
    prompt: '一個少年獵人坐在樹下，腳踝腫了起來。\n「我的獵犬跑進霧裡了……」\n他把錢袋遞給你：「這些都給你，幫我找牠。」',
    take: { label: '收下錢袋，指個方向就走', desc: '馬上得到 60 金', after: '少年看著你的背影，把空錢袋收了起來。', coin: 60 },
    spare: { label: '錢不用了，扶他回營火', desc: '下次回到霧語森林，他會帶著獵犬來找你', after: '你扶他走到營火邊。他說，等腳好了一定去找牠。' },
    thanks: { lines: '少年和一隻灰色的獵犬在路邊等你。\n「找到了！牠一直在霧裡等我。」\n他硬塞給你一個布袋，獵犬舔了舔你的手。', coin: 40, crystal: 3 },
    short: { take: '收下少年的錢袋', spare: '扶少年回營火' },
  },
  {
    id: 'tv_mule',
    map: 'thornvale',
    tx: 21,
    ty: 55,
    npc: 'mule',
    title: '被荊棘纏住的騾子',
    prompt: '一頭馱著貨的騾子，腿被荊棘纏住了，\n主人不知道去了哪裡。\n貨袋破了一角，露出金幣的光。',
    take: { label: '拿走袋裡的金幣', desc: '馬上得到 100 金', after: '騾子望著你，荊棘還纏在牠腿上。', coin: 100 },
    spare: { label: '割開荊棘，放牠走', desc: '下次回到荊棘谷，牠的主人會來道謝', after: '騾子甩了甩腿，慢慢往山谷外走去。' },
    thanks: { lines: '騾子的主人——一位商隊老闆——在路邊等你。\n「是你救了老灰吧？貨一件都沒少。」\n「這點心意，請一定收下。」', coin: 120, crystal: 2 },
    short: { take: '拿走騾子的金幣', spare: '放騾子走' },
  },
  {
    id: 'er_miner',
    map: 'emberrift',
    tx: 24,
    ty: 62,
    npc: 'miner',
    title: '困在熔岩對岸的礦工',
    prompt: '裂縫對岸，一個礦工被困在冷掉的岩石上。\n「把你腰上那顆燼晶丟過來！有它我就能搭橋！」\n那是你剛撿到、還在發熱的結晶。',
    take: { label: '燼晶留給自己', desc: '馬上得到 3 顆結晶', after: '你轉身離開。背後的喊聲，被熔岩的聲音蓋過了。', crystal: 3 },
    spare: { label: '把燼晶丟給他', desc: '下次回到燼紅裂谷，他會帶著礦坑的東西來找你', after: '燼晶在空中劃出一道光。對岸的岩石，慢慢連成了一座橋。' },
    thanks: { lines: '礦工扛著一袋礦石，在路邊等你。\n「欠你一條命——這是我挖過最好的一批。」\n袋子裡的結晶，還帶著裂谷的熱度。', crystal: 6 },
    short: { take: '把燼晶留給自己', spare: '把燼晶丟給礦工' },
  },
  // ── 第 37 輪：每張主線圖第二個相遇＋星隕高原一個（通關後） ──
  {
    id: 'mw_herbs',
    map: 'mistwood',
    tx: 19,
    ty: 69,
    npc: 'herbalist',
    title: '翻倒的藥籃',
    prompt: '採藥的婆婆跌了一跤，藥籃翻了一地，拐杖也斷了。\n草堆裡有一株發著銀光的花——銀霧蘭，\n一株就值不少錢。婆婆還沒看到它。',
    take: { label: '把銀霧蘭收進自己口袋', desc: '馬上得到 80 金', after: '婆婆一株一株撿著草藥，沒有發現少了什麼。', coin: 80 },
    spare: { label: '幫她撿好，陪她走回營火', desc: '她會跟在你身後；送到南邊的營火就會道謝', after: '婆婆捧著銀霧蘭笑了：「好孩子，這株能救一整個村子。」' },
    thanks: { lines: '婆婆從籃底拿出一個小陶罐。\n「銀霧蘭熬的，打架受了傷就喝一口。」\n罐底還壓著幾枚銅板和發亮的結晶。', coin: 50, crystal: 2 },
    short: { take: '收起銀霧蘭', spare: '陪婆婆走回營火' },
    escort: { tx: 24, ty: 87, place: '南邊的營火' },
  },
  {
    id: 'tv_thief',
    map: 'thornvale',
    tx: 42,
    ty: 46,
    npc: 'thief',
    title: '受傷的盜賊',
    prompt: '荊棘叢裡躺著一個蒙面人，大腿被棘刺劃開了。\n他懷裡緊抱著一個錢袋，上面繡著村子的徽記。\n「別過來……這是我的……」',
    take: { label: '搶走他偷來的錢袋', desc: '馬上得到 120 金', after: '蒙面人咒罵了一聲，拖著腿爬進了荊棘裡。', coin: 120 },
    spare: { label: '替他包紮，要他把東西還回去', desc: '下次回到荊棘谷，他會來找你', after: '他愣了很久，才低聲說：「……我會還的。」' },
    thanks: { lines: '那個蒙面人摘下了面巾，在路邊等你。\n「村裡的東西都還了，他們還留我吃了頓飯。」\n「這是我自己存的——別嫌少。」', coin: 90, crystal: 2 },
    short: { take: '搶走盜賊的錢袋', spare: '替盜賊包紮' },
  },
  {
    id: 'er_pilgrim',
    map: 'emberrift',
    tx: 23,
    ty: 37,
    npc: 'pilgrim',
    title: '口渴的朝聖者',
    prompt: '一個披著灰袍的朝聖者跪在路邊，水壺早就空了。\n他看著你腰上的水袋，取下胸前的護身燼石：\n「這是我唯一值錢的東西……換一口水，好嗎？」',
    take: { label: '收下燼石，再給他水', desc: '馬上得到 4 顆結晶', after: '朝聖者喝了水，摸著空空的胸口，繼續往裂谷深處走。', crystal: 4 },
    spare: { label: '把水給他，燼石不用了', desc: '下次回到燼紅裂谷，他會從聖地回來', after: '朝聖者把燼石握在手心，對你深深一鞠躬。' },
    thanks: { lines: '朝聖者從裂谷深處回來了，灰袍上沾滿了燼灰。\n「我在聖火前替你祈了福。」\n他手上的燼石，比之前更亮了。', coin: 60, crystal: 5 },
    short: { take: '收下朝聖者的燼石', spare: '把水給朝聖者' },
  },
  {
    id: 'sf_courier',
    map: 'starfall',
    tx: 28,
    ty: 80,
    npc: 'courier',
    title: '被墜星壓住的信差',
    prompt: '一塊冒著藍煙的墜星碎石，壓住了信差的腳。\n他的郵袋掉在一旁，裡面有一袋郵資，\n和一封寫著「給觀星者」的信。',
    take: { label: '拿走郵資', desc: '馬上得到 150 金', after: '你走遠了。身後的信差還在推那塊石頭。', coin: 150 },
    spare: { label: '搬開石頭，替他把信收好', desc: '下次回到星隕高原，他會來找你', after: '石頭滾開了。信差把信貼在胸口：「差一點就送不到了。」' },
    thanks: { lines: '信差在路邊等你，郵袋已經空了。\n「信送到了。觀星者讀完，哭了好久。」\n「他要我把這個交給你——說是星星的碎片。」', crystal: 6 },
    short: { take: '拿走信差的郵資', spare: '替信差搬開石頭' },
  },
];

/** 走到幾格內就觸發 */
export const ENCOUNTER_RADIUS = 2;

export const encountersOf = (map: string): Encounter[] => ENCOUNTERS.filter((e) => e.map === map);

/** 存檔：take／spare＝選了（spare 還沒拿回禮）；thanked＝選了助、也拿過回禮 */
export type EncounterState = ChoicePick | 'thanked';

const KEY = 'jg_encounters';

export function cleanEncounters(raw: unknown): Record<string, EncounterState> {
  const out: Record<string, EncounterState> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const e of ENCOUNTERS) {
    const v = (raw as Record<string, unknown>)[e.id];
    if (v === 'take' || v === 'spare' || v === 'thanked') out[e.id] = v;
  }
  return out;
}

export function loadEncounters(): Record<string, EncounterState> {
  try {
    return cleanEncounters(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function saveEncounters(c: Record<string, EncounterState>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* 無痕模式 */
  }
}

/** 做出選擇（只有一次）；未知 id 或已經選過回 null */
export function meet(cur: Record<string, EncounterState>, id: string, pick: ChoicePick): Record<string, EncounterState> | null {
  if (!ENCOUNTERS.some((e) => e.id === id) || cur[id]) return null;
  return { ...cur, [id]: pick };
}

/** 進地圖時：這張圖上選了「助」、還沒拿回禮的相遇（這次進來就會來道謝） */
export function pendingThanks(cur: Record<string, EncounterState>, map: string): Encounter[] {
  return encountersOf(map).filter((e) => cur[e.id] === 'spare');
}

/** 拿回禮：標成 thanked；回傳新狀態（不是待回禮的回 null） */
export function claimThanks(cur: Record<string, EncounterState>, id: string): Record<string, EncounterState> | null {
  if (cur[id] !== 'spare') return null;
  return { ...cur, [id]: 'thanked' };
}

/** 地圖上還要畫出來、走近會觸發的相遇（沒選過的） */
export function openEncounters(cur: Record<string, EncounterState>, map: string): Encounter[] {
  return encountersOf(map).filter((e) => !cur[e.id]);
}

/** 回禮的總價值（金幣＋結晶×40）要比「取」高：做好事要有回報（測試用） */
export const worth = (r: { coin?: number; crystal?: number }): number => (r.coin ?? 0) + (r.crystal ?? 0) * 40;

/** 燼牌對手對相遇的開場白（D-159；第 37 輪起每位對手可能提起兩個相遇）：對手 id → 他所在地圖的相遇 */
const RIVAL_ENC: Record<string, { id: string; take: string; spare: string }[]> = {
  merchant: [
    { id: 'mw_hunter', take: '「那個獵人小鬼一拐一拐地回來了……錢袋是空的。」', spare: '「獵人小鬼的狗找到了，天天在營火邊轉。」' },
    { id: 'mw_herbs', take: '「採藥的婆婆說她的銀霧蘭不見了，找了一整天。」', spare: '「婆婆的藥膏？我這裡也有賣——她說要送你的那罐不算。」' },
  ],
  vela: [
    { id: 'tv_mule', take: '「有頭騾子拖著荊棘回到村裡，貨袋破了……」', spare: '「商隊的老灰平安回來了，大家都在說你。」' },
    { id: 'tv_thief', take: '「村裡的錢袋找不回來了。聽說最後在一個旅人手上。」', spare: '「那個賊把東西還回來了……他說是你替他包的傷。」' },
  ],
  goran: [
    { id: 'er_miner', take: '「有個礦工在對岸困了兩天，才被同伴救出來……哼。」', spare: '「那個礦工是我徒弟。替我謝謝你，年輕人。」' },
    { id: 'er_pilgrim', take: '「朝聖的人說，他用燼石換了一口水。這裂谷真是越來越貴了。」', spare: '「朝聖者替你祈了福？那今晚手氣可別太好。」' },
  ],
  sol: [{ id: 'sf_courier', take: '「信差說他的郵資被人拿了……信倒是還在。坐吧。」', spare: '「那封信……是我女兒寫的。謝謝你搬開了那塊石頭。」' }],
};

/** 從對手所在地圖「已經選過」的相遇裡挑一句（rnd 預設 Math.random）；都沒選過回 null */
export function rivalEncounterEcho(rival: string, cur: Record<string, EncounterState>, rnd: () => number = Math.random): string | null {
  const lines = (RIVAL_ENC[rival] ?? []).flatMap((r) => {
    const v = cur[r.id];
    return v ? [v === 'take' ? r.take : r.spare] : [];
  });
  if (!lines.length) return null;
  return lines[Math.min(lines.length - 1, Math.floor(rnd() * lines.length))]!;
}
