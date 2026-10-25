// 營火燼牌（第 27 輪，D-127）：和旅商莫托打的卡牌小遊戲。純 TS、固定種子、可無畫面模擬。
// 規則（三局兩勝、出牌或放棄）：
// - 雙方各有一副 15 張＋1 張晴空的牌，開場抽 10 張；整場不補牌（斥候例外）。
// - 輪流出一張牌到自己的「前排（近戰）」或「後排（遠程）」；放棄後這一局不能再出，對手可以繼續出。
// - 雙方都放棄 → 比總點數，高的贏這一局（平手雙方都算贏）；先贏兩局的人贏整場。
// - 能力：同袍（同排同名牌，每張點數 × 同名張數）、斥候（放到對手那邊、自己抽 2 張）、戰號（這排點數 ×2）、
//   霜寒（雙方前排每張變 1）、濃霧（雙方後排每張變 1）、晴空（清掉天候）、傳奇（不受天候與戰號影響）、
//   燼爆（第 28 輪：燒掉場上點數最高的非傳奇單位，雙方都算，同分一起燒）。
// 第 28 輪（D-129）：三位對手（莫托／荊棘谷的薇菈／裂谷的葛倫），各有牌組、出牌個性與可以贏到的牌。
import { mulberry32, type Rng } from '../rng';

export type Row = 0 | 1; // 0＝前排（近戰），1＝後排（遠程）
export type Ability = 'bond' | 'scout' | 'horn' | 'frost' | 'fog' | 'clear' | 'hero' | 'scorch';

export interface CardDef {
  id: string;
  name: string;
  power: number;
  /** 單位牌放哪一排；特殊牌（戰號、天候）沒有 */
  row?: Row;
  ability?: Ability;
  desc?: string;
}

export const CARDS: Readonly<Record<string, CardDef>> = {
  militia: { id: 'militia', name: '村落民兵', power: 2, row: 0, ability: 'bond', desc: '同袍：同排每多一張，點數倍增' },
  wolfhunter: { id: 'wolfhunter', name: '獵狼人', power: 4, row: 0 },
  shieldman: { id: 'shieldman', name: '盾衛', power: 5, row: 0 },
  sellsword: { id: 'sellsword', name: '傭兵劍士', power: 6, row: 0 },
  bear: { id: 'bear', name: '岩甲熊', power: 8, row: 0 },
  archer: { id: 'archer', name: '林間弓手', power: 3, row: 1, ability: 'bond', desc: '同袍：同排每多一張，點數倍增' },
  slinger: { id: 'slinger', name: '投石手', power: 2, row: 1 },
  mage: { id: 'mage', name: '燼火術士', power: 5, row: 1 },
  ballista: { id: 'ballista', name: '弩砲', power: 7, row: 1 },
  scout: { id: 'scout', name: '霧中斥候', power: 3, row: 0, ability: 'scout', desc: '斥候：放到對手那邊，你抽 2 張' },
  owl: { id: 'owl', name: '夜梟信使', power: 2, row: 1, ability: 'scout', desc: '斥候：放到對手那邊，你抽 2 張' },
  hero_blade: { id: 'hero_blade', name: '星燼劍聖', power: 10, row: 0, ability: 'hero', desc: '傳奇：不受天候與戰號影響' },
  hero_seer: { id: 'hero_seer', name: '星語先知', power: 9, row: 1, ability: 'hero', desc: '傳奇：不受天候與戰號影響' },
  horn: { id: 'horn', name: '戰號', power: 0, ability: 'horn', desc: '戰號：自動放在對你最有利的一排，該排點數 ×2' },
  frost: { id: 'frost', name: '霜寒', power: 0, ability: 'frost', desc: '天候：雙方前排每張都變 1 點' },
  fog: { id: 'fog', name: '濃霧', power: 0, ability: 'fog', desc: '天候：雙方後排每張都變 1 點' },
  clear: { id: 'clear', name: '晴空', power: 0, ability: 'clear', desc: '清掉所有天候' },
  // 第 28 輪：荊棘谷（薇菈）
  thornhound: { id: 'thornhound', name: '棘背獵犬', power: 2, row: 0, ability: 'bond', desc: '同袍：同排每多一張，點數倍增' },
  herbalist: { id: 'herbalist', name: '采藥人', power: 4, row: 1 },
  briar_archer: { id: 'briar_archer', name: '荊棘射手', power: 6, row: 1 },
  hero_queen: { id: 'hero_queen', name: '棘冠狼后', power: 11, row: 0, ability: 'hero', desc: '傳奇：不受天候與戰號影響' },
  // 第 28 輪：燼紅裂谷（葛倫）
  slime: { id: 'slime', name: '熔渣史萊姆', power: 2, row: 0, ability: 'bond', desc: '同袍：同排每多一張，點數倍增' },
  golem: { id: 'golem', name: '熔岩魔像', power: 9, row: 0 },
  forgehand: { id: 'forgehand', name: '鍛爐學徒', power: 4, row: 1 },
  scorch: { id: 'scorch', name: '燼爆', power: 0, ability: 'scorch', desc: '燼爆：燒掉場上點數最高的單位（雙方都算、傳奇除外）' },
  hero_colossus: { id: 'hero_colossus', name: '燼心岩王', power: 12, row: 0, ability: 'hero', desc: '傳奇：不受天候與戰號影響' },
  // 第 28 輪（D-131）：只能在大地圖的寶箱裡找到的牌
  mist_warden: { id: 'mist_warden', name: '迷霧巡守', power: 7, row: 0 },
  thorn_stalker: { id: 'thorn_stalker', name: '荊棘巡獵者', power: 8, row: 0 },
  hero_obsidian: { id: 'hero_obsidian', name: '黑曜首領', power: 9, row: 0, ability: 'hero', desc: '傳奇：不受天候與戰號影響' },
};

