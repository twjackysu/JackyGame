import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript, type DialogueStep } from '../src/core/dialogue/runner';
import { check, newGame, type GameState } from '../src/core/state/gameState';
import { CH2, CH2_ENTRIES } from '../src/data/dialogue/ch2';
import { SPEAKER_NAMES } from '../src/data/dialogue/speakers';
import { ENCOUNTERS } from '../src/data/combatants';
import { simulateBattle } from '../src/core/battle/sim';

function targets(script: DialogueScript): string[] {
  const out: string[] = [];
  for (const lines of Object.values(script.nodes)) {
    for (const line of lines) {
      if ('goto' in line) out.push(line.goto);
      if ('choice' in line) for (const o of line.choice) out.push(o.next, ...(o.fail ? [o.fail] : []));
      if ('event' in line && line.outcomes) out.push(...Object.values(line.outcomes));
    }
  }
  return out;
}

type Picker = (node: string, optionCount: number) => number;

interface RunResult {
  speakers: string[];
  events: { event: string; id: string }[];
}

function runEntry(
  state: GameState,
  node: string,
  pick: Picker = () => 0,
  rng: () => number = () => 0,
  outcome: 'win' | 'loseFirst' = 'win',
): RunResult {
  const r = new DialogueRunner({ ...CH2, start: node }, state, rng);
  const res: RunResult = { speakers: [], events: [] };
  for (let i = 0; i < 1000; i++) {
    const step: DialogueStep = r.next();
    if (step.kind === 'end') return res;
    if (step.kind === 'say') res.speakers.push(step.speaker);
    else if (step.kind === 'choice') {
      expect(step.options.length, `empty choice in ${r.currentNode}`).toBeGreaterThan(0);
      r.choose(Math.min(pick(r.currentNode, step.options.length), step.options.length - 1));
    } else if (step.kind === 'event') {
      res.events.push({ event: step.event, id: step.id });
      r.resume(outcome === 'loseFirst' && res.events.length === 1 ? 'lose' : 'win');
    }
  }
  throw new Error(`entry ${node} did not end within 1000 steps`);
}

/** 第 1 章通關後的狀態（連恩＋伊歐）。 */
function afterCh1(): GameState {
  const s = newGame(0);
  s.flags.ch1_complete = true;
  s.flags.serin_met = true;
  s.party = ['lian', 'io'];
  s.members.lian!.level = 5;
  s.members.io = { id: 'io', level: 5, xp: 0, hp: -1, equipment: {} };
  return s;
}

function playAll(s: GameState, pick: Picker, rng: () => number = () => 0): RunResult[] {
  const out: RunResult[] = [];
  for (const e of CH2_ENTRIES) {
    if (e.requires) expect(check(s, e.requires), `${e.node} locked`).toBe(true);
    out.push(runEntry(s, e.node, pick, rng));
  }
  return out;
}

