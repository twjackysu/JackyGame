import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript, type DialogueStep } from '../src/core/dialogue/runner';
import { check, newGame, type GameState } from '../src/core/state/gameState';
import { CH1, CH1_ENTRIES } from '../src/data/dialogue/ch1';
import { SPEAKER_NAMES } from '../src/data/dialogue/speakers';
import { ENCOUNTERS } from '../src/data/combatants';
import { CHAPTER_MAPS } from '../src/data/maps';

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

/** 從入口節點跑到 'end'；事件以 win 回應（loseFirst：第一個事件先輸一次）。 */
function runEntry(
  state: GameState,
  node: string,
  pick: Picker = () => 0,
  rng: () => number = () => 0,
  outcome: 'win' | 'loseFirst' = 'win',
): RunResult {
  const r = new DialogueRunner({ ...CH1, start: node }, state, rng);
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

describe('ch1 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH1)) expect(CH1.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH1.nodes).toHaveProperty(CH1.start ?? 'start');
  });

  it('every entry node exists and locations are unique ascii ids', () => {
    const locs = new Set<string>();
    for (const e of CH1_ENTRIES) {
      expect(CH1.nodes, `missing entry node ${e.node}`).toHaveProperty(e.node);
      expect(e.location).toMatch(/^[a-z_]+$/);
      expect(e.title.length).toBeGreaterThan(0);
      locs.add(e.location);
    }
    expect(locs.size).toBe(CH1_ENTRIES.length);
  });

  it('battle events use known encounters', () => {
    for (const lines of Object.values(CH1.nodes))
      for (const l of lines)
        if ('event' in l && l.event === 'battle') expect(ENCOUNTERS, l.id).toHaveProperty(l.id);
  });

  it('plays all entries in story order on one state (first option, wins)', () => {
    const s = newGame(0);
    const speakers: string[] = [];
    let last: RunResult | undefined;
    for (const e of CH1_ENTRIES) {
      if (e.requires) expect(check(s, e.requires), `${e.node} locked`).toBe(true);
      last = runEntry(s, e.node);
      speakers.push(...last.speakers);
    }
    for (const sp of speakers) expect(SPEAKER_NAMES, `unknown speaker ${sp}`).toHaveProperty(sp);
    expect(last!.events.at(-1)).toEqual({ event: 'chapterCard', id: 'ch2' });
    expect(s.flags.ch1_complete).toBe(true);
    expect(s.party).toContain('io');
    expect(s.party).not.toContain('rourke');
    expect(s.members.rourke?.guest).toBe(true);
    expect(s.skills).toContain('guiding_light');
    expect(s.flags.saved_caravan).toBe(true);
    expect(s.flags.beat_rourke).toBe(true);
  });

  it('each entry gates the next: requires is false on a new game (except the first)', () => {
    const s = newGame(0);
    CH1_ENTRIES.forEach((e, i) => {
      if (i === 0) expect(e.requires).toBeUndefined();
      else expect(check(s, e.requires!), e.node).toBe(false);
    });
  });

  it('codex options are usable (codex granted before the check)', () => {
    const s = newGame(0);
    const codexPick: Picker = (node) =>
      node === 'tavern' ? 1 : node === 'forest_edge' ? 3 : 0;
    for (const e of CH1_ENTRIES) {
      if (e.requires && !check(s, e.requires)) continue;
      runEntry(s, e.node, codexPick, () => 0.999);
    }
    expect(s.flags.rourke_cheat_known).toBe(true);
    expect(s.flags.wolfpack_returned).toBe(true);
    expect(s.flags.saved_caravan).toBe(true);
    expect(s.flags.ch1_complete).toBe(true);
  });

  it('losing to Bern at cards, then clearing the wolf path still yields the wick (no soft-lock)', () => {
    const s = newGame(0);
    const pick: Picker = (node) => (node === 'hunter_ask' ? 1 : 0);
    const visit = (node: string, outcome: 'win' | 'loseFirst' = 'win') => runEntry(s, node, pick, () => 0, outcome);
    for (const n of ['orphanage', 'tavern', 'town_gate', 'forest_edge', 'mist_lake']) visit(n);
    visit('hunter_hut', 'loseFirst');
    expect(s.flags.wick_hunter).toBeUndefined();
    expect(s.flags.bern_wait).toBeUndefined();
    // 地圖：獵人小屋改為「等待中」，不再閃「！」誤導玩家
    const waitHut = CHAPTER_MAPS.ch1.waiting!.hunter_hut!;
    expect(check(s, waitHut)).toBe(true);
    visit('wolf_path');
    expect(check(s, waitHut)).toBe(false);
    visit('hunter_hut', 'loseFirst'); // 仍會輸牌的玩家也拿得到
    expect(s.flags.wick_hunter).toBe(true);
  });

  it('hunter fallback route: clear wolf path, then Bern hands over the wick', () => {
    const s = newGame(0);
    const pick: Picker = (node) => (node === 'hunter_ask' ? 2 : 0);
    const visit = (node: string) => runEntry(s, node, pick);
    for (const n of ['orphanage', 'tavern', 'town_gate', 'forest_edge', 'mist_lake', 'hunter_hut']) visit(n);
    expect(s.flags.bern_wait).toBe(true);
    expect(s.flags.wick_hunter).toBeUndefined();
    visit('hunter_hut'); // 還沒清狼徑
    expect(s.flags.wick_hunter).toBeUndefined();
    visit('wolf_path');
    visit('hunter_hut');
    expect(s.flags.wick_hunter).toBe(true);
    const lh = CH1_ENTRIES.find((e) => e.node === 'lighthouse')!;
    expect(check(s, lh.requires!)).toBe(true);
  });

  it('every branch terminates (all picks, pass/fail rolls, win/lose), and can be revisited', () => {
    for (let pick = 0; pick < 4; pick++) {
      for (const rng of [() => 0, () => 0.999]) {
        const s = newGame(0);
        // 反覆巡迴地圖：無論選哪條路，最終都能通關（輸的事件也要能結束）
        for (let pass = 0; pass < 6 && !s.flags.ch1_complete; pass++) {
          for (const e of CH1_ENTRIES) {
            if (e.requires && !check(s, e.requires)) continue;
            // 商隊/獵人選項依 pick 走分支；酒館「先不了」只在第一圈
            const picker: Picker = (node, n) =>
              node === 'tavern' && pass > 0 ? 0 : node === 'tavern_revisit' ? n - 1 : pick;
            runEntry(s, e.node, picker, rng, 'loseFirst');
            runEntry(s, e.node, picker, rng, 'win');
          }
        }
        expect(s.flags.ch1_complete, `pick ${pick}`).toBe(true);
      }
    }
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH1.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});