/** 寶箱裡的燼牌（D-131）：寶箱 id → 牌；每張只拿一次，守在難去的地方 */
export const CHEST_CARDS: Readonly<Record<string, string>> = { elite_corner: 'mist_warden', tv_gallery_west: 'thorn_stalker', er_vent_heart: 'hero_obsidian' };

/** 玩家的牌組（15 張） */
export const PLAYER_DECK: readonly string[] = ['militia', 'militia', 'militia', 'wolfhunter', 'shieldman', 'sellsword', 'bear', 'archer', 'archer', 'mage', 'ballista', 'scout', 'hero_blade', 'horn', 'frost'];
/** 莫托的牌組（15 張，偏後排＋濃霧） */
export const MERCHANT_DECK: readonly string[] = ['archer', 'archer', 'archer', 'slinger', 'slinger', 'mage', 'mage', 'ballista', 'wolfhunter', 'shieldman', 'sellsword', 'owl', 'hero_seer', 'horn', 'fog'];
const CLEAR_EXTRA = 'clear';

/** 對手（D-129）：牌組、在哪張地圖的營火、出牌個性、下注金額與可以贏到的牌 */
export interface Opponent {
  id: string;
  name: string;
  /** 短稱（紀錄、畫面用） */
  short: string;
  /** 對手所在地圖（莫托跟著你走，每張地圖都在） */
  map?: string;
  deck: readonly string[];
  stake: number;
  /** 下注贏了依序拿到的牌（各對手之間不重複） */
  rewards: readonly string[];
  /** 個性：第一局領先多少就放棄省牌；第一局落後多少就提早放棄（0＝不會） */
  bankAt: number;
  bailAt: number;
  hello: string;
  win: string;
  lose: string;
  blurb: string;
}

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'merchant', name: '旅商莫托', short: '莫托', deck: MERCHANT_DECK, stake: 40, rewards: ['mage', 'owl', 'ballista', 'horn', 'hero_seer'], bankAt: 10, bailAt: 14,
    hello: '「坐下來歇歇腿，玩一把？」', win: '「承讓承讓，金幣我就收下了。」', lose: '「哈，下次我可不會手下留情。」', blurb: '偏後排與濃霧，打法穩健',
  },
  {
    id: 'vela', name: '采藥人薇菈', short: '薇菈', map: 'thornvale', stake: 80, rewards: ['thornhound', 'thornhound', 'briar_archer', 'hero_queen'], bankAt: 8, bailAt: 10,
    deck: ['thornhound', 'thornhound', 'thornhound', 'herbalist', 'herbalist', 'briar_archer', 'wolfhunter', 'sellsword', 'herbalist', 'slinger', 'scout', 'owl', 'hero_queen', 'frost', 'horn'],
    hello: '「荊棘谷的獵犬可是成群結隊的，小心點。」', win: '「獵犬們，今晚加菜。」', lose: '「……你比狼后還難纏。」', blurb: '同袍獵犬群＋霜寒，很會提早收手',
  },
  {
    id: 'goran', name: '鍛爐老兵葛倫', short: '葛倫', map: 'emberrift', stake: 120, rewards: ['golem', 'scorch', 'forgehand', 'hero_colossus'], bankAt: 10, bailAt: 12,
    deck: ['slime', 'slime', 'slime', 'golem', 'golem', 'forgehand', 'sellsword', 'bear', 'mage', 'ballista', 'forgehand', 'owl', 'scorch', 'hero_colossus', 'horn'],
    hello: '「火候到了就出手——燼爆可不挑人。」', win: '「燒得乾乾淨淨。」', lose: '「好，好！這把火你接住了。」', blurb: '大塊頭＋燼爆，從不退讓',
  },
];
export const opponent = (id: string): Opponent => OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0]!;
/** 這張地圖的營火有哪些對手（莫托到處都在） */
export const opponentsAt = (map: string): Opponent[] => OPPONENTS.filter((o) => !o.map || o.map === map);

