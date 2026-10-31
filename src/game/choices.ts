// 討伐後的抉擇（第 35 輪，D-157）：三位主線 Boss 第一次倒下時，要你決定怎麼處置牠留下的東西——
// 「取」＝馬上拿到結晶（強化用）；「還」＝這片土地記得你的善意：之後行商的裝備便宜（每次 −10%，主線最多 −30%、加上通關後的星隕高原 −40%）。
// 結局的結語也會跟著你的選擇改變。純畫面＋存檔層：不動戰鬥核心、不影響 stateHash。存 localStorage `jg_choices`。

export type ChoicePick = 'take' | 'spare';

export interface ChoiceOption {
  label: string;
  desc: string;
  /** 選完的一句話（大字） */
  after: string;
}

export interface BossChoice {
  map: string;
  title: string;
  prompt: string;
  take: ChoiceOption & { crystal: number };
  spare: ChoiceOption;
  /** ☰ 紀錄裡怎麼稱呼你的選擇 */
  short: Record<ChoicePick, string>;
  /** 通關後的挑戰地圖（星隕高原，第 36 輪）：不算進三片土地的結語，改在結語最後多一句尾聲 */
  postGame?: true;
}

/** 每個「還」讓行商的裝備便宜幾 %（可疊；四個都還＝−40%） */
export const SPARE_DISCOUNT = 10;

export const BOSS_CHOICES: readonly BossChoice[] = [
  {
    map: 'mistwood',
    title: '霧角狼王倒下了',
    prompt: '牠額上的霧角還在發光。\n前世的攻略說：折下來，是很好的強化材料。\n可是霧裡，好像有小狼在看著你。',
    take: { label: '折下霧角', desc: '馬上得到 3 顆結晶（強化 +6 以上要用）', after: '霧角在你手裡慢慢冷了下來。', crystal: 3 },
    spare: { label: '讓牠回到霧裡', desc: '森林會記得你：之後行商的裝備便宜 10%', after: '狼王化成霧散開了。遠處傳來一聲小小的嚎叫。' },
    short: { take: '折下霧角', spare: '讓狼王回到霧裡' },
  },
  {
    map: 'thornvale',
    title: '棘冠狼后倒下了',
    prompt: '荊棘王冠從牠頭上滑落，\n根鬚還連著山谷深處的母樹。\n扯斷它，王冠就是你的。',
    take: { label: '摘下荊棘王冠', desc: '馬上得到 4 顆結晶', after: '根鬚斷開的聲音，像一聲嘆息。', crystal: 4 },
    spare: { label: '把王冠還給母樹', desc: '山谷會記得你：之後行商的裝備再便宜 10%', after: '王冠沉進土裡。荊棘之間，冒出了一朵白花。' },
    short: { take: '摘下荊棘王冠', spare: '把王冠還給母樹' },
  },
  {
    map: 'emberrift',
    title: '燼心岩王倒下了',
    prompt: '岩王胸口的燼心還在跳動。\n挖出來，就是傳說中的星燼結晶。\n留著它，裂谷的火就不會熄。',
    take: { label: '挖出燼心', desc: '馬上得到 5 顆結晶', after: '燼心在你掌心跳了最後一下。裂谷暗了。', crystal: 5 },
    spare: { label: '讓燼心繼續燃燒', desc: '裂谷會記得你：之後行商的裝備再便宜 10%', after: '岩王的胸口重新亮起。熔岩低聲流動，像在道謝。' },
    short: { take: '挖出燼心', spare: '讓燼心繼續燃燒' },
  },
  {
    // 第 36 輪：通關後的星隕高原也來一題（D-158）。尾聲接在「這個世界，還在等你」之後
    map: 'starfall',
    title: '星骸守望者倒下了',
    prompt: '守望者的胸口，嵌著一顆墜落的星。\n它在這片高原上守了多久，沒有人知道。\n星星還在微微發亮，像在等誰。',
    take: { label: '取下墜星核', desc: '馬上得到 6 顆結晶', after: '星光在你掌心熄滅了。高原的夜，暗了一點。', crystal: 6 },
    spare: { label: '讓星星回到夜空', desc: '高原會記得你：行商的裝備再便宜 10%\n還有一顆小星星會跟著你', after: '墜星慢慢升起，回到了星座的缺口。夜空完整了。' },
    short: { take: '取下墜星核', spare: '讓星星回到夜空' },
    postGame: true,
  },
];

export const choiceOf = (map: string): BossChoice | undefined => BOSS_CHOICES.find((c) => c.map === map);

const KEY = 'jg_choices';

