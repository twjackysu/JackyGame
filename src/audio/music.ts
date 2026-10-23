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
  bassPattern: number[]; // 16 步，1 = 彈根音；2 = 彈高八度根音（八度跳躍低音）
  drums?: { kick: number[]; hat: number[]; snare?: number[] }; // 16 步
  volume: number;
  // ---- 以下為選用欄位（省略時沿用原本行為，舊曲目不受影響） ----
  /** 琶音音量（預設 0.09） */
  arpVolume?: number;
  /** 琶音長度（以 16 分音符為單位，預設 1.8；越短越有撥弦感） */
  arpLen?: number;
  /** 琶音低通截止頻率（預設 3200） */
  arpLp?: number;
  /** pad 波形（預設 sawtooth） */
  padWave?: OscillatorType;
  /** 低音波形（預設 triangle；sawtooth 會自動加低通，聽起來較厚重） */
  bassWave?: OscillatorType;
  /** 低音音量（預設 0.22） */
  bassVolume?: number;
  /** 低音長度（以 16 分音符為單位，預設 1.6） */
  bassLen?: number;
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
  // 頭目戰（狼王）：E 小調 150 BPM、弗里幾亞 bII 張力（i – VI – bII – V7），
  // 鋸齒低音 + 八度跳躍、四拍大鼓 + 反拍小鼓 + 16 分踩鈸，緊迫推進。
  boss: {
    id: 'boss',
    bpm: 150,
    chords: [
      { root: 40, tones: [0, 3, 7, 12] }, // Em
      { root: 36, tones: [0, 4, 7, 12] }, // C
      { root: 41, tones: [0, 4, 7, 12] }, // F（bII，弗里幾亞色彩）
      { root: 35, tones: [0, 4, 7, 10] }, // B7（屬和弦，回到 Em 的拉力）
    ],
    arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 2, 1],
    arpWave: 'sawtooth',
    arpOctave: 24,
    arpVolume: 0.06,
    arpLen: 1.1,
    arpLp: 2400,
    padVolume: 0.035,
    padWave: 'square',
    bassPattern: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2],
    bassWave: 'sawtooth',
    bassVolume: 0.2,
    bassLen: 0.9,
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    },
    volume: 0.42,
  },
  // 探索（城鎮／森林地圖、對話）：F 大調 80 BPM、溫暖抒情（I – vi – IV – V），
  // 正弦琶音稀疏柔和、三角波 pad、無打擊。
  explore: {
    id: 'explore',
    bpm: 80,
    chords: [
      { root: 53, tones: [0, 4, 7, 11] }, // Fmaj7
      { root: 50, tones: [0, 3, 7, 10] }, // Dm7
      { root: 46, tones: [0, 4, 7, 14] }, // Bbadd9
      { root: 48, tones: [0, 5, 7, 10] }, // C7sus4
    ],
    arp: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 0, -1, -1, -1],
    arpWave: 'sine',
    arpOctave: 12,
    arpVolume: 0.08,
    arpLen: 3.2,
    arpLp: 2200,
    padVolume: 0.05,
    padWave: 'triangle',
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    bassLen: 6,
    bassVolume: 0.18,
    volume: 0.45,
  },
  // 卡牌小遊戲：C 大調 112 BPM、俏皮撥弦（I – vi – ii – V），
  // 短促三角波琶音、跳躍低音、輕巧的大鼓與踩鈸。
  cards: {
    id: 'cards',
    bpm: 112,
    chords: [
      { root: 48, tones: [0, 4, 7, 12] }, // C
      { root: 45, tones: [0, 3, 7, 12] }, // Am
      { root: 50, tones: [0, 3, 7, 10] }, // Dm7
      { root: 43, tones: [0, 4, 7, 10] }, // G7
    ],
    arp: [0, 2, 3, -1, 1, 2, -1, 3, 2, -1, 1, 3, -1, 2, 0, -1],
    arpWave: 'triangle',
    arpOctave: 24,
    arpVolume: 0.1,
    arpLen: 0.7,
    arpLp: 4200,
    padVolume: 0.025,
    padWave: 'triangle',
    bassPattern: [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 1, 0, 0],
    bassLen: 1.0,
    bassVolume: 0.18,
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    },
    volume: 0.4,
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

// 噪音緩衝依長度快取，避免每拍重新產生（頭目曲 16 分踩鈸時可省下大量配置）
const noiseCache = new Map<string, AudioBuffer>();

function noiseBuffer(ac: AudioContext, dur: number): AudioBuffer {
  const key = `${ac.sampleRate}:${dur}`;
  let buf = noiseCache.get(key);
  if (!buf) {
    const len = Math.floor(ac.sampleRate * dur);
    buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noiseCache.set(key, buf);
  }
  return buf;
}

function noiseHit(ac: AudioContext, out: AudioNode, t: number, dur: number, vol: number, hp: number): void {
  const buf = noiseBuffer(ac, dur);
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
    const padWave = tr.padWave ?? 'sawtooth';
    for (const tone of chord.tones) note(ac, out, padWave, midiHz(chord.root + 12 + tone), t, s16 * 16, tr.padVolume, 900);
  }
  const a = tr.arp[i] ?? -1;
  if (a >= 0) {
    const tone = chord.tones[a % chord.tones.length] ?? 0;
    note(ac, out, tr.arpWave, midiHz(chord.root + tr.arpOctave + tone), t, s16 * (tr.arpLen ?? 1.8), tr.arpVolume ?? 0.09, tr.arpLp ?? 3200);
  }
  const b = tr.bassPattern[i] ?? 0;
  if (b) {
    const bassWave = tr.bassWave ?? 'triangle';
    const hz = midiHz(chord.root - 12 + (b === 2 ? 12 : 0));
    note(ac, out, bassWave, hz, t, s16 * (tr.bassLen ?? 1.6), tr.bassVolume ?? 0.22, bassWave === 'triangle' || bassWave === 'sine' ? 0 : 700);
  }
  if (tr.drums) {
    if (tr.drums.kick[i]) note(ac, out, 'sine', 70, t, 0.18, 0.5);
    if (tr.drums.snare?.[i]) noiseHit(ac, out, t, 0.12, 0.16, 1500);
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
