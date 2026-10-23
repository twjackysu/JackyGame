import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript, type DialogueStep, type ShownOption } from '../src/core/dialogue/runner';
import { check, newGame, type GameState } from '../src/core/state/gameState';
import { CH3, CH3_ENTRIES } from '../src/data/dialogue/ch3';
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

/** 回傳要選的選項 index（超出範圍會被夾到最後一個）。 */
type Picker = (node: string, options: ShownOption[]) => number;
/** 回傳事件結果（預設 win；codexBurn 等無 outcomes 的事件回 'done'）。 */
type Outcomer = (event: string, id: string, nth: number) => string;

interface RunResult {
  speakers: string[];
  events: { event: string; id: string }[];
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
  const r = new DialogueRunner({ ...CH3, start: node }, state, rng);
  const res: RunResult = { speakers: [], events: [] };
  for (let i = 0; i < 1000; i++) {
    const step: DialogueStep = r.next();
    if (step.kind === 'end') return res;
    if (step.kind === 'say') res.speakers.push(step.speaker);
    else if (step.kind === 'choice') {
      expect(step.options.length, `empty choice in ${r.currentNode}`).toBeGreaterThan(0);
      r.choose(Math.min(pick(r.currentNode, step.options), step.options.length - 1));
    } else if (step.kind === 'event') {
      res.events.push({ event: step.event, id: step.id });
      r.resume(outcome(step.event, step.id, res.events.length));
    }
  }
  throw new Error(`entry ${node} did not end within 1000 steps`);
}

/** 第 2 章通關後的狀態（瑟琳留隊）。 */
function afterCh2(): GameState {
  const s = newGame(0);
  s.flags.ch1_complete = true;
  s.flags.ch2_complete = true;
  s.flags.serin_stayed = true;
  s.flags.academy_mark = true;
  s.party = ['lian', 'io', 'serin', 'liora'];
  s.gold = 200;
  for (const id of ['lian', 'io', 'serin', 'liora'] as const)
    s.members[id] = { id, level: 9, xp: 0, hp: -1, equipment: {} };
  s.affinity = { serin: 35, liora: 25, io: 30, rourke: 15 };
  return s;
}

function playAll(s: GameState, pick: Picker, rng: () => number = () => 0, outcome: Outcomer = allWin): RunResult[] {
  const out: RunResult[] = [];
  for (const e of CH3_ENTRIES) {
    if (e.requires) expect(check(s, e.requires), `${e.node} locked`).toBe(true);
    out.push(runEntry(s, e.node, pick, rng, outcome));
  }
  return out;
}

const byText =
  (node: string, includes: string): Picker =>
  (n, opts) => {
    if (n !== node) return 0;
    const i = opts.findIndex((o) => o.text.includes(includes));
    expect(i, `option "${includes}" not shown in ${node}`).toBeGreaterThanOrEqual(0);
    return i;
  };

