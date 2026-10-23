import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript, type DialogueStep, type ShownOption } from '../src/core/dialogue/runner';
import { check, newGame, type GameState } from '../src/core/state/gameState';
import { CH4, CH4_ENTRIES } from '../src/data/dialogue/ch4';
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
  const r = new DialogueRunner({ ...CH4, start: node }, state, rng);
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

/** 第 3 章通關後的狀態（內應路線、洛克倒戈）。 */
function afterCh3(): GameState {
  const s = newGame(0);
  for (const f of ['ch1_complete', 'ch2_complete', 'ch3_complete', 'io_taken', 'double_agent', 'rourke_turned'])
    s.flags[f] = true;
  s.party = ['lian', 'serin', 'liora', 'rourke'];
  for (const id of ['lian', 'io', 'serin', 'liora', 'rourke'] as const)
    s.members[id] = { id, level: 13, xp: 0, hp: -1, equipment: {} };
  s.affinity = { serin: 45, liora: 40, io: 40, rourke: 40 };
  s.divergence = 30;
  s.codex = ['star_core_furnace', 'valderan'];
  return s;
}

/** 揭發路線、洛克離開。 */
function exposedLost(): GameState {
  const s = afterCh3();
  delete s.flags.double_agent;
  delete s.flags.rourke_turned;
  s.flags.exposed_valderan = true;
  s.flags.rourke_lost = true;
  s.party = ['lian', 'serin', 'liora'];
  return s;
}

function playAll(s: GameState, pick: Picker, rng: () => number = () => 0, outcome: Outcomer = allWin): RunResult[] {
  const out: RunResult[] = [];
  for (const e of CH4_ENTRIES) {
    if (e.requires) expect(check(s, e.requires), `${e.node} locked`).toBe(true);
    out.push(runEntry(s, e.node, pick, rng, outcome));
  }
  return out;
}

const IO_EXTRA = '你改寫的每一件事';

