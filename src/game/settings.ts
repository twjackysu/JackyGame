// 玩家設定（每台裝置一份，存在 localStorage；讀寫失敗時用預設值）。
import { setMuted, setVolume } from '../audio/sfx';
import { setMusicEnabled } from '../audio/music';
import { AUTO_SKILL_DEFAULT, AUTO_SKILL_VERSION, cleanAutoSkills } from '../core/battle/rt/auto';

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
  /** 手機震動（受擊、格擋、Boss 倒下；Android 才有，第 80 輪 D-212） */
  vibrate: boolean;
  /** 已顯示過「防守太難？可開自動時機」提示 */
  autoTipShown: boolean;
  /** 自動施放的技能欄（P1，D-342）；舊設定沒有這一欄＝預設（重斬、旋風斬那兩欄自動） */
  autoSkills: string[];
  /** autoSkills 是照哪一版預設存的（D-344：預設改了，舊版存的要換成新預設） */
  autoVer: number;
}

const KEY = 'jackygame.settings';
const DEFAULTS: Settings = { autoTiming: false, bgm: true, sfx: true, volume: 1, textSpeed: 'normal', autoTipShown: false, lowFx: false, vibrate: true, autoSkills: [...AUTO_SKILL_DEFAULT], autoVer: AUTO_SKILL_VERSION };
let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  let s: Partial<Settings> = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
  } catch {
    s = {};
  }
  // 第 112 輪（D-260）：型別和預設值不同的欄位丟掉（壞掉的存檔不會讓音量變 NaN）
  const ok: Record<string, unknown> = {};
  if (s && typeof s === 'object') for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) if (typeof s[k] === typeof DEFAULTS[k] && !(typeof s[k] === 'number' && !Number.isFinite(s[k]))) ok[k] = s[k];
  cache = { ...DEFAULTS, ...(ok as Partial<Settings>) };
  // 存的是舊版預設（或沒存過版本）→ 換成新的預設
  // 版本 2 → 3（D-345）：第 4 欄換成可以自動的招——玩家在版本 2 自己調過的留著，有開任何一欄的再加上第 4 欄；全關的維持全關
  const v2list = s && typeof s === 'object' && s.autoVer === 2 && Array.isArray(s.autoSkills) ? (s.autoSkills as unknown[]) : null;
  const old = !s || typeof s !== 'object' || s.autoVer !== AUTO_SKILL_VERSION;
  cache.autoSkills = v2list ? cleanAutoSkills(v2list.length ? [...v2list, 'parry'] : []) : cleanAutoSkills(old ? undefined : s.autoSkills);
  cache.autoVer = AUTO_SKILL_VERSION;
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