describe('ch1 探索支線', () => {
  it('霧菇與紅頭巾：接任務 → 找到米亞 → 回報拿守護項鍊', () => {
    const s = newGame();
    s.flags.ch1_got_lantern = true;
    runEntry(s, 'ruth');
    expect(s.flags.q_lost_kid).toBe(true);
    runEntry(s, 'ruth');
    expect(s.flags.q_lost_kid_done).toBeUndefined();
    s.party.push('io');
    runEntry(s, 'mia');
    expect(s.flags.q_lost_kid_found).toBe(true);
    expect(s.affinity.io).toBe(3);
    const gold = s.gold;
    runEntry(s, 'ruth');
    expect(s.flags.q_lost_kid_done).toBe(true);
    expect(s.inventory.amulet_guard).toBe(1);
    expect(s.gold).toBe(gold + 20);
    const r = runEntry(s, 'ruth');
    expect(r.speakers).toEqual(['ruth']);
  });
  it('流浪牌手：輸了可以再來，贏了拿吞火人', () => {
    const s = newGame();
    const lost = runEntry(s, 'drifter', () => 0, () => 0, 'loseFirst');
    expect(lost.events).toEqual([{ event: 'cards', id: 'drifter' }]);
    expect(s.flags.drifter_beaten).toBeUndefined();
    runEntry(s, 'drifter');
    expect(s.flags.drifter_beaten).toBe(true);
    expect(s.cards.c_fire_eater).toBe(1);
  });
  it('新說話者都有名字', () => {
    for (const id of ['ruth', 'mia', 'drifter']) expect(SPEAKER_NAMES[id]).toBeTruthy();
  });
});
