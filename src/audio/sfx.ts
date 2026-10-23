/**
 * Tiny procedural SFX synth (ZzFX-inspired). No audio files needed.
 *
 * Browsers (esp. iOS Safari) start AudioContext suspended until a user gesture,
 * so call `installAudioUnlock()` once at startup; it resumes the context on the
 * first pointerdown/touchend/keydown.
 */

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface SfxParams {
  /** Waveform. */
  wave?: Wave;
  /** Start frequency in Hz. */
  freq?: number;
  /** End frequency in Hz (exponential slide). Defaults to `freq`. */
  freqEnd?: number;
  /** Attack time in seconds. */
  attack?: number;
  /** Sustain time in seconds (held at full volume). */
  sustain?: number;
  /** Release time in seconds. */
  release?: number;
  /** Peak gain 0..1. */
  volume?: number;
  /** Vibrato depth in Hz. */
  vibrato?: number;
  /** Vibrato rate in Hz. */
  vibratoRate?: number;
  /** Lowpass cutoff in Hz (0 = off). */
  lowpass?: number;
  /** Start delay in seconds (for layered/arpeggiated sounds). */
  delay?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  return ctx;
}

function getNoise(ac: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(ac.sampleRate * 1);
  noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Shared audio graph for other modules (music). Null until audio is available. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  const ac = getCtx();
  return ac && master ? { ctx: ac, master } : null;
}

/** Resume the AudioContext on the first user gesture. Safe to call multiple times. */
export function installAudioUnlock(target: EventTarget = window): void {
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const unlock = (): void => {
    const ac = getCtx();
    if (!ac) return;
    const done = (): void => events.forEach((e) => target.removeEventListener(e, unlock, true));
    if (ac.state === 'suspended') {
      void ac.resume().then(done, () => undefined);
    } else {
      done();
    }
    // iOS needs an actual sound started inside the gesture.
    const silent = ac.createBufferSource();
    silent.buffer = ac.createBuffer(1, 1, ac.sampleRate);
    silent.connect(ac.destination);
    silent.start(0);
  };
  events.forEach((e) => target.addEventListener(e, unlock, true));
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

/** Play one synthesized sound. Returns silently if audio is unavailable. */
export function playSfx(p: SfxParams = {}): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac || !master || ac.state !== 'running') return;

  const {
    wave = 'square',
    freq = 440,
    freqEnd = freq,
    attack = 0.005,
    sustain = 0.05,
    release = 0.15,
    volume = 0.4,
    vibrato = 0,
    vibratoRate = 0,
    lowpass = 0,
    delay = 0,
  } = p;

  const t0 = ac.currentTime + delay;
  const total = attack + sustain + release;

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), t0 + attack);
  env.gain.setValueAtTime(Math.max(volume, 0.0002), t0 + attack + sustain);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + total);

  let out: AudioNode = env;
  if (lowpass > 0) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    env.connect(lp);
    out = lp;
  }
  out.connect(master);

  let src: AudioScheduledSourceNode;
  if (wave === 'noise') {
    const n = ac.createBufferSource();
    n.buffer = getNoise(ac);
    n.loop = true;
    n.playbackRate.setValueAtTime(Math.max(freq / 440, 0.01), t0);
    n.playbackRate.exponentialRampToValueAtTime(Math.max(freqEnd / 440, 0.01), t0 + total);
    src = n;
  } else {
    const o = ac.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(Math.max(freq, 1), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + total);
    if (vibrato > 0 && vibratoRate > 0) {
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      lfo.frequency.value = vibratoRate;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + total + 0.05);
    }
    src = o;
  }
  src.connect(env);
  src.start(t0);
  src.stop(t0 + total + 0.05);
}

