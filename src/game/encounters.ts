// 路上的相遇（第 36 輪，D-159）：三張主線地圖各有一個「碰到才觸發」的小劇情——走到旁邊就跳抉擇面板。
// 「取」＝馬上拿好處；「助」＝現在什麼都沒拿，下次回到這張地圖時對方會來道謝（回禮比「取」多一點）。
// 和討伐後的抉擇（D-157）同一套面板與口吻；純畫面＋存檔層：不動戰鬥核心、不影響 stateHash。存 localStorage `jg_encounters`。
import type { ChoiceOption, ChoicePick } from './choices';

export interface Encounter {
  id: string;
  map: string;
  /** 格子座標（中心點＝格子 ×100＋50），要在可以走的地上（測試會檢查） */
  tx: number;
  ty: number;
  /** 畫哪一種人（RtBattleScene.drawEncounter） */
  npc: 'hunter' | 'mule' | 'miner';
  title: string;
  prompt: string;
  take: ChoiceOption & { coin?: number; crystal?: number };
  spare: ChoiceOption;
  /** 選「助」之後，下次回到這張地圖的回禮 */
  thanks: { lines: string; coin?: number; crystal?: number };
  /** ☰ 紀錄裡怎麼稱呼你的選擇 */
  short: Record<ChoicePick, string>;
}

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
