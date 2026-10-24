import { describe, expect, it } from 'vitest';
import { TRACKS, chapterTrack } from '../src/audio/music';

describe('程序音樂曲目', () => {
  it('每首的節奏型都是 16 步、和弦非空', () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.arp, t.id).toHaveLength(16);
      expect(t.bassPattern, t.id).toHaveLength(16);
      expect(t.chords.length, t.id).toBeGreaterThan(0);
      for (const d of Object.values(t.drums ?? {})) expect(d, t.id).toHaveLength(16);
    }
  });
  it('各章探索曲都存在', () => {
    for (const ch of ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5']) expect(TRACKS[chapterTrack(ch)]).toBeTruthy();
    for (const id of ['duel', 'boss_starstage']) expect(TRACKS[id]).toBeTruthy();
  });
});
