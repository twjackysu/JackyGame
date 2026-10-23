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
  } = p;

  const t0 = ac.currentTime;
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
} as const;