/** 讀已做的抉擇（壞資料、未知地圖、未知選項丟掉） */
export function loadChoices(): Record<string, ChoicePick> {
  try {
    return cleanChoices(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function cleanChoices(raw: unknown): Record<string, ChoicePick> {
  const out: Record<string, ChoicePick> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const c of BOSS_CHOICES) {
    const v = (raw as Record<string, unknown>)[c.map];
    if (v === 'take' || v === 'spare') out[c.map] = v;
  }
  return out;
}

/** 記下抉擇（已經選過的不會被改：抉擇只有一次） */
export function makeChoice(cur: Record<string, ChoicePick>, map: string, pick: ChoicePick): Record<string, ChoicePick> | null {
  if (!choiceOf(map) || cur[map]) return null;
  return { ...cur, [map]: pick };
}

export function saveChoices(c: Record<string, ChoicePick>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* 無痕模式 */
  }
}

/** 行商裝備的折扣 %（每個「還」10%） */
export function shopDiscountPct(c: Record<string, ChoicePick>): number {
  return Object.values(c).filter((v) => v === 'spare').length * SPARE_DISCOUNT;
}

/**
 * 結語裡依抉擇換掉的那一句（三個都還／都取／混合；一個都沒選＝舊存檔或 Bot，回 null 不插入）。
 */
export function epilogueLine(c: Record<string, ChoicePick>): string | null {
  const picks = BOSS_CHOICES.filter((b) => !b.postGame).map((b) => c[b.map]).filter((v): v is ChoicePick => !!v);
  if (!picks.length) return null;
  const spare = picks.filter((v) => v === 'spare').length;
  // 只選過一部分（舊存檔打倒的 Boss 沒被問過）：不能說「三樣都還在／都在行囊」，換不點名的句子（第 79 輪）
  const mains = BOSS_CHOICES.filter((b) => !b.postGame).length;
  if (picks.length < mains) {
    if (spare === picks.length) return '你把能還的，都還了回去。\n這片土地，會用它自己的方式記得你。';
    if (spare === 0) return '你帶走了牠們留下的東西。\n這片土地的主人，從此只剩下你。';
  }
  if (spare === picks.length) return '你沒有從牠們身上拿走任何東西。\n小狼、白花、燼心的火——都還在。';
  if (spare === 0) return '霧角、王冠、燼心，都收在你的行囊裡。\n這片土地的主人，從此只剩下你。';
  return '有些東西你帶走了，有些你留了下來。\n這片土地，會用它自己的方式記得你。';
}

/** 星隕高原的尾聲（接在結語最後一句之後；沒選過＝null）。從標題「回顧結局」重看時才會出現 */
export function codaLine(c: Record<string, ChoicePick>): string | null {
  const p = c.starfall;
  if (p === 'spare') return '後來，高原的夜空多了一顆星。\n每次你抬頭，它都亮一下。';
  if (p === 'take') return '後來，高原的夜空少了一顆星。\n只有你知道，它在你的行囊裡。';
  return null;
}

/** 在結語的最後一句之前插入抉擇那一句；星隕高原選過的話，最後再接一句尾聲 */
export function withEpilogue(lines: readonly string[], c: Record<string, ChoicePick>): string[] {
  const e = epilogueLine(c);
  const coda = codaLine(c);
  const out = !e || !lines.length ? [...lines] : [...lines.slice(0, -1), e, lines[lines.length - 1]!];
  return coda && out.length ? [...out, coda] : out;
}

/** 燼牌對手對你的抉擇的一句開場白（對手 id → 他所在的地圖）；沒選過回 null */
const RIVAL_ECHO: Record<string, { map: string; take: string; spare: string }> = {
  merchant: { map: 'mistwood', take: '「霧角賣不賣？開玩笑的，坐吧。」', spare: '「最近霧裡的小狼，常在營火邊打轉。」' },
  vela: { map: 'thornvale', take: '「王冠……你真的扯斷了根。算了，出牌吧。」', spare: '「母樹那邊開了白花——是你吧？謝謝。」' },
  sol: { map: 'starfall', take: '「天上少了一顆星……我數了三遍。坐吧。」', spare: '「昨晚星座的缺口補上了。年輕人，謝謝你。」' },
  goran: { map: 'emberrift', take: '「燼心在你手上？哼，讓我看看你配不配。」', spare: '「裂谷的火還在燒——老頭子我欠你一杯。」' },
};

export function rivalEcho(id: string, c: Record<string, ChoicePick>): string | null {
  const r = RIVAL_ECHO[id];
  const p = r ? c[r.map] : undefined;
  return r && p ? r[p] : null;
}
