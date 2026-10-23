import { describe, expect, it } from 'vitest';
import { DialogueRunner, type DialogueScript } from '../src/core/dialogue/runner';
import { newGame } from '../src/core/state/gameState';
import { CH0 } from '../src/data/dialogue/ch0';
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

function runToEnd(script: DialogueScript, pick = 0, rng: () => number = () => 0): string[] {
  const r = new DialogueRunner(script, newGame(0), rng);
  const speakers: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const step = r.next();
    if (step.kind === 'end') return speakers;
    if (step.kind === 'say') speakers.push(step.speaker);
    else if (step.kind === 'choice') {
      expect(step.options.length).toBeGreaterThan(0);
      r.choose(Math.min(pick, step.options.length - 1));
    } else if (step.kind === 'event') r.resume('win');
  }
  throw new Error('script did not end within 1000 steps');
}

describe('ch0 script', () => {
  it('all jump targets exist', () => {
    for (const t of targets(CH0)) expect(CH0.nodes, `missing node ${t}`).toHaveProperty(t);
    expect(CH0.nodes).toHaveProperty(CH0.start ?? 'start');
  });

  it('reaches end picking the first option', () => {
    const speakers = runToEnd(CH0);
    for (const s of speakers) expect(SPEAKER_NAMES, `unknown speaker ${s}`).toHaveProperty(s);
  });

  it('reaches end on every choice branch (incl. failed checks)', () => {
    for (let pick = 0; pick < 3; pick++) {
      runToEnd(CH0, pick, () => 0);
      runToEnd(CH0, pick, () => 0.999);
    }
  });

  it('say lines stay short', () => {
    for (const lines of Object.values(CH0.nodes))
      for (const l of lines) if ('say' in l) expect(l.text.length, l.text).toBeLessThanOrEqual(44);
  });
});