export interface Side {
  deck: string[];
  hand: string[];
  rows: [string[], string[]];
  horn: [boolean, boolean];
  passed: boolean;
  wins: number;
}

export interface CardGame {
  sides: [Side, Side];
  /** 天候：[前排霜寒, 後排濃霧] */
  weather: [boolean, boolean];
  turn: 0 | 1;
  round: number;
  /** 每局結果：贏家 0／1，平手 -1 */
  results: number[];
  over: boolean;
  /** 整場贏家：0／1，平手 -1 */
  winner?: number;
  log: string[];
  rng: Rng;
  /** 對手的稱呼（紀錄用） */
  oppName?: string;
  /** 最近一次燼爆燒掉的牌：[side, row, id]（畫面演出用） */
  lastBurn?: [number, Row, string][];
}

/** 燼爆要燒的牌：場上點數最高（> 0）的非傳奇單位，同分一起 */
export function scorchTargets(g: CardGame): [number, Row, string][] {
  let max = 0;
  const all: [number, Row, string, number][] = [];
  for (const side of [0, 1])
    for (const row of [0, 1] as const)
      for (const id of g.sides[side]!.rows[row]) {
        if (CARDS[id]!.ability === 'hero') continue;
        const p = cardPower(g, side, row, id);
        all.push([side, row, id, p]);
        if (p > max) max = p;
      }
  return max > 0 ? all.filter((x) => x[3] === max).map(([a, b, c]) => [a, b, c]) : [];
}

function scorch(g: CardGame): [number, Row, string][] {
  const t = scorchTargets(g);
  for (const [side, row, id] of t) {
    const R = g.sides[side]!.rows[row];
    const i = R.lastIndexOf(id);
    if (i >= 0) R.splice(i, 1);
  }
  return t;
}

export type Move = { type: 'play'; card: number } | { type: 'pass' };

