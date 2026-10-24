// 長尾系統（強化／詞綴／掉落／深淵）的共用定義與規則版本（design/14 階段 1.3）。
// **任何會改變機率、數值或成本的修改都要把 RULES_VERSION 加 1**，事件紀錄與結果會附上當時的版本，
// 之後才能解釋舊紀錄（也是將來公開機率時的版本號）。

/** 1：初版資料表。2：D-058 強化 +9／+10 失敗改為不降級（10 萬次模擬校準） */
export const RULES_VERSION = 2;

/**
 * 長尾裝備的 6 階稀有度（D-053）。
 * 注意：現有主線裝備（`equipment.ts` 的 `Rarity`：common／rare／legendary＝顯示「神級」）是舊的 3 階，
 * 階段 2.2 換 6 格裝備時再對映（common→common、rare→rare、legendary→divine）。
 */
export const TIERS = ['common', 'magic', 'rare', 'epic', 'legend', 'divine'] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_NAME: Record<Tier, string> = { common: '普通', magic: '魔法', rare: '稀有', epic: '史詩', legend: '傳說', divine: '神級' };
export const TIER_CSS: Record<Tier, string> = { common: '#ffffff', magic: '#7dffb0', rare: '#7cc0ff', epic: '#c48aff', legend: '#ffb347', divine: '#ffd05a' };
export const tierRank = (t: Tier): number => TIERS.indexOf(t);

/** 每階的隨機詞綴條數；傳說／神級另有固定效果（不可重鑄） */
export const AFFIX_COUNT: Record<Tier, number> = { common: 0, magic: 1, rare: 2, epic: 3, legend: 2, divine: 1 };
export const HAS_FIXED_EFFECT: Record<Tier, boolean> = { common: false, magic: false, rare: false, epic: false, legend: true, divine: true };

/** 6 格裝備（D-053）：飾品有 2 格，共用 'charm' 部位類型 */
export const GEAR_SLOTS = ['weapon', 'armor', 'head', 'charm', 'core'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
export const EQUIP_SLOTS = ['weapon', 'armor', 'head', 'charm1', 'charm2', 'core'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export const slotType = (s: EquipSlot): GearSlot => (s === 'charm1' || s === 'charm2' ? 'charm' : s);
