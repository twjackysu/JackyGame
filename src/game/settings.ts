// 玩家設定（每台裝置一份，存在 localStorage；讀寫失敗時用預設值）。
import { setMuted, setVolume } from '../audio/sfx';
import { setMusicEnabled } from '../audio/music';

export interface Settings {
  /** 自動時機：攻擊固定 Good、防守固定成功（照顧輕度玩家，03 §戰鬥） */
  autoTiming: boolean;
  bgm: boolean;
  sfx: boolean;
  /** 整體音量 0.25／0.5／0.75／1（第 73 輪） */
  volume: number;
  /** 文字速度：每字毫秒 */
  textSpeed: 'normal' | 'fast';
  /** 省電畫質：粒子減量、關閉逐物件光暈濾鏡（中低階手機） */
  lowFx: boolean;
  /** 已顯示過「防守太難？可開自動時機」提示 */
  autoTipShown: boolean;
}

const KEY = 'jackygame.settings';
const DEFAULTS: Settings = { autoTiming: false, bgm: true, sfx: true, volume: 1, textSpeed: 'normal', autoTipShown: false, lowFx: false };
let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  let s: Partial<Settings> = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
  } catch {
    s = {};
  }
  cache = { ...DEFAULTS, ...s };
  return cache;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* 無法儲存：只在本次生效 */
  }
  applySettings();
  return cache;
}

export function applySettings(): void {
  const s = getSettings();
  setMuted(!s.sfx);
  setVolume(s.volume);
  setMusicEnabled(s.bgm);
}

/** 高畫質特效是否開啟（光暈濾鏡等） */
export const highFx = (): boolean => !getSettings().lowFx;

export const textCharMs = (): number => (getSettings().textSpeed === 'fast' ? 14 : 32);
