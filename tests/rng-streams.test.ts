// design/14 階段 1.1：亂數注入與依用途拆 stream
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RNG_STREAMS, drawFloat, drawSeed, newRngState, streamRng } from '../src/core/rngStreams';
import { newGame } from '../src/core/state/gameState';
import { deserialize, serialize } from '../src/core/save/save';
import { DialogueRunner, type DialogueScript } from '../src/core/dialogue/runner';
import { rollDrops } from '../src/data/drops';
import { createBattle } from '../src/core/battle/engine';

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('RNG streams', () => {
  it('同種子同操作序列 → 完全相同', () => {
    const a = newRngState(12345);
    const b = newRngState(12345);
    const seqA = RNG_STREAMS.flatMap((s) => [drawFloat(a, s), drawSeed(a, s)]);
    const seqB = RNG_STREAMS.flatMap((s) => [drawFloat(b, s), drawSeed(b, s)]);
    expect(seqA).toEqual(seqB);
  });

  it('不同種子 → 不同結果', () => {
    expect(drawSeed(newRngState(1), 'battle')).not.toBe(drawSeed(newRngState(2), 'battle'));
  });

  it('stream 彼此獨立：多抽 ui 不影響 battle／loot', () => {
    const a = newRngState(99);
    const b = newRngState(99);
    for (let i = 0; i < 50; i++) drawFloat(b, 'ui');
    expect(drawSeed(a, 'battle')).toBe(drawSeed(b, 'battle'));
    expect(drawSeed(a, 'loot')).toBe(drawSeed(b, 'loot'));
  });

  it('數值在 [0,1) 且分布大致均勻', () => {
    const st = newRngState(7);
    const r = streamRng(st, 'loot');
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]++;
    }
    for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(200);
    expect(st.counters.loot).toBe(20000);
  });

  it('狀態存進存檔後讀回，接著抽的值一樣', () => {
    const s = newGame(0, 4242);
    drawSeed(s.rng, 'battle');
    drawSeed(s.rng, 'loot');
    const loaded = deserialize(serialize(s))!;
    expect(drawSeed(loaded.rng, 'battle')).toBe(drawSeed(s.rng, 'battle'));
    expect(drawSeed(loaded.rng, 'loot')).toBe(drawSeed(s.rng, 'loot'));
  });

  it('沒有 rng 欄位的舊存檔讀取後會補上', () => {
    const s = newGame(0) as unknown as Record<string, unknown>;
    delete s.rng;
    const loaded = deserialize(JSON.stringify(s))!;
    expect(typeof loaded.rng.seed).toBe('number');
    expect(() => drawSeed(loaded.rng, 'battle')).not.toThrow();
  });

  it('同種子 → 同一場戰鬥開局、同一份掉落', () => {
    const play = (seed: number) => {
      const st = newRngState(seed);
      const bs = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['mist_wolf', 'mist_wolf'], seed: drawSeed(st, 'battle') });
      const drops = Array.from({ length: 200 }, () => rollDrops(['mist_wolf', 'mist_wolf'], drawSeed(st, 'loot')).join(','));
      return JSON.stringify({ bs, drops });
    };
    expect(play(555)).toBe(play(555));
  });

  it('對話檢定由注入的亂數決定（可重現）', () => {
    const script: DialogueScript = {
      id: 't',
      nodes: {
        start: [{ choice: [{ text: '推', next: 'ok', fail: 'ng', check: { stat: 'str', dc: 6 } }] }],
        ok: [{ who: 'narration', text: 'ok' }],
        ng: [{ who: 'narration', text: 'ng' }],
      },
    } as unknown as DialogueScript;
    const run = (seed: number) => {
      const st = newRngState(seed);
      const out: string[] = [];
      for (let i = 0; i < 30; i++) {
        const r = new DialogueRunner(script, newGame(0), streamRng(st, 'story'));
        r.next();
        out.push(JSON.stringify(r.choose(0)));
      }
      return out.join('|');
    };
    expect(run(31)).toBe(run(31));
  });

  it('src/core 與 src/server 沒有 Math.random', () => {
    const bad = [...listTs('src/core'), ...listTs('src/server')].filter((f) => /\bMath\.random\s*\(/.test(stripComments(readFileSync(f, 'utf8'))));
    expect(bad).toEqual([]);
  });
});