function shuffle<T>(rng: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function newSide(rng: Rng, deck: readonly string[]): Side {
  const d = shuffle(rng, [...deck, CLEAR_EXTRA]);
  return { deck: d.slice(10), hand: d.slice(0, 10), rows: [[], []], horn: [false, false], passed: false, wins: 0 };
}

export function newCardGame(seed: number, decks: [readonly string[], readonly string[]] = [PLAYER_DECK, MERCHANT_DECK], oppName = '莫托'): CardGame {
  const rng = mulberry32(seed);
  const sides: [Side, Side] = [newSide(rng, decks[0]), newSide(rng, decks[1])];
  // 先手：擲硬幣
  return { sides, weather: [false, false], turn: rng() < 0.5 ? 0 : 1, round: 1, results: [], over: false, log: [], rng, oppName };
}

/** 某一排的點數（含天候、戰號、同袍） */
export function rowScore(g: CardGame, side: number, row: Row): number {
  const S = g.sides[side]!;
  const cards = S.rows[row];
  let total = 0;
  for (const id of cards) total += cardPower(g, side, row, id);
  return total;
}

/** 單張牌在場上的點數 */
export function cardPower(g: CardGame, side: number, row: Row, id: string): number {
  const c = CARDS[id]!;
  if (c.ability === 'hero') return c.power;
  let p = g.weather[row] ? 1 : c.power;
  if (c.ability === 'bond') p *= g.sides[side]!.rows[row].filter((x) => x === id).length;
  if (g.sides[side]!.horn[row]) p *= 2;
  return p;
}

export function totalScore(g: CardGame, side: number): number {
  return rowScore(g, side, 0) + rowScore(g, side, 1);
}

/** 戰號放哪一排（對自己最有利；兩排都沒有能加倍的牌回 -1，第 28 輪起不能吹在空排） */
export function hornRow(g: CardGame, side: number): Row | -1 {
  const S = g.sides[side]!;
  let best: Row | -1 = -1;
  let gain = -1;
  for (const r of [0, 1] as const) {
    if (S.horn[r]) continue;
    const g0 = rowScore(g, side, r);
    S.horn[r] = true;
    const g1 = rowScore(g, side, r);
    S.horn[r] = false;
    if (g1 - g0 > gain && g1 > g0) {
      gain = g1 - g0;
      best = r;
    }
  }
  return best;
}

/** 合法的出牌（手牌索引）；戰號沒有能加倍的牌時不能出 */
export function legalMoves(g: CardGame, side: number): Move[] {
  if (g.over || g.turn !== side || g.sides[side]!.passed) return [];
  const S = g.sides[side]!;
  const out: Move[] = [{ type: 'pass' }];
  S.hand.forEach((id, i) => {
    if (CARDS[id]!.ability === 'horn' && hornRow(g, side) === -1) return;
    out.push({ type: 'play', card: i });
  });
  return out;
}

/** 執行一步；不合法回 false */
export function applyMove(g: CardGame, side: number, m: Move): boolean {
  if (g.over || g.turn !== side) return false;
  const S = g.sides[side]!;
  if (S.passed) return false;
  const O = g.sides[1 - side]!;
  if (m.type === 'pass') {
    S.passed = true;
    g.log.push(`${side === 0 ? '你' : (g.oppName ?? '莫托')}放棄了這一局`);
  } else {
    const id = S.hand[m.card];
    if (!id) return false;
    const c = CARDS[id]!;
    if (c.ability === 'horn') {
      const r = hornRow(g, side);
      if (r === -1) return false;
      S.horn[r] = true;
    } else if (c.ability === 'frost') g.weather[0] = true;
    else if (c.ability === 'fog') g.weather[1] = true;
    else if (c.ability === 'clear') g.weather = [false, false];
    else if (c.ability === 'scorch') g.lastBurn = scorch(g);
    else if (c.ability === 'scout') {
      O.rows[c.row!].push(id);
      for (let k = 0; k < 2 && S.deck.length; k++) S.hand.push(S.deck.shift()!);
    } else S.rows[c.row!].push(id);
    S.hand.splice(m.card, 1);
    g.log.push(`${side === 0 ? '你' : (g.oppName ?? '莫托')}出了「${c.name}」`);
    if (!S.hand.length) S.passed = true; // 手牌出完＝自動放棄
  }
  advance(g, side);
  return true;
}

function advance(g: CardGame, side: number): void {
  const [a, b] = g.sides;
  if (a.passed && b.passed) return endRound(g);
  const other = (1 - side) as 0 | 1;
  // 對手還沒放棄就換人；對手已放棄就自己繼續
  g.turn = g.sides[other].passed ? (side as 0 | 1) : other;
  // 自己手牌空了、對手也放棄 → 已在上面處理；對手手牌空時自動放棄
  if (!g.sides[g.turn].hand.length) {
    g.sides[g.turn].passed = true;
    advance(g, g.turn);
  }
}

function endRound(g: CardGame): void {
  const s0 = totalScore(g, 0);
  const s1 = totalScore(g, 1);
  const w = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;
  g.results.push(w);
  if (w === -1) {
    g.sides[0].wins++;
    g.sides[1].wins++;
  } else g.sides[w]!.wins++;
  g.log.push(`第 ${g.round} 局 ${s0}：${s1}，${w === 0 ? '你贏了' : w === 1 ? `${g.oppName ?? '莫托'}贏了` : '平手'}`);
  const [a, b] = g.sides;
  if (a.wins >= 2 || b.wins >= 2 || g.round >= 3) {
    g.over = true;
    g.winner = a.wins > b.wins ? 0 : b.wins > a.wins ? 1 : -1;
    return;
  }
  // 清場、天候、放棄狀態；上一局輸的人先手（平手照原順序）
  for (const S of g.sides) {
    S.rows = [[], []];
    S.horn = [false, false];
    S.passed = false;
  }
  g.weather = [false, false];
  g.round++;
  g.turn = w === 0 ? 1 : w === 1 ? 0 : g.turn;
  if (!g.sides[g.turn].hand.length) {
    g.sides[g.turn].passed = true;
    advance(g, g.turn);
  }
}

/** 試走一步看分差變化（不改原局） */
function deltaOf(g: CardGame, side: number, m: Move): number {
  const before = totalScore(g, side) - totalScore(g, 1 - side);
  const c = cloneGame(g);
  applyMove(c, side, m);
  if (c.round !== g.round || c.over) return 0;
  return totalScore(c, side) - totalScore(c, 1 - side) - before;
}

export function cloneGame(g: CardGame): CardGame {
  return {
    ...g,
    sides: g.sides.map((S) => ({ ...S, deck: [...S.deck], hand: [...S.hand], rows: [[...S.rows[0]], [...S.rows[1]]], horn: [...S.horn] })) as [Side, Side],
    weather: [...g.weather],
    results: [...g.results],
    log: [],
    rng: g.rng,
  };
}

/**
 * 簡單 AI（莫托，也給測試當玩家 Bot）：
 * - 對手已放棄：分數領先就放棄；落後就出「剛好追過」的最小牌，追不上就放棄（留牌）。
 * - 對手還在出：先出斥候（多抽牌）；第一局領先 ≥ 10 且手牌不比對手少 → 放棄省牌；
 *   否則出分差變化最大的牌（第一、二局在變化差不多時挑點數小的）。
 * - 這一局輸了就輸整場時不會提早放棄。
 */
export function aiMove(g: CardGame, side: number, who: Opponent = OPPONENTS[0]!): Move {
  const moves = legalMoves(g, side).filter((m): m is { type: 'play'; card: number } => m.type === 'play');
  if (!moves.length) return { type: 'pass' };
  const me = g.sides[side]!;
  const op = g.sides[1 - side]!;
  const lead = totalScore(g, side) - totalScore(g, 1 - side);
  const mustWin = op.wins >= 1;
  const scored = moves.map((m) => ({ m, d: deltaOf(g, side, m), id: me.hand[m.card]! }));
  if (op.passed) {
    if (lead > 0) return { type: 'pass' };
    const win = scored.filter((x) => lead + x.d > 0).sort((a, b) => CARDS[a.id]!.power - CARDS[b.id]!.power || a.d - b.d);
    if (win.length) return win[0]!.m;
    if (!mustWin && me.wins >= 1) return { type: 'pass' };
    const best = scored.sort((a, b) => b.d - a.d)[0]!;
    return best.d > 0 ? best.m : { type: 'pass' };
  }
  const scout = scored.find((x) => CARDS[x.id]!.ability === 'scout' && me.deck.length > 0);
  if (scout && g.round < 3) return scout.m;
  if (!mustWin && lead >= who.bankAt && me.hand.length >= op.hand.length && g.round === 1) return { type: 'pass' };
  // 第一局落後太多、對手已經砸了不少牌 → 收手省牌（D-129；莫托以前從不這樣做）
  if (who.bailAt && g.round === 1 && lead <= -who.bailAt && me.hand.length > op.hand.length) return { type: 'pass' };
  if (me.wins >= 1 && lead >= 6 && me.hand.length >= op.hand.length) return { type: 'pass' };
  const useful = scored.filter((x) => x.d > 0);
  if (!useful.length) return { type: 'pass' };
  const top = Math.max(...useful.map((x) => x.d));
  const pool = g.round < 3 && !mustWin ? useful.filter((x) => x.d >= top * 0.6) : useful.filter((x) => x.d === top);
  pool.sort((a, b) => (g.round < 3 ? CARDS[a.id]!.power - CARDS[b.id]!.power : b.d - a.d));
  return pool[0]!.m;
}

/** 下注贏了依序拿到莫托的一張牌（加進你的牌組；全部拿完就只拿金幣） */
export const CARD_REWARDS: readonly string[] = OPPONENTS[0]!.rewards;
const ALL_REWARDS: readonly string[] = [...OPPONENTS.flatMap((o) => o.rewards), ...Object.values(CHEST_CARDS)];

/** 手上所有的牌＝基本牌組＋贏來的牌（未知 id、超過可贏張數的會被丟掉） */
export function ownedCards(won: readonly string[]): string[] {
  const left = [...ALL_REWARDS];
  const out: string[] = [];
  for (const id of won) {
    const i = left.indexOf(id);
    if (i < 0) continue;
    left.splice(i, 1);
    out.push(id);
  }
  return [...PLAYER_DECK, ...out];
}

/** 牌組下限（D-130 自己組牌）：開場要抽 10 張，再留一點變化 */
export const DECK_MIN = 12;

/**
 * 你的牌組：手上所有的牌拿掉「留在箱子裡」的（off，可重複 id），超過 18 張自動拿掉最弱的。
 * off 拿太多（少於 12 張）時忽略 off，避免壞存檔讓牌組太小。
 */
export function deckWith(won: readonly string[], off: readonly string[] = []): string[] {
  const all = ownedCards(won);
  const d = [...all];
  for (const id of off) {
    const i = d.lastIndexOf(id);
    if (i >= 0) d.splice(i, 1);
  }
  return trimDeck(d.length >= DECK_MIN ? d : all);
}

/** 牌組上限（D-129）：贏來的牌太多會稀釋手牌，超過就自動拿掉最弱的單位（同袍算整組、特殊牌／傳奇／斥候不拿） */
export const DECK_MAX = 18;
function cardValue(deck: readonly string[], id: string): number {
  const c = CARDS[id]!;
  return c.ability === 'bond' ? c.power * deck.filter((x) => x === id).length : c.power;
}
export function trimDeck(deck: string[]): string[] {
  const d = [...deck];
  while (d.length > DECK_MAX) {
    let worst = -1;
    let wv = Infinity;
    d.forEach((id, i) => {
      const c = CARDS[id]!;
      if (c.row === undefined || c.ability === 'hero' || c.ability === 'scout') return;
      const v = cardValue(d, id);
      if (v < wv) {
        wv = v;
        worst = i;
      }
    });
    if (worst < 0) break;
    d.splice(worst, 1);
  }
  return d;
}

/** 下一張可以從這位對手贏到的牌（沒有了回 undefined；預設莫托） */
export function nextReward(won: readonly string[], who: Opponent = OPPONENTS[0]!): string | undefined {
  const left = [...who.rewards];
  for (const id of won) {
    const i = left.indexOf(id);
    if (i >= 0) left.splice(i, 1);
  }
  return left[0];
}

/** 下注與獎金：贏了拿回賭注 ×2，平手退回 */
export const CARD_STAKE = 40;
