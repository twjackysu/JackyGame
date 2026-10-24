// 探索中同伴偶爾冒出的一句話（E5：同伴在地圖上有存在感）。依區域挑，沒有就用通用台詞。
import type { MemberId } from '../core/state/gameState';

type Lines = Partial<Record<MemberId, string[]>>;

export const BANTER_GENERIC: Lines = {
  io: ['……（哼著歌）', '連恩，走慢一點，我想多看一下。', '那邊好像有亮亮的東西？'],
  rourke: ['腳步放輕。……老習慣了。', '回去喝一杯吧，我請——算了，你請。', '哈，這種路我閉著眼都能走。'],
  serin: ['保持隊形。', '……你的燈，比上次亮了。', '我走前面。'],
  liora: ['這石頭的成分……可以炸嗎？', '等等！我撿個零件！', '走路好無聊，來點爆炸吧？開玩笑的。'],
};

export const BANTER_AREA: Record<string, Lines> = {
  greylamp: {
    io: ['這個鎮子的燈，好溫暖。', '孤兒院的孩子們一直在看你耶。'],
    rourke: ['酒館的牌桌在呼喚我。'],
    serin: ['……這就是你長大的地方啊。'],
  },
  mistwood: {
    io: ['霧在唱歌……你聽得到嗎？'],
    rourke: ['狼的腳印，新的。小心。'],
  },
  wolfpath: {
    io: ['古燈塔……好像在等誰。'],
    rourke: ['這條路，以前是商隊走的。'],
  },
  mine: {
    serin: ['這裡的空氣……不對勁。', '跟緊我。'],
    liora: ['這些礦晶！會發光！我要帶一塊回去！', '坑道結構不錯嘛，誰設計的？'],
    io: ['好暗……可是有你的燈就不怕。'],
  },
  minecamp: {
    serin: ['礦工們在看我。……騎士團的名聲不太好。'],
    liora: ['補給站有賣齒輪耶！'],
  },
  capital: {
    serin: ['王都……我回來了。', '研究院的燈，從來沒熄過。'],
    liora: ['夜市的炸物攤！等一下一定要去！'],
    io: ['好多人……好多燈。', '星冠城的星星，比鎮上少。'],
    rourke: ['這城裡的牌手，我大概都贏過。'],
  },
};

/** 好感 ≥ 50 才會說的話（羈絆變深，語氣也跟著變） */
export const BANTER_CLOSE: Lines = {
  io: ['連恩的影子，跟我的影子疊在一起了。', '……可以牽一下袖子嗎？霧太濃了。', '我今天又記住了一件事：你走路會配合我的步伐。'],
  rourke: ['小子，你背後我顧著。安心走。', '……你這燈，看久了還挺順眼。', '哪天你要是累了，換我提燈也行。'],
  serin: ['走在你旁邊，比走在前面安心。……別誤會。', '你的背，我會守住。這是誓言。', '下次停下來的時候，陪我練一下劍。'],
  liora: ['欸，下一個發明我想取你的名字。可以嗎？', '跟你出門，好像就不用一直想著要爆炸了。', '你身上有煤灰的味道。……我的錯。'],
};
export const CLOSE_AFFINITY = 50;

export function banterFor(area: string, m: MemberId, affinity = 0): string[] {
  return [...(BANTER_AREA[area]?.[m] ?? []), ...(BANTER_GENERIC[m] ?? []), ...(affinity >= CLOSE_AFFINITY ? [...(BANTER_CLOSE[m] ?? []), ...(BANTER_CLOSE[m] ?? [])] : [])];
}