describe('ch4 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH4)) expect(CH4.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH4.id).toBe('ch4');
    expect(CH4.start).toBe('infiltrate');
  });

  it('every speaker is a known speaker', () => {
    for (const lines of Object.values(CH4.nodes))
      for (const l of lines) if ('say' in l) expect(SPEAKER_NAMES, `unknown speaker ${l.say}`).toHaveProperty(l.say);
  });

  it('every entry node exists and starts with a revisit guard', () => {
    expect(CH4_ENTRIES.map((e) => e.location)).toEqual([
      'academy_entrance',
      'archive',
      'holding_cells',
      'lab',
      'hidden_camp',
      'star_furnace',
    ]);
    for (const e of CH4_ENTRIES) {
      expect(CH4.nodes, `missing entry node ${e.node}`).toHaveProperty(e.node);
      const head = CH4.nodes[e.node]![0]!;
      expect('goto' in head && head.if, `${e.node} lacks revisit guard`).toBeTruthy();
    }
    expect(CH4_ENTRIES[0]!.requires).toEqual({ flag: 'ch3_complete' });
  });

  it('only uses allowed battle ids and only the ch5 chapter card', () => {
    const allowed = ['ch4_gate', 'ch4_lab_a', 'ch4_lab_b', 'boss_valderan'];
    for (const lines of Object.values(CH4.nodes))
      for (const l of lines) {
        if ('event' in l && l.event === 'battle') expect(allowed).toContain(l.id);
        if ('event' in l && l.event === 'chapterCard') expect(l.id).toBe('ch5');
      }
  });

  it('entries are locked on a new game', () => {
    const s = newGame(0);
    for (const e of CH4_ENTRIES) expect(check(s, e.requires!), e.node).toBe(false);
  });

  it('full playthrough (double agent, rourke turned) completes and rescues Io', () => {
    const s = afterCh3();
    const runs = playAll(s, first);
    const events = runs.flatMap((r) => r.events);
    expect(events).not.toContainEqual({ event: 'battle', id: 'ch4_gate' });
    expect(events).toContainEqual({ event: 'battle', id: 'ch4_lab_a' });
    expect(events).toContainEqual({ event: 'battle', id: 'ch4_lab_b' });
    expect(events).toContainEqual({ event: 'battle', id: 'boss_valderan' });
    expect(events).toContainEqual({ event: 'summary', id: 'ch4' });
    expect(runs.at(-1)!.events.at(-1)).toEqual({ event: 'chapterCard', id: 'ch5' });
    expect(s.flags.ch4_quiet_entry).toBe(true);
    expect(s.flags.research_destroyed).toBe(true);
    expect(s.flags.bond_liora_3).toBe(true);
    expect(s.flags.tia_rescued).toBe(true);
    expect(s.affinity.rourke).toBe(50);
    expect(s.flags.bond_serin_3).toBe(true);
    expect(s.flags.rourke_campfire).toBe(true);
    expect(s.flags.io_rescued).toBe(true);
    expect(s.affinity.io).toBe(50);
    expect(s.party).toContain('io');
    expect(s.flags.took_core).toBe(true);
    expect(s.reputation.order).toBe(10);
    expect(s.flags.rift_open).toBe(true);
    expect(s.flags.ch4_complete).toBe(true);
    expect(s.quests.ch4_core).toEqual({ stage: 5, done: true });
  });

  it('exposed + rourke lost: frontal breach via ch4_gate, still completes', () => {
    const s = exposedLost();
    const runs = playAll(s, () => 1);
    const events = runs.flatMap((r) => r.events);
    expect(events[0]).toEqual({ event: 'battle', id: 'ch4_gate' });
    expect(s.flags.ch4_gate_breached).toBe(true);
    expect(s.flags.research_kept).toBe(true);
    expect(s.flags.tia_rescued).toBe(true);
    expect(s.flags.core_sealed).toBe(true);
    expect(s.flags.rourke_campfire).toBeUndefined();
    expect(s.party).toContain('io');
    expect(s.party).not.toContain('rourke');
    expect(s.flags.ch4_complete).toBe(true);
  });

  it('lab: burnt codex option is hidden; stats are required', () => {
    const s = afterCh3();
    for (const e of CH4_ENTRIES.slice(0, 3)) runEntry(s, e.node);
    const r = runEntry(s, 'lab');
    expect(r.options[0]!.some((t) => t.includes('[筆記]'))).toBe(false);
    expect(r.options[0]!.some((t) => t.includes('[智 7]'))).toBe(true);
    expect(r.options[0]!.some((t) => t.includes('[力 6]'))).toBe(true);
    expect(s.flags.lab_hacked).toBe(true);
    expect(s.flags.ch4_lab_done).toBe(true);
  });

  it('lab: failing both checks hides them and falls back to the fight', () => {
    const s = afterCh3();
    for (const e of CH4_ENTRIES.slice(0, 3)) runEntry(s, e.node);
    const r = runEntry(s, 'lab', first, () => 0.999);
    expect(s.flags.lab_int_failed).toBe(true);
    expect(s.flags.lab_str_failed).toBe(true);
    expect(r.options.at(-1)).toHaveLength(1);
    expect(s.flags.ch4_lab_done).toBe(true);
  });

  it('divergence ≥ 60 shows the extra Io line', () => {
    const play = (div: number) => {
      const s = afterCh3();
      s.divergence = div;
      const runs = playAll(s, first);
      return runs.at(-1)!;
    };
    const low = play(0);
    const high = play(60);
    expect(low.texts.some((t) => t.includes(IO_EXTRA))).toBe(false);
    expect(high.texts.some((t) => t.includes(IO_EXTRA))).toBe(true);
    expect(high.speakers.filter((x) => x === 'io').length).toBe(low.speakers.filter((x) => x === 'io').length + 1);
  });

  it('losing battles retries the same battle', () => {
    const s = exposedLost();
    const seen = new Set<string>();
    const loseOnce: Outcomer = (ev, id) => {
      if (ev === 'battle' && !seen.has(id)) {
        seen.add(id);
        return 'lose';
      }
      return allWin(ev, id, 0);
    };
    const runs = playAll(s, first, () => 0, loseOnce);
    const battles = runs.flatMap((r) => r.events).filter((e) => e.event === 'battle').map((e) => e.id);
    expect(battles).toEqual(['ch4_gate', 'ch4_gate', 'ch4_lab_a', 'ch4_lab_a', 'ch4_lab_b', 'ch4_lab_b', 'boss_valderan', 'boss_valderan']);
    expect(s.flags.ch4_complete).toBe(true);
  });

  it('every branch terminates across picks and rolls', () => {
    for (let pick = 0; pick < 4; pick++) {
      for (const rng of [() => 0, () => 0.999]) {
        for (const mk of [afterCh3, exposedLost]) {
          const s = mk();
          for (const e of CH4_ENTRIES) runEntry(s, e.node, () => pick, rng);
          expect(s.flags.ch4_complete, `pick ${pick}`).toBe(true);
          expect(s.party).toContain('io');
        }
      }
    }
  });

  it('revisits are short and do not re-grant rewards', () => {
    const s = afterCh3();
    playAll(s, first);
    const aff = { ...s.affinity };
    for (const e of CH4_ENTRIES) {
      const r = runEntry(s, e.node);
      expect(r.speakers.length, e.node).toBeLessThanOrEqual(2);
      expect(r.events).toEqual([]);
    }
    expect(s.affinity).toEqual(aff);
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH4.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});
