// 程序生成背景音樂（05 §7）：和弦進行 + 琶音 + pad + 低音 + 簡單打擊，WebAudio 即時排程。
import { getAudio } from './sfx';

export interface Track {
  id: string;
  bpm: number;
  /** 每小節一個和弦：根音 MIDI 與音程（半音） */
  chords: { root: number; tones: number[] }[];
  /** 琶音型：每 16 分音符取和弦第 i 個音（-1 = 休止），長度 16 */
  arp: number[];
  arpWave: OscillatorType;
  arpOctave: number;
  padVolume: number;
  bassPattern: number[]; // 16 步，1 = 彈根音
  drums?: { kick: number[]; hat: number[] }; // 16 步
  volume: number;
}

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export const TRACKS: Record<string, Track> = {
  // 標題：D 小調、慢板、神秘史詩（i – VI – III – VII）
  title: {
    id: 'title',
    bpm: 72,
    chords: [
      { root: 50, tones: [0, 3, 7, 10] }, // Dm7
      { root: 46, tones: [0, 4, 7, 11] }, // Bbmaj7
      { root: 53, tones: [0, 4, 7, 9] }, // F6
      { root: 48, tones: [0, 4, 7, 14] }, // Cadd9
    ],
    arp: [0, 1, 2, 3, 2, 1, 0, -1, 0, 2, 3, 2, 1, 2, 0, -1],
    arpWave: 'triangle',
    arpOctave: 12,
    padVolume: 0.07,
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    volume: 0.5,
  },
  // 戰鬥：A 小調 120 BPM、推進低音
  battle: {
    id: 'battle',
    bpm: 128,
    chords: [
      { root: 45, tones: [0, 3, 7] },
      { root: 41, tones: [0, 4, 7] },
      { root: 43, tones: [0, 4, 7] },
      { root: 40, tones: [0, 4, 7, 10] },
    ],
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2],
    arpWave: 'square',
    arpOctave: 24,
    padVolume: 0.04,
    bassPattern: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    },
    volume: 0.45,
  },
};

let current: { track: Track; timer: number; out: GainNode; step: number; nextTime: number } | null = null;

function note(ac: AudioContext, out: AudioNode, wave: OscillatorType, hz: number, t: number, dur: number, vol: number, lp = 0): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = wave;
  o.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let dst: AudioNode = g;
  if (lp > 0) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    g.connect(f);
    dst = f;
  }
  dst.connect(out);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseHit(ac: AudioContext, out: AudioNode, t: number, dur: number, vol: number, hp: number): void {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function scheduleStep(ac: AudioContext, tr: Track, out: GainNode, step: number, t: number): void {
  const s16 = 60 / tr.bpm / 4;
  const bar = Math.floor(step / 16) % tr.chords.length;
  const i = step % 16;
  const chord = tr.chords[bar]!;
  // pad：每小節開頭
  if (i === 0) {
    for (const tone of chord.tones) note(ac, out, 'sawtooth', midiHz(chord.root + 12 + tone), t, s16 * 16, tr.padVolume, 900);
  }
  const a = tr.arp[i] ?? -1;
  if (a >= 0) {
    const tone = chord.tones[a % chord.tones.length] ?? 0;
    note(ac, out, tr.arpWave, midiHz(chord.root + tr.arpOctave + tone), t, s16 * 1.8, 0.09, 3200);
  }
  if (tr.bassPattern[i]) note(ac, out, 'triangle', midiHz(chord.root - 12), t, s16 * 1.6, 0.22);
  if (tr.drums) {
    if (tr.drums.kick[i]) note(ac, out, 'sine', 70, t, 0.18, 0.5);
    if (tr.drums.hat[i]) noiseHit(ac, out, t, 0.04, 0.12, 7000);
  }
}

/** 播放曲目（循環）。同一首重複呼叫不會重來。 */
export function playMusic(id: keyof typeof TRACKS | string, fadeSec = 1.2): void {
  const tr = TRACKS[id];
  const audio = getAudio();
  if (!tr || !audio) return;
  if (current?.track.id === id) return;
  stopMusic(fadeSec * 0.6);
  const { ctx: ac, master } = audio;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, ac.currentTime);
  out.gain.exponentialRampToValueAtTime(tr.volume, ac.currentTime + fadeSec);
  out.connect(master);
  const state = { track: tr, timer: 0, out, step: 0, nextTime: ac.currentTime + 0.1 };
  const tick = (): void => {
    if (ac.state !== 'running') return;
    if (state.nextTime < ac.currentTime) state.nextTime = ac.currentTime + 0.05; // 從暫停恢復時不要補播
    const s16 = 60 / tr.bpm / 4;
    while (state.nextTime < ac.currentTime + 0.25) {
      scheduleStep(ac, tr, out, state.step, state.nextTime);
      state.step++;
      state.nextTime += s16;
    }
  };
  state.timer = window.setInterval(tick, 60);
  current = state;
  tick();
}

export function stopMusic(fadeSec = 0.8): void {
  const audio = getAudio();
  if (!current || !audio) {
    current = null;
    return;
  }
  const { ctx: ac } = audio;
  const c = current;
  window.clearInterval(c.timer);
  c.out.gain.cancelScheduledValues(ac.currentTime);
  c.out.gain.setValueAtTime(Math.max(c.out.gain.value, 0.0001), ac.currentTime);
  c.out.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + fadeSec);
  window.setTimeout(() => c.out.disconnect(), (fadeSec + 0.3) * 1000);
  current = null;
}
