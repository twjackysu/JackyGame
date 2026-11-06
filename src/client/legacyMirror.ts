// 過渡期（D-281／D-285）：伺服器處理完面板的動作後，把角色的結果「單向」寫回第一期的舊 key（jg_rt_mistwood），
// 讓還沒切到 GameClient 的程式（戰鬥場景、HUD）照舊讀得到。全部切完（V5 loot.claim）後刪掉這個檔案。
import type { CharacterView, CurrencyId } from '../net/views';

/** 共用進度存在第一張地圖的紀錄（和 src/server/legacy.ts 的 LEGACY_HOME 一樣） */
export const MIRROR_KEY = 'jg_rt_mistwood';
const CUR: readonly CurrencyId[] = ['coin', 'dust', 'crystal'];
/** 寫回哪些欄位（只寫這次動作會改到的，其他欄位留給還沒切的程式） */
export type MirrorField = 'items' | 'wallet' | 'skills' | 'shop';
export const ALL_FIELDS: readonly MirrorField[] = ['items', 'wallet', 'skills', 'shop'];

/** 舊紀錄＋伺服器的角色 → 新的舊紀錄。材料＝累計撿到 − spent，所以只改 spent，不動累計（統計數字照舊） */
export function mirrorRecord(rec: Record<string, unknown>, v: CharacterView, fields: readonly MirrorField[] = ALL_FIELDS): Record<string, unknown> {
  const bag = v.items.filter((i) => i.location === 'bag').sort((a, b) => a.pos - b.pos).map((i) => i.gear);
  const equip: Record<string, unknown> = {};
  for (const i of v.items) if (i.location.startsWith('equip:')) equip[i.location.slice(6)] = i.gear;
  const old = rec.spent && typeof rec.spent === 'object' ? (rec.spent as Record<string, unknown>) : {};
  const spent: Record<string, unknown> = { ...old };
  for (const c of CUR) {
    const total = typeof rec[c] === 'number' && Number.isFinite(rec[c]) ? Math.floor(rec[c] as number) : 0;
    spent[c] = total - v.wallet[c];
  }
  const out = { ...rec };
  if (fields.includes('items')) Object.assign(out, { bag, equip });
  if (fields.includes('wallet')) out.spent = spent;
  if (fields.includes('skills')) Object.assign(out, { skills: v.skills, variants: v.variants });
  if (fields.includes('shop')) out.shop = v.shop;
  return out;
}

export function mirrorToLegacy(ls: Pick<Storage, 'getItem' | 'setItem'>, v: CharacterView, fields: readonly MirrorField[] = ALL_FIELDS): void {
  let rec: Record<string, unknown> = {};
  try {
    const x = JSON.parse(ls.getItem(MIRROR_KEY) ?? '{}') as unknown;
    if (x && typeof x === 'object' && !Array.isArray(x)) rec = x as Record<string, unknown>;
  } catch {
    /* 壞掉的紀錄就從空的開始 */
  }
  try {
    ls.setItem(MIRROR_KEY, JSON.stringify(mirrorRecord(rec, v, fields)));
  } catch {
    /* 無痕模式 */
  }
}
