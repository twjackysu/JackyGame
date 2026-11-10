// D-344：自動施放的預設改了（大招也自動）——存的是舊版預設的裝置要換成新預設；玩家在新版自己改的要留著。
import { describe, expect, it, vi } from 'vitest';

async function load(stored: unknown) {
  vi.resetModules();
  const mem: Record<string, string> = stored === undefined ? {} : { 'jackygame.settings': JSON.stringify(stored) };
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) });
  const m = await import('../src/game/settings');
  return { ...m, mem };
}

describe('自動施放設定的版本', () => {
  it('沒存過、或存的是第一版預設（只有兩欄）→ 新預設（兩個輸出技＋大招）', async () => {
    for (const stored of [undefined, { volume: 0.5 }, { autoSkills: ['heavy_slash', 'whirlwind'] }, { autoSkills: [] }]) {
      const { getSettings } = await load(stored);
      expect([...getSettings().autoSkills].sort()).toEqual(['blade_storm', 'heavy_slash', 'whirlwind']);
    }
  });

  it('新版裡自己改過的（含全部關掉）照舊留著，其他設定不受影響', async () => {
    const a = await load({ autoSkills: [], autoVer: 2, volume: 0.5 });
    expect(a.getSettings().autoSkills).toEqual([]);
    expect(a.getSettings().volume).toBe(0.5);
    const b = await load({ autoSkills: ['heavy_slash', 'whirlwind'] });
    b.updateSettings({ autoSkills: ['charge'] });
    expect(JSON.parse(b.mem['jackygame.settings']!)).toMatchObject({ autoSkills: ['charge'], autoVer: 2 });
    const c = await load(JSON.parse(b.mem['jackygame.settings']!));
    expect(c.getSettings().autoSkills).toEqual(['charge']);
  });
});
