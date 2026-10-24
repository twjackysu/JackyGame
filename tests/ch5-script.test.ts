import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript, type DialogueStep, type ShownOption } from '../src/core/dialogue/runner';
import { check, newGame, type GameState } from '../src/core/state/gameState';
import { CH5, CH5_ENTRIES } from '../src/data/dialogue/ch5';
import { SPEAKER_NAMES } from '../src/data/dialogue/speakers';

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

type Picker = (node: string, options: ShownOption[]) => number;
type Outcomer = (event: string, id: string, nth: number) => string;

interface RunResult {
  speakers: string[];
  texts: string[];
  events: { event: string; id: string }[];
  options: string[][];
}

const first: Picker = () => 0;
const allWin: Outcomer = (ev) => (ev === 'battle' || ev === 'cards' ? 'win' : 'done');

function runEntry(
  state: GameState,
  node: string,
  pick: Picker = first,
  rng: () => number = () => 0,
  outcome: Outcomer = allWin,
): RunResult {
  const r = new DialogueRunner({ ...CH5, start: node }, state, rng);
  const res: RunResult = { speakers: [], texts: [], events: [], options: [] };
  for (let i = 0; i < 1000; i++) {
    const step: DialogueStep = r.next();
    if (step.kind === 'end') return res;
    if (step.kind === 'say') {
      res.speakers.push(step.speaker);
      res.texts.push(step.text);
    } else if (step.kind === 'choice') {
      expect(step.options.length, `empty choice in ${r.currentNode}`).toBeGreaterThan(0);
      res.options.push(step.options.map((o) => o.text));
      r.choose(Math.min(pick(r.currentNode, step.options), step.options.length - 1));
    } else if (step.kind === 'event') {
      res.events.push({ event: step.event, id: step.id });
      r.resume(outcome(step.event, step.id, res.events.length));
    }
  }
  throw new Error(`entry ${node} did not end within 1000 steps`);
}


/** 第 4 章通關後的狀態（洛克倒戈）。 */
function afterCh4(): GameState {
  const s = newGame(0);
  for (const f of ['ch1_complete', 'ch2_complete', 'ch3_complete', 'ch4_complete', 'io_rescued', 'rourke_turned', 'tia_rescued'])
    s.flags[f] = true;
  s.party = ['lian', 'serin', 'liora', 'io', 'rourke'];
  for (const id of ['lian', 'io', 'serin', 'liora', 'rourke'] as const)
    s.members[id] = { id, level: 16, xp: 0, hp: -1, equipment: {} };
  s.affinity = { serin: 55, liora: 50, io: 50, rourke: 50 };
  return s;
}

function play(s: GameState, pick: Picker = first, outcome: Outcomer = allWin): RunResult[] {
  const out: RunResult[] = [];
  for (const e of CH5_ENTRIES) {
    if (e.requires) expect(check(s, e.requires), `${e.node} locked`).toBe(true);
    out.push(runEntry(s, e.node, pick, () => 0, outcome));
  }
  return out;
}

function expectClear(s: GameState, runs: RunResult[]): void {
  const events = runs.flatMap((r) => r.events);
  expect(events).toContainEqual({ event: 'battle', id: 'ch5_rift' });
  expect(events).toContainEqual({ event: 'battle', id: 'boss_starfall' });
  expect(events).toContainEqual({ event: 'summary', id: 'ch5' });
  expect(runs.at(-1)!.events.at(-1)).toEqual({ event: 'chapterCard', id: 'fin' });
  expect(s.flags.game_clear).toBe(true);
  expect(s.flags.ch5_complete).toBe(true);
  expect(s.quests.ch5_light?.done).toBe(true);
}

