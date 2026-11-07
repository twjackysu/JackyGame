// 精英倒下演出搬成資料表（第 151 輪 Q5）：跟搬之前場景裡寫死的呼叫一模一樣（數字照舊程式抄）
import { describe, expect, it, vi } from 'vitest';

const calls: unknown[][] = [];
vi.mock('../src/game/fx/feel', () => ({
  shockRing: (_s: unknown, ...a: unknown[]) => calls.push(['ring', ...a]),
  sparks: (_s: unknown, ...a: unknown[]) => calls.push(['sparks', ...a]),
  bigText: (_s: unknown, ...a: unknown[]) => calls.push(['text', ...a]),
}));
vi.mock('../src/game/config', () => ({ GAME_WIDTH: 720 }));

const scene = { cameras: { main: { shake: (...a: unknown[]) => calls.push(['shake', ...a]) } } };

describe('eliteFall', async () => {
  const { eliteFall } = await import('../src/game/fx/eliteFall');
  const run = (id: string, name = 'N') => {
    calls.length = 0;
    const ok = eliteFall(scene as never, id, 10, 20, name);
    return { ok, calls: [...calls] };
  };
  it('跟舊程式一樣', () => {
    expect(run('thorn_mother').calls).toEqual([['shake', 220, 0.007], ['ring', 10, 20, 0x6aff7a, 220, 560, 10], ['sparks', 10, 20, 26, 'ember', 0x9aff7a, 700], ['text', 360, 470, '荊棘母樹 倒下了！', '#9aff8a', 46, 900]]);
    expect(run('thorn_stalker').calls).toEqual([['shake', 180, 0.006], ['ring', 10, 20, 0xff8a5c, 180, 480, 8], ['sparks', 10, 20, 22, 'ember', 0xffa07a, 600], ['text', 360, 470, '荊棘巡獵者 倒下了！', '#ffb07a', 44, 900]]);
    for (const id of ['magma_stalker', 'obsidian_alpha'])
      expect(run(id, '熔').calls).toEqual([['shake', 180, 0.006], ['ring', 10, 20, 0xff6a2a, 190, 500, 9], ['sparks', 10, 20, 24, 'ember', 0xffa050, 640], ['text', 360, 470, '熔 倒下了！', '#ffa868', 44, 900]]);
    for (const id of ['comet_stalker', 'astral_alpha', 'eclipse_wolf'])
      expect(run(id, '星').calls).toEqual([['shake', 180, 0.006], ['ring', 10, 20, 0x8aa8ff, 190, 500, 9], ['ring', 10, 20, 0xffffff, 110, 300, 4], ['sparks', 10, 20, 24, 'spark', 0xc8d8ff, 640], ['text', 360, 470, '星 倒下了！', '#c8d8ff', 44, 900]]);
    expect(run('mist_warden').calls).toEqual([['shake', 160, 0.005], ['ring', 10, 20, 0x6ae8d0, 180, 480, 8], ['sparks', 10, 20, 22, 'ember', 0xbaf8ee, 620], ['text', 360, 470, '迷霧巡守 倒下了！', '#9af0e0', 44, 900]]);
  });
  it('其他怪沒有演出', () => {
    expect(run('mist_wolf')).toEqual({ ok: false, calls: [] });
  });
});