describe('ch3 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH3)) expect(CH3.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH3.id).toBe('ch3');
    expect(CH3.start).toBe('gate');
    expect(CH3.nodes).toHaveProperty('gate');
  });

  it('every speaker is a known speaker', () => {
    for (const lines of Object.values(CH3.nodes))
      for (const l of lines) if ('say' in l) expect(SPEAKER_NAMES, `unknown speaker ${l.say}`).toHaveProperty(l.say);
  });

  it('every entry node exists and locations are unique ascii ids', () => {
    const locs = new Set<string>();
    for (const e of CH3_ENTRIES) {
      expect(CH3.nodes, `missing entry node ${e.node}`).toHaveProperty(e.node);
      expect(e.location).toMatch(/^[a-z_]+$/);
      expect(e.title.length).toBeGreaterThan(0);
      locs.add(e.location);
      // 每個入口節點都以「重訪」守門開始
      const head = CH3.nodes[e.node]![0]!;
      expect('goto' in head && head.if, `${e.node} lacks revisit guard`).toBeTruthy();
    }
    expect(locs.size).toBe(CH3_ENTRIES.length);
    expect(CH3_ENTRIES.map((e) => e.location)).toEqual([
      'capital_gate',
      'crown_plaza',
      'rourke_lodging',
      'tourney_hall',
      'night_market',
      'academy',
      'inn_night',
      'rooftop',
      'crown_plaza_dawn',
    ]);
    expect(CH3_ENTRIES[0]!.requires).toEqual({ flag: 'ch2_complete' });
  });

  it('does not repeat the ch3 chapter card (ch2 already shows it)', () => {
    for (const lines of Object.values(CH3.nodes))
      for (const l of lines) if ('event' in l && l.event === 'chapterCard') expect(l.id).toBe('ch4');
  });

  it('entries are locked on a new game (gated after ch2)', () => {
    const s = newGame(0);
    for (const e of CH3_ENTRIES) expect(check(s, e.requires!), e.node).toBe(false);
  });

  it('plays all entries in story order (first option, wins): champion route', () => {
    const s = afterCh2();
    const runs = playAll(s, first);
    const speakers = runs.flatMap((r) => r.speakers);
    const events = runs.flatMap((r) => r.events);
    for (const sp of speakers) expect(SPEAKER_NAMES, `unknown speaker ${sp}`).toHaveProperty(sp);
    expect(events).toContainEqual({ event: 'shop', id: 'capital' });
    expect(events).toContainEqual({ event: 'cards', id: 'tourney_knight' });
    expect(events).toContainEqual({ event: 'cards', id: 'tourney_miner' });
    expect(events).toContainEqual({ event: 'cards', id: 'tourney_dealer' });
    expect(events).toContainEqual({ event: 'codexBurn', id: 'rourke_betrayal' });
    expect(events).toContainEqual({ event: 'battle', id: 'rourke_1' });
    expect(events).toContainEqual({ event: 'summary', id: 'ch3' });
    expect(events).not.toContainEqual({ event: 'battle', id: 'academy_guard' });
    expect(runs.at(-1)!.events.at(-1)).toEqual({ event: 'chapterCard', id: 'ch4' });
    expect(s.flags.ch3_complete).toBe(true);
    expect(s.quests.ch3_crown).toEqual({ stage: 6, done: true });
    expect(s.flags.tourney_champion).toBe(true);
    expect(s.flags.academy_pass).toBe(true);
    expect(s.cards.n_starcrown).toBe(1);
    expect(s.flags.bond_rourke_2).toBe(true);
    expect(s.flags.bond_serin_2).toBe(true);
    expect(s.flags.bond_liora_2).toBe(true);
    expect(s.flags.exposed_valderan).toBe(true);
    expect(s.reputation.order).toBe(-20);
    expect(s.flags.io_taken).toBe(true);
    expect(s.codex).toEqual(expect.arrayContaining(['rourke_betrayal', 'valderan', 'star_core_furnace']));
    // 未持有筆記 → 筆記選項不顯示；第 1 輪 [魅 8] 成功（rng 0）→ 不需要 rourke_2
    expect(events).not.toContainEqual({ event: 'battle', id: 'rourke_2' });
    expect(s.flags.rourke_turned).toBe(true);
    expect(s.flags.bond_rourke_3).toBe(true);
    expect(s.party).toContain('rourke');
    expect(s.party).not.toContain('io');
    expect(s.divergence).toBeGreaterThanOrEqual(15);
  });

  it('io and rourke leave the party at the inn', () => {
    const s = afterCh2();
    for (const e of CH3_ENTRIES) {
      runEntry(s, e.node);
      if (e.node === 'inn_night') break;
    }
    expect(s.party).not.toContain('io');
    expect(s.party).not.toContain('rourke');
    expect(s.flags.ch3_betrayal).toBe(true);
  });

  it('losing the first tourney match → infiltration route still completes the chapter', () => {
    const s = afterCh2();
    const outcome: Outcomer = (ev, id) => (id === 'tourney_knight' ? 'lose' : allWin(ev, id, 0));
    const runs = playAll(s, first, () => 0, outcome);
    const events = runs.flatMap((r) => r.events);
    expect(events).toContainEqual({ event: 'cards', id: 'tourney_knight' });
    expect(events).not.toContainEqual({ event: 'cards', id: 'tourney_miner' });
    expect(events).toContainEqual({ event: 'battle', id: 'academy_guard' });
    expect(s.flags.tourney_lost).toBe(true);
    expect(s.flags.tourney_champion).toBeUndefined();
    expect(s.flags.academy_pass).toBeUndefined();
    expect(s.flags.academy_sneaked).toBe(true);
    expect(s.flags.bond_serin_2).toBe(true);
    expect(s.cards.n_starcrown).toBeUndefined();
    expect(s.flags.ch3_complete).toBe(true);
  });

  it('affinity ≥ 40 persuasion after rourke_1 turns him without rourke_2', () => {
    const s = afterCh2();
    s.affinity.rourke = 40;
    const runs = playAll(s, byText('duel_persuade_1', '別讓它發生'));
    const events = runs.flatMap((r) => r.events);
    expect(events).toContainEqual({ event: 'battle', id: 'rourke_1' });
    expect(events).not.toContainEqual({ event: 'battle', id: 'rourke_2' });
    expect(s.flags.rourke_turned).toBe(true);
    expect(s.flags.rourke_lost).toBeUndefined();
    expect(s.party).toContain('rourke');
    expect(s.flags.ch3_complete).toBe(true);
  });

  it('codex option succeeds when the ch1 tavern cheat was exposed', () => {
    const s = afterCh2();
    s.flags.rourke_cheat_known = true;
    const runs = playAll(s, first, () => 0.999);
    const events = runs.flatMap((r) => r.events);
    expect(s.codex).toContain('rourke_cheat_known');
    expect(events).not.toContainEqual({ event: 'battle', id: 'rourke_2' });
    expect(s.flags.rourke_turned).toBe(true);
  });

  it('all persuasion fails → three battles and rourke_lost', () => {
    const s = afterCh2();
    const runs = playAll(s, first, () => 0.999);
    const duel = runs[CH3_ENTRIES.findIndex((e) => e.node === 'rourke_duel')]!;
    expect(duel.events).toEqual([
      { event: 'battle', id: 'rourke_1' },
      { event: 'battle', id: 'rourke_2' },
      { event: 'battle', id: 'rourke_3' },
    ]);
    expect(s.flags.rourke_lost).toBe(true);
    expect(s.flags.rourke_turned).toBeUndefined();
    expect(s.party).not.toContain('rourke');
    expect(s.flags.ch3_complete).toBe(true);
  });

  it('losing a duel battle retries the same battle', () => {
    const s = afterCh2();
    for (const e of CH3_ENTRIES.slice(0, 7)) runEntry(s, e.node);
    let n = 0;
    const res = runEntry(s, 'rourke_duel', first, () => 0, (ev, id) => {
      if (id === 'rourke_1' && n++ === 0) return 'lose';
      return allWin(ev, id, 0);
    });
    expect(res.events.slice(0, 2)).toEqual([
      { event: 'battle', id: 'rourke_1' },
      { event: 'battle', id: 'rourke_1' },
    ]);
    expect(s.flags.ch3_duel_done).toBe(true);
  });

  it('serin who left in ch2 returns by the plaza', () => {
    const s = afterCh2();
    delete s.flags.serin_stayed;
    s.flags.serin_left_ch2 = true;
    s.party = ['lian', 'io', 'liora'];
    runEntry(s, 'gate');
    runEntry(s, 'plaza');
    expect(s.party).toContain('serin');
    expect(s.flags.serin_returned).toBe(true);
    expect(s.flags.ch3_plaza_done).toBe(true);
  });

  it('gate: [魅 7] failure falls back to paying the fee', () => {
    const s = afterCh2();
    runEntry(s, 'gate', first, () => 0.999);
    expect(s.flags.gate_cha_failed).toBe(true);
    expect(s.flags.gate_paid).toBe(true);
    expect(s.gold).toBe(150);
    expect(s.flags.ch3_entered).toBe(true);
  });

  it('gate: saved caravan → Farrow vouches; sewer route fights rats', () => {
    const a = afterCh2();
    a.flags.saved_caravan = true;
    const ra = runEntry(a, 'gate');
    expect(ra.speakers).toContain('farrow');
    expect(a.flags.gate_vouched).toBe(true);
    const b = afterCh2();
    const rb = runEntry(b, 'gate', () => 2);
    expect(rb.events).toEqual([{ event: 'battle', id: 'sewer_rats' }]);
    expect(b.flags.ch3_entered).toBe(true);
  });

  it('every branch terminates (all picks, pass/fail rolls, win/lose), and can be revisited', () => {
    for (let pick = 0; pick < 4; pick++) {
      for (const rng of [() => 0, () => 0.999]) {
        const s = afterCh2();
        const loseFirst: Outcomer = (ev, id, nth) => (nth === 1 ? 'lose' : allWin(ev, id, nth));
        for (let pass = 0; pass < 6 && !s.flags.ch3_complete; pass++) {
          for (const e of CH3_ENTRIES) {
            if (e.requires && !check(s, e.requires)) continue;
            runEntry(s, e.node, () => pick, rng, loseFirst);
            runEntry(s, e.node, () => pick, rng, allWin);
          }
        }
        expect(s.flags.ch3_complete, `pick ${pick}`).toBe(true);
      }
    }
  });

  it('revisits are short and do not re-grant rewards', () => {
    const s = afterCh2();
    playAll(s, first);
    const gold = s.gold;
    for (const e of CH3_ENTRIES) {
      const r = runEntry(s, e.node);
      expect(r.speakers.length, e.node).toBeLessThanOrEqual(2);
    }
    expect(s.cards.n_starcrown).toBe(1);
    expect(s.gold).toBe(gold);
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH3.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});
