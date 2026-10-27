// 即時戰鬥的操作設定（D-088，Jacky 10/25：技能按鈕位置、技能排列、桌機快捷鍵都能自己調）。
// 只存在 localStorage `jg_rt_controls`；純資料函式有測試（tests/rt-controls.test.ts）。
// 長螢幕（D-142）：預設位置與觸控區都往下移 TALL，貼齊畫面下緣；存檔記下當時的高度，換高度時下半部的自訂位置跟著移。
import { GAME_HEIGHT, TALL } from './screen';

/** 右下按鈕的索引：0–3 技能欄、4 閃避、5 大招、6 藥水；7 是搖桿底座 */
export const BTN_COUNT = 7;
export const JOY_INDEX = 7;

export const DEFAULT_ORDER = ['heavy_slash', 'whirlwind', 'charge', 'parry'] as const;

/** 可以綁鍵的動作 */
export const ACTIONS = ['up', 'down', 'left', 'right', 'slot1', 'slot2', 'slot3', 'slot4', 'dodge', 'ult', 'potion'] as const;
export type RtAction = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<RtAction, string> = {
  up: '往上走', down: '往下走', left: '往左走', right: '往右走',
  slot1: '技能欄 1', slot2: '技能欄 2', slot3: '技能欄 3', slot4: '技能欄 4',
  dodge: '閃避', ult: '大招', potion: '藥水',
};

/** 預設鍵（keyCode）：WASD、1–4、空白、R、Q */
export const DEFAULT_KEYS: Record<RtAction, number> = {
  up: 87, down: 83, left: 65, right: 68, slot1: 49, slot2: 50, slot3: 51, slot4: 52, dodge: 32, ult: 82, potion: 81,
};

export interface RtControls {
  /** 技能欄 1–4 放哪個技能 */
  order: string[];
  /** 自訂位置（畫面座標，720×1280）；沒有就用預設 */
  pos: Record<number, { x: number; y: number }>;
  /** 按鈕大小倍率 */
  scale: number;
  /** 左手模式：搖桿在右、按鈕在左 */
  leftHand: boolean;
  keys: Record<RtAction, number>;
}

/** 預設位置（右手）：四技能弧形、閃避右下、大招與藥水在上方；搖桿左下 */
const BASE: { x: number; y: number }[] = [
  { x: 470, y: 1190 }, { x: 470, y: 1080 }, { x: 570, y: 1010 }, { x: 660, y: 1075 }, { x: 640, y: 1185 }, { x: 570, y: 900 }, { x: 672, y: 948 },
  { x: 150, y: 1150 },
].map((b) => ({ x: b.x, y: b.y + TALL }));

export const SCALES = [0.85, 1, 1.15] as const;
const W = 720;
const H = GAME_HEIGHT;

export function defaultControls(): RtControls {
  return { order: [...DEFAULT_ORDER], pos: {}, scale: 1, leftHand: false, keys: { ...DEFAULT_KEYS } };
}

/** 讀進來的設定一律檢查：缺欄位補預設、技能必須是四個不重複的預設技能、座標夾在畫面內 */
export function sanitize(raw: unknown): RtControls {
  const d = defaultControls();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<RtControls>;
  const order = Array.isArray(r.order) && r.order.length === 4 && new Set(r.order).size === 4 && r.order.every((id) => (DEFAULT_ORDER as readonly string[]).includes(id)) ? [...r.order] : d.order;
  const pos: RtControls['pos'] = {};
  if (r.pos && typeof r.pos === 'object') {
    for (const [k, v] of Object.entries(r.pos)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i > JOY_INDEX || !v || typeof v.x !== 'number' || typeof v.y !== 'number') continue;
      pos[i] = clampPos(v.x, v.y);
    }
  }
  const scale = (SCALES as readonly number[]).includes(r.scale as number) ? (r.scale as number) : 1;
  const keys = { ...d.keys };
  if (r.keys && typeof r.keys === 'object') {
    for (const a of ACTIONS) {
      const v = (r.keys as Record<string, unknown>)[a];
      if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 256) keys[a] = v;
    }
  }
  // 重複的鍵：後面的退回預設（預設也撞就清成 0＝不綁）
  const used = new Set<number>();
  for (const a of ACTIONS) {
    if (used.has(keys[a])) keys[a] = used.has(DEFAULT_KEYS[a]) ? 0 : DEFAULT_KEYS[a];
    if (keys[a]) used.add(keys[a]);
  }
  return { order, pos, scale, leftHand: r.leftHand === true, keys };
}

export function clampPos(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(Math.max(40, Math.min(W - 40, x))), y: Math.round(Math.max(260, Math.min(H - 40, y))) };
}

/** 第 i 個按鈕（或搖桿）在畫面上的位置 */
export function buttonPos(c: RtControls, i: number): { x: number; y: number } {
  const p = c.pos[i];
  if (p) return p;
  const b = BASE[i]!;
  return c.leftHand ? { x: W - b.x, y: b.y } : b;
}

/** 按鈕半徑（藥水小一號） */
export function buttonR(c: RtControls, i: number): number {
  return Math.round((i === 6 ? 40 : 50) * c.scale);
}

/** 搖桿的觸控區：搖桿那一側的下方三分之一（左手模式在右邊） */
export function inStickZone(c: RtControls, x: number, y: number): boolean {
  const j = buttonPos(c, JOY_INDEX);
  return y > Math.min(980 + TALL, j.y - 170) && (j.x < W / 2 ? x < W / 2 : x > W / 2);
}

