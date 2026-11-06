// 舊存檔轉換和遊戲現在讀存檔的方式一致（src/game/rtRecord.ts）：等級、材料、行囊、地圖欄位一樣。
import { describe, expect, it } from 'vitest';
import { cleanBag, loadRecord, MAP_KEYS, sanitizeRecord, walletOf } from '../../src/game/rtRecord';
import { LEGACY_HOME, LEGACY_MAP_KEYS, fromLegacy, isLegacyEmpty } from '../../src/server/legacy';
import { WORLD_MAPS } from '../../src/game/worldMaps';
import { LEGACY_SAMPLE } from './fixtures';
import { MapStorage } from './backends';

describe('舊存檔轉換（server/legacy）', () => {
  it('欄位清單和 rtRecord 一致', () => {
    expect([...LEGACY_MAP_KEYS]).toEqual([...MAP_KEYS]);
    expect(LEGACY_HOME).toBe(WORLD_MAPS[0]!.id);
  });

  it('和遊戲現在讀到的數值一樣', () => {
    const g = globalThis as { localStorage?: unknown };
    const prev = g.localStorage;
    const st = new MapStorage();
    for (const [k, v] of Object.entries(LEGACY_SAMPLE)) st.setItem(k, v);
    g.localStorage = st;
    try {
      const L = fromLegacy(LEGACY_SAMPLE);
      for (const m of WORLD_MAPS) {
        const rec = loadRecord(m.id);
        const own = sanitizeRecord(JSON.parse(LEGACY_SAMPLE[`jg_rt_${m.id}`]?.startsWith('{') ? LEGACY_SAMPLE[`jg_rt_${m.id}`]! : '{}'));
        expect(rec.level ?? 1).toBe(L.level);
        expect(rec.xp ?? 0).toBe(L.xp);
        expect(walletOf(rec)).toEqual({ dust: L.wallet.dust, crystal: L.wallet.crystal });
        const bag = cleanBag(rec);
        expect(bag.bag).toEqual(L.bag);
        expect(bag.equip).toEqual(L.equip);
        for (const k of MAP_KEYS) expect(L.maps[m.id]?.[k]).toEqual(own[k]);
      }
      expect(L.wallet.coin).toBe(800);
      expect(Object.keys(L.story).sort()).toEqual(['jg_choices', 'jg_memories', 'jg_prologue_seen']);
    } finally {
      g.localStorage = prev;
    }
  });

  it('空存檔＝Lv1 新角色', () => {
    expect(isLegacyEmpty({ 'jackygame.settings': '{}' })).toBe(true);
    expect(fromLegacy({})).toMatchObject({ weapon: 'sword', level: 1, xp: 0, bag: [], wallet: { coin: 0, dust: 0, crystal: 0 }, maps: {} });
  });
});