describe('ch5 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH5)) expect(CH5.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH5.id).toBe('ch5');
    expect(CH5.start).toBe('descent');
  });

  it('every speaker is a known speaker', () => {
    for (const lines of Object.values(CH5.nodes))
      for (const l of lines) if ('say' in l) expect(SPEAKER_NAMES, `unknown speaker ${l.say}`).toHaveProperty(l.say);
  });

  it('every entry node exists and starts with a revisit guard', () => {
    expect(CH5_ENTRIES.map((e) => e.location)).toEqual(['rift_edge', 'last_campfire', 'rift_core']);
    for (const e of CH5_ENTRIES) {
      expect(CH5.nodes, `missing entry node ${e.node}`).toHaveProperty(e.node);
      const head = CH5.nodes[e.node]![0]!;
      expect('goto' in head && head.if, `${e.node} lacks revisit guard`).toBeTruthy();
    }
    expect(CH5_ENTRIES[0]!.requires).toEqual({ flag: 'ch4_complete' });
  });

  it('only uses allowed battle ids and only the fin chapter card', () => {
    for (const lines of Object.values(CH5.nodes))
      for (const l of lines) {
        if ('event' in l && l.event === 'battle') expect(['ch5_rift', 'boss_starfall', 'boss_starfall_2']).toContain(l.id);
        if ('event' in l && l.event === 'chapterCard') expect(l.id).toBe('fin');
      }
  });

  it('entries are locked on a new game', () => {
    const s = newGame(0);
    for (const e of CH5_ENTRIES) expect(check(s, e.requires!), e.node).toBe(false);
  });

  it('ending: 燈火長明', () => {
    const s = afterCh4();
    s.divergence = 70;
    s.affinity.io = 70;
    s.party = ['lian', 'serin', 'liora', 'io'];
    s.flags.took_core = true;
    s.flags.research_kept = true;
    s.reputation.order = 40;
    const runs = play(s);
    expectClear(s, runs);
    expect(s.flags.ending).toBe('light');
    expect(s.flags.vow_serin).toBe(true);
    expect(s.affinity.serin).toBe(65);
  });

  it('ending: 新的大司星 (rourke card granted)', () => {
    const s = afterCh4();
    s.flags.research_kept = true;
    s.flags.took_core = true;
    s.reputation.order = 40;
    s.divergence = 10;
    const runs = play(s, () => 2);
    expectClear(s, runs);
    expect(s.flags.ending).toBe('crown');
    expect(s.flags.vow_io).toBe(true);
    expect(s.affinity.io).toBe(60);
    expect(s.cards.c_veteran).toBe(1);
    expect(s.flags.rourke_card).toBe(true);
  });

  it('ending: 餘燼之夢 by default', () => {
    const s = afterCh4();
    const runs = play(s, () => 3);
    expectClear(s, runs);
    expect(s.flags.ending).toBe('dream');
    expect(s.flags.vow_all).toBe(true);
  });

  it('rourke lost: he holds the pass (rourke_sacrifice) and gets a memorial', () => {
    const s = afterCh4();
    delete s.flags.rourke_turned;
    s.flags.rourke_lost = true;
    s.party = ['lian', 'serin', 'liora', 'io'];
    const runs = play(s);
    expect(s.flags.rourke_sacrifice).toBe(true);
    expect(runs[0]!.speakers).toContain('rourke');
    expect(runs[1]!.speakers).not.toContain('rourke');
    expect(runs.at(-1)!.texts.some((t) => t.includes('沒人喝的酒'))).toBe(true);
    expect(s.cards.c_veteran).toBeUndefined();
    expectClear(s, runs);
  });

  it('vow options are hidden below affinity 50', () => {
    const s = afterCh4();
    s.affinity = { serin: 49, liora: 40, io: 49, rourke: 50 };
    runEntry(s, 'descent');
    const r = runEntry(s, 'vow');
    expect(r.options[0]).toEqual(['「和大家一起看星星。」']);
    const s2 = afterCh4();
    runEntry(s2, 'descent');
    expect(runEntry(s2, 'vow').options[0]).toHaveLength(4);
  });

  it('losing battles retries the same battle', () => {
    const s = afterCh4();
    const seen = new Set<string>();
    const loseOnce: Outcomer = (ev, id) => {
      if (ev === 'battle' && !seen.has(id)) {
        seen.add(id);
        return 'lose';
      }
      return allWin(ev, id, 0);
    };
    const runs = play(s, first, loseOnce);
    const battles = runs.flatMap((r) => r.events).filter((e) => e.event === 'battle').map((e) => e.id);
    expect(battles).toEqual(['ch5_rift', 'ch5_rift', 'boss_starfall', 'boss_starfall', 'boss_starfall_2', 'boss_starfall_2']);
    expect(s.flags.game_clear).toBe(true);
  });

  it('every branch terminates across picks', () => {
    for (let pick = 0; pick < 5; pick++) {
      const s = afterCh4();
      play(s, () => pick);
      expect(s.flags.game_clear, `pick ${pick}`).toBe(true);
    }
  });

  it('revisits are short and do not re-grant rewards', () => {
    const s = afterCh4();
    play(s);
    const aff = { ...s.affinity };
    const cards = { ...s.cards };
    for (const e of CH5_ENTRIES) {
      const r = runEntry(s, e.node);
      expect(r.speakers.length, e.node).toBeLessThanOrEqual(2);
      expect(r.events).toEqual([]);
    }
    expect(s.affinity).toEqual(aff);
    expect(s.cards).toEqual(cards);
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH5.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});