/** 交換兩個技能欄（a、b 是 0–3） */
export function swapSlots(c: RtControls, a: number, b: number): RtControls {
  if (a === b || a < 0 || b < 0 || a > 3 || b > 3) return c;
  const order = [...c.order];
  [order[a], order[b]] = [order[b]!, order[a]!];
  return { ...c, order };
}

/** 把某動作綁到新鍵；那個鍵原本屬於別的動作就互換 */
export function rebind(c: RtControls, action: RtAction, code: number): RtControls {
  const keys = { ...c.keys };
  const other = ACTIONS.find((a) => a !== action && keys[a] === code);
  if (other) keys[other] = keys[action];
  keys[action] = code;
  return { ...c, keys };
}

/** 切換左手模式：自訂位置一起左右鏡射，玩家調過的相對位置不會亂掉 */
export function setLeftHand(c: RtControls, on: boolean): RtControls {
  if (c.leftHand === on) return c;
  const pos: RtControls['pos'] = {};
  for (const [k, v] of Object.entries(c.pos)) pos[Number(k)] = { x: W - v.x, y: v.y };
  return { ...c, leftHand: on, pos };
}

/** 給畫面顯示用的鍵名 */
export function keyName(code: number): string {
  if (!code) return '（未設定）';
  if (code >= 48 && code <= 57) return String(code - 48);
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return `數字鍵 ${code - 96}`;
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  const named: Record<number, string> = { 32: '空白鍵', 13: 'Enter', 9: 'Tab', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 37: '←', 38: '↑', 39: '→', 40: '↓', 186: ';', 188: ',', 190: '.', 191: '/', 219: '[', 221: ']', 222: "'", 189: '-', 187: '=', 192: '`', 220: '\\' };
  return named[code] ?? `鍵 ${code}`;
}

const STORE = 'jg_rt_controls';

/** 存檔時的畫面高度（舊存檔沒有＝1280）和現在不同：下半部的自訂位置跟著下緣移動，上半部不動 */
export function fitHeight(raw: unknown, h: number): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as { pos?: Record<string, { x: number; y: number }>; h?: unknown };
  const from = typeof r.h === 'number' && r.h >= 1000 ? r.h : 1280;
  if (from === h || !r.pos || typeof r.pos !== 'object') return raw;
  const pos: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r.pos)) pos[k] = v && typeof v.y === 'number' && v.y > from / 2 ? { ...v, y: v.y + h - from } : v;
  return { ...r, pos };
}

export function loadControls(): RtControls {
  try {
    return sanitize(fitHeight(JSON.parse(localStorage.getItem(STORE) ?? 'null'), H));
  } catch {
    return defaultControls();
  }
}

export function saveControls(c: RtControls): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...c, h: H }));
  } catch {
    /* 無痕模式：這次有效，下次回到預設 */
  }
}

/**
 * 營火旁那排捷徑（燼牌／行囊・強化／行商）的位置（第 43 輪）：以前寫死 x，左手模式或按鈕放大時會蓋在技能鍵上。
 * 依序試：原本的 x（撞到就往右推）→ 從左邊排 → 從右邊排；這一列都放不下就往上挪 30 再試（最多 5 次）。
 * items：每顆捷徑的寬與原本的中心 x（由左到右）；回傳每顆的中心 x 與共用的 y。
 */
export function fireRowLayout(c: RtControls, items: { w: number; x: number }[], y0: number, h: number, gap = 12): { xs: number[]; y: number } {
  const circles: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < BTN_COUNT; i++) circles.push({ ...buttonPos(c, i), r: buttonR(c, i) + 8 });
  circles.push({ ...buttonPos(c, JOY_INDEX), r: Math.round(90 * c.scale) });
  const tryRow = (y: number): number[] | null => {
    // 這一列被圓擋住的 x 區間
    const blocked: [number, number][] = [];
    for (const k of circles) {
      const dy = Math.max(0, Math.abs(k.y - y) - h / 2);
      if (dy >= k.r) continue;
      const half = Math.sqrt(k.r * k.r - dy * dy);
      blocked.push([k.x - half, k.x + half]);
    }
    const free = (a: number, b: number): boolean => a >= 8 && b <= W - 8 && blocked.every(([l, r]) => b <= l || a >= r);
    const pushRight = (a: number, w: number): number => {
      let x = a;
      for (let n = 0; n < 20; n++) {
        const hit = blocked.find(([l, r]) => !(x + w <= l || x >= r));
        if (!hit) return x;
        x = hit[1] + 1;
      }
      return x;
    };
    const pushLeft = (b: number, w: number): number => {
      let x = b;
      for (let n = 0; n < 20; n++) {
        const hit = blocked.find(([l, r]) => !(x <= l || x - w >= r));
        if (!hit) return x;
        x = hit[0] - 1;
      }
      return x;
    };
    // 1) 原位往右推　2) 從左排
    for (const start of [null, 8]) {
      const xs: number[] = [];
      let cur = 8;
      let ok = true;
      for (const it of items) {
        const a = pushRight(Math.max(cur, start === null ? it.x - it.w / 2 : cur), it.w);
        if (!free(a, a + it.w)) { ok = false; break; }
        xs.push(a + it.w / 2);
        cur = a + it.w + gap;
      }
      if (ok) return xs;
    }
    // 3) 從右排
    const xs: number[] = [];
    let cur = W - 8;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]!;
      const b = pushLeft(cur, it.w);
      if (!free(b - it.w, b)) return null;
      xs.unshift(b - it.w / 2);
      cur = b - it.w - gap;
    }
    return xs;
  };
  for (let k = 0; k < 6; k++) {
    const y = y0 - k * 30;
    const xs = tryRow(y);
    if (xs) return { xs, y };
  }
  return { xs: items.map((it) => it.x), y: y0 };
}
