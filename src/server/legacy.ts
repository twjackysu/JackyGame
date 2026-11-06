// 第一期的 localStorage 存檔 → 帳號／角色／物品／錢包（design/24 §3、23 Q2）。純函式，有測試。
// 舊格式（src/game/rtRecord.ts）：jg_rt_<第一張地圖> 放共用進度（等級、行囊、材料…）＋自己的地圖欄位；
// 其他 jg_rt_<map> 只有地圖欄位（MAP_KEYS）。材料＝累計撿到 − spent。jg_weapon 是武器。
import { isGear, type RtGear } from '../core/battle/rt/gear';
import type { CurrencyId, LegacySnapshot, MapProgressView, WeaponView } from '../net/views';
import { DEVICE_KEY } from '../net/legacyKeys';

/** 和 src/game/rtRecord.ts 的 MAP_KEYS 一樣（tests/server-contract/legacy.test.ts 會檢查） */
export const LEGACY_MAP_KEYS = ['bossKills', 'firstAt', 'bestBossSec', 'chests', 'fury', 'furyKills', 'night', 'fire'] as const;
/** 共用進度存在哪張地圖（第一張大地圖） */
export const LEGACY_HOME = 'mistwood';
const STAT_KEYS = ['kills', 'runs', 'playSec', 'coin', 'dust', 'crystal'] as const;
/** 劇情、教學、提示等旗標：原樣搬進角色的 story（V2 再分類） */
const STORY_KEY = /^jg_(?!rt_|weapon$|backup_)/;

export interface LegacyCharacter {
  weapon: WeaponView;
  level: number;
  xp: number;
  stats: Record<string, number>;
  skills: unknown;
  variants: unknown;
  bounty: unknown;
  shop: unknown;
  maps: Record<string, MapProgressView>;
  story: Record<string, string>;
  bag: RtGear[];
  equip: Record<string, RtGear>;
  wallet: Record<CurrencyId, number>;
  skipped: string[];
}

const okNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function parse(s: string | undefined): Record<string, unknown> | null {
  if (s === undefined) return null;
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapPart(rec: Record<string, unknown>): MapProgressView {
  const out: MapProgressView = {};
  for (const k of ['bossKills', 'firstAt', 'bestBossSec', 'furyKills'] as const) if (okNum(rec[k])) out[k] = rec[k];
  for (const k of ['fury', 'night'] as const) if (typeof rec[k] === 'boolean') out[k] = rec[k];
  if (typeof rec.fire === 'string') out.fire = rec.fire;
  if (Array.isArray(rec.chests)) out.chests = rec.chests.filter((c): c is string => typeof c === 'string');
  return out;
}

export function isLegacyEmpty(snap: LegacySnapshot): boolean {
  return !Object.keys(snap).some((k) => k.startsWith('jg_'));
}

/** 舊存檔快照 → 一個角色的資料 */
export function fromLegacy(snap: LegacySnapshot): LegacyCharacter {
  const skipped: string[] = [];
  const home = parse(snap[`jg_rt_${LEGACY_HOME}`]) ?? {};
  const maps: Record<string, MapProgressView> = {};
  const story: Record<string, string> = {};
  for (const [k, v] of Object.entries(snap)) {
    if (k.startsWith('jg_rt_')) {
      const rec = parse(v);
      if (!rec) skipped.push(k);
      else {
        const m = mapPart(rec);
        if (Object.keys(m).length) maps[k.slice(6)] = m;
      }
    } else if (STORY_KEY.test(k)) story[k] = v;
  }
  const w = snap.jg_weapon;
  const weapon: WeaponView = w === 'bow' || w === 'staff' ? w : 'sword';
  const stats: Record<string, number> = {};
  for (const k of STAT_KEYS) if (okNum(home[k])) stats[k] = Math.floor(home[k]);
  const spent = obj(home.spent);
  const have = (k: CurrencyId) => Math.max(0, Math.floor((okNum(home[k]) ? home[k] : 0) - (typeof spent[k] === 'number' && Number.isFinite(spent[k]) ? (spent[k] as number) : 0)));
  const bag = (Array.isArray(home.bag) ? home.bag : []).filter(isGear).slice(0, 60);
  const equip: Record<string, RtGear> = {};
  for (const [slot, g] of Object.entries(obj(home.equip))) if (isGear(g) && g.slot === slot) equip[slot] = g;
  return {
    weapon,
    level: okNum(home.level) ? Math.max(1, Math.floor(home.level)) : 1,
    xp: okNum(home.xp) ? Math.floor(home.xp) : 0,
    stats,
    skills: home.skills ?? null,
    variants: home.variants ?? null,
    bounty: home.bounty ?? null,
    shop: home.shop ?? null,
    maps,
    story,
    bag,
    equip,
    wallet: { coin: have('coin'), dust: have('dust'), crystal: have('crystal') },
    skipped,
  };
}


export interface LegacySource {
  weapon: WeaponView;
  level: number;
  xp: number;
  stats: Record<string, number>;
  skills: unknown;
  variants: unknown;
  bounty: unknown;
  shop: unknown;
  maps: Record<string, MapProgressView>;
  story: Record<string, string>;
  bag: RtGear[];
  equip: Record<string, RtGear>;
  wallet: Record<CurrencyId, number>;
}

/**
 * 角色 → 舊存檔快照（fromLegacy 的反方向；換角色時把新角色寫回舊 key，D-302）。
 * 材料＝累計撿到 − spent：累計照角色的 stats，spent＝累計 − 手上有的（拍賣所賺的錢會讓 spent 變負，和 legacyMirror 一樣）。
 * 不含裝置 key（DEVICE_KEY）。
 */
export function toLegacy(c: LegacySource): LegacySnapshot {
  const out: LegacySnapshot = {};
  const home: Record<string, unknown> = { ...(c.maps[LEGACY_HOME] ?? {}) };
  for (const k of STAT_KEYS) if (okNum(c.stats[k])) home[k] = c.stats[k];
  home.level = c.level;
  home.xp = c.xp;
  const spent: Record<string, number> = {};
  for (const cur of ['coin', 'dust', 'crystal'] as const) {
    const total = okNum(c.stats[cur]) ? c.stats[cur] : 0;
    if (total !== c.wallet[cur]) spent[cur] = total - c.wallet[cur];
  }
  if (Object.keys(spent).length) home.spent = spent;
  home.bag = c.bag;
  home.equip = c.equip;
  for (const [k, v] of [['skills', c.skills], ['variants', c.variants], ['bounty', c.bounty], ['shop', c.shop]] as const) if (v !== null && v !== undefined) home[k] = v;
  out[`jg_rt_${LEGACY_HOME}`] = JSON.stringify(home);
  for (const [id, m] of Object.entries(c.maps)) if (id !== LEGACY_HOME && /^[a-z0-9_]{1,32}$/.test(id) && Object.keys(m).length) out[`jg_rt_${id}`] = JSON.stringify(m);
  for (const [k, v] of Object.entries(c.story)) if (STORY_KEY.test(k) && !DEVICE_KEY.test(k) && typeof v === 'string') out[k] = v;
  out.jg_weapon = c.weapon;
  return out;
}