/** Ready-made presets. */
export const SFX = {
  blip: (): void => playSfx({ wave: 'square', freq: 880, freqEnd: 1320, sustain: 0.03, release: 0.08, volume: 0.25 }),
  confirm: (): void => {
    playSfx({ wave: 'triangle', freq: 523, freqEnd: 1046, sustain: 0.06, release: 0.3, volume: 0.35 });
    playSfx({ wave: 'sine', freq: 784, freqEnd: 1568, attack: 0.02, sustain: 0.05, release: 0.45, volume: 0.2, vibrato: 6, vibratoRate: 7 });
  },
  hit: (): void => {
    playSfx({ wave: 'noise', freq: 900, freqEnd: 120, sustain: 0.02, release: 0.18, volume: 0.5, lowpass: 2400 });
    playSfx({ wave: 'square', freq: 180, freqEnd: 50, sustain: 0.02, release: 0.15, volume: 0.3 });
  },
  // ---- 05 §6 具名音效 ----
  uiTap: (): void => playSfx({ wave: 'triangle', freq: 660, freqEnd: 990, sustain: 0.01, release: 0.06, volume: 0.18 }),
  uiCancel: (): void => playSfx({ wave: 'triangle', freq: 520, freqEnd: 260, sustain: 0.02, release: 0.12, volume: 0.2 }),
  hitLight: (): void => {
    playSfx({ wave: 'noise', freq: 1400, freqEnd: 300, sustain: 0.01, release: 0.1, volume: 0.35, lowpass: 3200 });
    playSfx({ wave: 'square', freq: 260, freqEnd: 90, sustain: 0.01, release: 0.08, volume: 0.2 });
  },
  hitHeavy: (): void => {
    playSfx({ wave: 'noise', freq: 700, freqEnd: 60, sustain: 0.04, release: 0.3, volume: 0.6, lowpass: 1800 });
    playSfx({ wave: 'sine', freq: 120, freqEnd: 35, sustain: 0.05, release: 0.35, volume: 0.6 });
  },
  perfect: (): void => {
    playSfx({ wave: 'sine', freq: 1568, freqEnd: 2093, sustain: 0.04, release: 0.4, volume: 0.3, vibrato: 8, vibratoRate: 9 });
    playSfx({ wave: 'triangle', freq: 1047, sustain: 0.03, release: 0.3, volume: 0.25, delay: 0.04 });
  },
  parry: (): void => {
    playSfx({ wave: 'square', freq: 2400, freqEnd: 1800, sustain: 0.01, release: 0.18, volume: 0.22, lowpass: 6000 });
    playSfx({ wave: 'noise', freq: 3000, freqEnd: 1500, sustain: 0.01, release: 0.08, volume: 0.25 });
  },
  dodge: (): void => playSfx({ wave: 'noise', freq: 300, freqEnd: 1800, attack: 0.03, sustain: 0.02, release: 0.12, volume: 0.25, lowpass: 2500 }),
  break: (): void => {
    for (let i = 0; i < 4; i++) {
      playSfx({ wave: 'square', freq: 2200 - i * 300, freqEnd: 600, sustain: 0.01, release: 0.12, volume: 0.15, delay: i * 0.035 });
    }
    playSfx({ wave: 'noise', freq: 2000, freqEnd: 200, sustain: 0.05, release: 0.4, volume: 0.4 });
  },
  /** 燈印：第 n 盞（0 起算）音高依序 C-E-G-B-D */
  lampPlace: (n: number): void => {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    const f = notes[Math.max(0, Math.min(notes.length - 1, n))] ?? 523.25;
    playSfx({ wave: 'sine', freq: f, sustain: 0.05, release: 0.5, volume: 0.3, vibrato: 4, vibratoRate: 6 });
    playSfx({ wave: 'triangle', freq: f * 2, sustain: 0.02, release: 0.25, volume: 0.1, delay: 0.02 });
  },
  resonance: (): void => {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, i) => playSfx({ wave: 'sine', freq: f, sustain: 0.05, release: 0.6, volume: 0.22, delay: i * 0.06 }));
    playSfx({ wave: 'noise', freq: 200, freqEnd: 3000, attack: 0.3, sustain: 0.1, release: 0.9, volume: 0.35, lowpass: 4000, delay: 0.3 });
    playSfx({ wave: 'sine', freq: 90, freqEnd: 30, sustain: 0.2, release: 1.0, volume: 0.7, delay: 0.4 });
  },
  cardPlay: (): void => playSfx({ wave: 'noise', freq: 2500, freqEnd: 800, sustain: 0.01, release: 0.06, volume: 0.25, lowpass: 5000 }),
  cardPass: (): void => playSfx({ wave: 'sine', freq: 440, freqEnd: 220, sustain: 0.05, release: 0.3, volume: 0.2 }),
  roundWin: (): void => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playSfx({ wave: 'triangle', freq: f, sustain: 0.05, release: 0.3, volume: 0.25, delay: i * 0.08 }));
  },
  levelUp: (): void => {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playSfx({ wave: 'square', freq: f, sustain: 0.04, release: 0.2, volume: 0.15, lowpass: 3000, delay: i * 0.07 }));
  },
  itemGet: (): void => {
    playSfx({ wave: 'triangle', freq: 880, sustain: 0.04, release: 0.15, volume: 0.2 });
    playSfx({ wave: 'triangle', freq: 1318.5, sustain: 0.06, release: 0.3, volume: 0.2, delay: 0.09 });
  },
  save: (): void => playSfx({ wave: 'sine', freq: 1200, freqEnd: 1600, sustain: 0.02, release: 0.2, volume: 0.1 }),
} as const;