describe('ch2 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH2)) expect(CH2.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH2.nodes).toHaveProperty(CH2.start ?? 'start');
  });

  it('every entry node exists and locations are unique ascii ids', () => {
    const locs = new Set<string>();
    for (const e of CH2_ENTRIES) {
      expect(CH2.nodes, `missing entry node ${e.node}`).toHaveProperty(e.node);
      expect(e.location).toMatch(/^[a-z_]+$/);
      expect(e.title.length).toBeGreaterThan(0);
      locs.add(e.location);
    }
    expect(locs.size).toBe(CH2_ENTRIES.length);
    expect(CH2_ENTRIES[0]!.requires).toEqual({ flag: 'ch1_complete' });
  });

  it('battle events use known encounters', () => {
    for (const lines of Object.values(CH2.nodes))
      for (const l of lines)
        if ('event' in l && l.event === 'battle') expect(ENCOUNTERS, l.id).toHaveProperty(l.id);
  });

  it('entries are locked on a new game (gated after ch1)', () => {
    const s = newGame(0);
    for (const e of CH2_ENTRIES) expect(check(s, e.requires!), e.node).toBe(false);
  });

  it('plays all entries in story order (first option, wins): Serin stays', () => {
    const s = afterCh1();
    const runs = playAll(s, () => 0);
    const speakers = runs.flatMap((r) => r.speakers);
    const events = runs.flatMap((r) => r.events);
    for (const sp of speakers) expect(SPEAKER_NAMES, `unknown speaker ${sp}`).toHaveProperty(sp);
    expect(events).toContainEqual({ event: 'cards', id: 'liora_intro' });
    expect(events).toContainEqual({ event: 'battle', id: 'boss_bellworm' });
    expect(events).toContainEqual({ event: 'summary', id: 'ch2' });
    expect(runs.at(-1)!.events.at(-1)).toEqual({ event: 'chapterCard', id: 'ch3' });
    expect(s.flags.ch2_complete).toBe(true);
    expect(s.flags.serin_told_future).toBe(true);
    expect(s.flags.serin_solo).toBeUndefined();
    expect(s.flags.bond_serin_1).toBe(true);
    expect(s.flags.bond_liora_1).toBe(true);
    expect(s.flags.liora_fuse_saved).toBe(true);
    expect(s.flags.academy_mark).toBe(true);
    expect(s.affinity.serin).toBeGreaterThanOrEqual(30);
    expect(s.flags.serin_stayed).toBe(true);
    expect(s.party).toEqual(['lian', 'io', 'serin', 'liora']);
    expect(s.reputation.miners).toBe(15);
    expect(s.reputation.order).toBe(-10);
    expect(s.inventory.blast_bottle).toBe(2);
    expect(s.codex).toContain('boss_bellworm');
  });

  it('silence → solo charge: 3 chained battles, Serin saved, low affinity → she leaves', () => {
    const s = afterCh1();
    const runs = playAll(s, (_n, count) => count - 1);
    const deep = runs[CH2_ENTRIES.findIndex((e) => e.node === 'deep_level')]!;
    expect(deep.events).toEqual([
      { event: 'battle', id: 'deep_1' },
      { event: 'battle', id: 'deep_2' },
      { event: 'battle', id: 'deep_3' },
    ]);
    expect(s.flags.serin_solo).toBe(true);
    expect(s.flags.serin_saved).toBe(true);
    expect(s.flags.serin_scar).toBeUndefined();
    expect(s.flags.ch2_compromise).toBe(true);
    expect(s.affinity.serin).toBeLessThan(30);
    expect(s.flags.serin_left_ch2).toBe(true);
    expect(s.party).not.toContain('serin');
    expect(s.party).toContain('liora');
    expect(s.flags.ch2_complete).toBe(true);
  });

  it('failed [魅 7] warning triggers the solo charge; losing a chase battle leaves a scar', () => {
    const s = afterCh1();
    for (const e of CH2_ENTRIES) {
      const pick: Picker = (node) => (node === 'hall_won' ? 1 : 0);
      const outcome = e.node === 'deep_level' ? 'loseFirst' : 'win';
      runEntry(s, e.node, pick, () => 0.999, outcome);
    }
    expect(s.flags.serin_warned).toBeUndefined();
    expect(s.flags.serin_solo).toBe(true);
    expect(s.flags.serin_scar).toBe(true);
    expect(s.flags.serin_saved).toBeUndefined();
    expect(s.affinity.serin).toBe(25); // 5 + 10 + 5 + 5 → 未達 30，暫時離隊
    expect(s.flags.serin_left_ch2).toBe(true);
    expect(s.flags.ch2_complete).toBe(true);
  });

  it('every branch terminates (all picks, pass/fail rolls, win/lose), and can be revisited', () => {
    for (let pick = 0; pick < 4; pick++) {
      for (const rng of [() => 0, () => 0.999]) {
        const s = afterCh1();
        for (let pass = 0; pass < 6 && !s.flags.ch2_complete; pass++) {
          for (const e of CH2_ENTRIES) {
            if (e.requires && !check(s, e.requires)) continue;
            runEntry(s, e.node, () => pick, rng, 'loseFirst');
            runEntry(s, e.node, () => pick, rng, 'win');
          }
        }
        expect(s.flags.ch2_complete, `pick ${pick}`).toBe(true);
      }
    }
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH2.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});

describe('ch2 balance sim (boss_bellworm, Lv8–9 lian/serin/liora)', () => {
  const decent = { attack: { perfect: 0.5, good: 0.35 }, defense: 0.65 };
  const rate = (lv: number) => {
    const party = (['lian', 'serin', 'liora'] as const).map((id) => ({ id, level: lv }));
    const N = 150;
    let w = 0;
    let maxRounds = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateBattle(party, 'boss_bellworm', decent, 2000 + i);
      if (r.won) w++;
      maxRounds = Math.max(maxRounds, r.rounds);
    }
    expect(maxRounds).toBeLessThanOrEqual(40);
    return w / N;
  };
  it('decent player wins most of the time', () => {
    const r8 = rate(8);
    const r9 = rate(9);
    console.log(`[sim] bellworm decent Lv8 ${(r8 * 100).toFixed(0)}% Lv9 ${(r9 * 100).toFixed(0)}%`);
    expect(r8).toBeGreaterThanOrEqual(0.6);
    expect(r9).toBeGreaterThanOrEqual(r8 - 0.05);
  }, 60_000);
});
