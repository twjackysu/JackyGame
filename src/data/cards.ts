/**
 * 燼牌 v2 — P0 card table and deck lists (see docs/design/09-data-tables.md §5).
 * Pure data, no Phaser dependency.
 */

/** Keywords (docs 03 §6.3). P0: light/chain/ember/scorch/snuff/echo. ward/ignite/lone are implemented too; swap is P1 (no-op). */
export type Keyword =
  | 'light' // 點燈
  | 'chain' // 連燈
  | 'ember' // 餘燼
  | 'scorch' // 灼照
  | 'ward' // 守望
  | 'snuff' // 吹熄
  | 'swap' // 換座 (P1, not implemented — treated as vanilla)
  | 'echo' // 回響
  | 'ignite' // 引火
  | 'lone'; // 孤燈

/** Special on-play / spell effects that are not plain keywords. */
export type CardEffect =
  | 'fortune' // 占卜師：打出時看對手 3 張手牌
  | 'gust' // 夜風：吹熄對手任一非傳說牌（回手牌）
  | 'oil' // 添油：我方一張非傳說牌 +2
  | 'moonturn' // 轉月：立即重翻本夜月相
  | 'io_draw' // 霧中歌姬：打出時抽 1 張
  | 'lian_rally'; // 被逐的掌燈人：我方每張點燈牌 +2

export type Faction = 'townsfolk' | 'cult' | 'neutral';
export type CardKind = 'unit' | 'spell';

export interface CardDef {
  id: string;
  name: string; // zh-TW display name (to be moved to i18n later)
  faction: Faction;
  kind: CardKind;
  power: number; // 0 for spells
  keywords: readonly Keyword[];
  legend: boolean;
  effect?: CardEffect;
}

const u = (
  id: string,
  name: string,
  faction: Faction,
  power: number,
  keywords: Keyword[] = [],
  extra: Partial<Pick<CardDef, 'legend' | 'effect'>> = {},
): CardDef => ({ id, name, faction, kind: 'unit', power, keywords, legend: extra.legend ?? false, effect: extra.effect });

const s = (id: string, name: string, effect: CardEffect): CardDef => ({
  id,
  name,
  faction: 'neutral',
  kind: 'spell',
  power: 0,
  keywords: [],
  legend: false,
  effect,
});

export const CARD_LIST: readonly CardDef[] = [
  // 灰燈鎮民
  u('t_lamplighter', '夜巡掌燈人', 'townsfolk', 2, ['light']),
  u('t_militia', '鎮民兵', 'townsfolk', 3, ['chain']),
  u('t_bellringer', '敲鐘人', 'townsfolk', 4, ['ward']),
  u('t_archer', '鐘樓弓手', 'townsfolk', 5),
  u('t_child', '提燈的孩子', 'townsfolk', 1, ['light', 'ember']),
  u('t_matron', '孤兒院院長', 'townsfolk', 3, ['ignite']),
  u('t_hunter', '林間獵人', 'townsfolk', 6, ['lone']),
  u('t_blacksmith', '鐵匠', 'townsfolk', 7),
  u('t_watchman', '老守衛隊長', 'townsfolk', 9, [], { legend: true }),
  // 燼牌會
  u('c_dealer', '莊家', 'cult', 4, ['swap']),
  u('c_cardsharp', '老千', 'cult', 3, ['snuff']),
  u('c_bouncer', '保鏢', 'cult', 6),
  u('c_juggler', '雜耍藝人', 'cult', 2, ['echo']),
  u('c_fortune', '占卜師', 'cult', 4, [], { effect: 'fortune' }),
  u('c_smuggler', '走私客', 'cult', 5, ['chain']),
  u('c_fire_eater', '吞火人', 'cult', 5, ['scorch']),
  u('c_veteran', '餘燼騎士', 'cult', 10, [], { legend: true }),
  // 中立
  u('n_wanderer', '流浪劍客', 'neutral', 5),
  u('n_mage', '流浪術士', 'neutral', 4, ['scorch']),
  u('n_lone_star', '孤星', 'neutral', 3, ['lone']),
  s('n_gust', '夜風', 'gust'),
  s('n_oil', '添油', 'oil'),
  s('n_moonturn', '轉月', 'moonturn'),
  u('n_io', '霧中歌姬', 'neutral', 8, [], { legend: true, effect: 'io_draw' }),
  u('n_lian', '被逐的掌燈人', 'neutral', 6, [], { legend: true, effect: 'lian_rally' }),
];

export const CARDS: Readonly<Record<string, CardDef>> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const c = CARDS[id];
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}

const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);

/** 玩家起始（17）：鎮民全部除老守衛隊長（14）+ 流浪劍客、孤星、添油。 */
export const DECK_PLAYER_STARTER: readonly string[] = [
  ...rep('t_lamplighter', 3),
  ...rep('t_militia', 3),
  't_bellringer',
  ...rep('t_archer', 2),
  ...rep('t_child', 2),
  't_matron',
  't_hunter',
  't_blacksmith',
  'n_wanderer',
  'n_lone_star',
  'n_oil',
];

/** 洛克正式局（20）：燼牌會全部（12）+ 6 中立 + 鎮民兵 ×2。 */
export const DECK_ROURKE_OFFICIAL: readonly string[] = [
  'c_dealer',
  ...rep('c_cardsharp', 2),
  ...rep('c_bouncer', 2),
  ...rep('c_juggler', 2),
  'c_fortune',
  ...rep('c_smuggler', 2),
  'c_fire_eater',
  'c_veteran',
  'n_wanderer',
  'n_mage',
  'n_lone_star',
  'n_gust',
  'n_oil',
  'n_moonturn',
  ...rep('t_militia', 2),
];

/** 洛克正式局，揭穿後（騎士抽出牌組，19 張）。 */
export const DECK_ROURKE_OFFICIAL_NO_LEGEND: readonly string[] = DECK_ROURKE_OFFICIAL.filter((id) => id !== 'c_veteran');

/** 教學局：雙方各 8 張，只有單位牌（無關鍵字）與點燈。 */
export const DECK_TUTORIAL_PLAYER: readonly string[] = [
  ...rep('t_lamplighter', 3),
  ...rep('t_archer', 2),
  't_blacksmith',
  'n_wanderer',
  'c_bouncer',
];
export const DECK_ROURKE_TUTORIAL: readonly string[] = [
  ...rep('t_lamplighter', 2),
  ...rep('c_bouncer', 2),
  ...rep('t_archer', 2),
  'n_wanderer',
  't_blacksmith',
];

/** 伯恩（17）：鎮民牌組 + 月相相關（轉月）。 */
export const DECK_BERN: readonly string[] = [
  ...DECK_PLAYER_STARTER.filter((id) => id !== 'n_oil'),
  'n_moonturn',
];

export const DECK_MIN = 15;
export const DECK_MAX = 25;
export const DECK_LEGEND_MAX = 2;

/** Validates a constructed deck (15–25 cards, ≤2 legends, known ids). Returns error strings (empty = valid). */
export function validateDeck(deck: readonly string[]): string[] {
  const errors: string[] = [];
  if (deck.length < DECK_MIN || deck.length > DECK_MAX) errors.push(`deck size ${deck.length} not in ${DECK_MIN}-${DECK_MAX}`);
  let legends = 0;
  for (const id of deck) {
    const c = CARDS[id];
    if (!c) errors.push(`unknown card ${id}`);
    else if (c.legend) legends++;
  }
  if (legends > DECK_LEGEND_MAX) errors.push(`too many legends: ${legends}`);
  return errors;
}
