// 產生 src/core/fixedMath.ts 的常數表（V1 Q1，D-280）。
// 表是數字字面值：解析字面值在所有 JS 引擎都得到同一個 IEEE 雙精度數，
// 所以核心不再呼叫 Math.sin／cos／asin／pow（不同引擎最後一位可能不同）。
// 用法：node scripts/gen-fixed-math.mjs（只有要改解析度或 XP 曲線時才需要重跑）
import { writeFileSync } from 'node:fs';
const STEPS = 720; // 半度一格
const sin = Array.from({ length: STEPS }, (_, i) => {
  const v = Math.sin((i / STEPS) * Math.PI * 2);
  return Math.abs(v) < 1e-12 ? 0 : v;
});
// 四個象限的端點強制成精確值
sin[0] = 0; sin[180] = 1; sin[360] = 0; sin[540] = -1;
const XP_LEVELS = 100;
const xp = Array.from({ length: XP_LEVELS + 1 }, (_, lv) => (lv <= 1 ? 40 : Math.round(60 * Math.pow(lv, 1.7))));
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push('  ' + arr.slice(i, i + n).map(String).join(', ') + ','); return out.join('\n'); };
const src = `// 由 scripts/gen-fixed-math.mjs 產生，不要手改（D-280）。
// 確定性數學：核心（src/core）只准用 + − × ÷、Math.sqrt（IEEE 規定要正確捨入）、floor／round／abs／min／max 和這裡的常數表，
// 伺服器（Node）重跑客戶端（手機瀏覽器）的指令紀錄時結果才會一模一樣。

/** 一圈切成幾格（半度一格） */
export const ANGLE_STEPS = ${STEPS};
/** 角度格數：90° */
export const QUARTER = ${STEPS / 4};

const SIN: readonly number[] = [
${chunk(sin, 6)}
];

const wrap = (i: number): number => ((i % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
/** sin（角度用格數，0～ANGLE_STEPS 一圈） */
export const sinStep = (i: number): number => SIN[wrap(i)]!;
/** cos（角度用格數） */
export const cosStep = (i: number): number => SIN[wrap(i + QUARTER)]!;
/** 0～1 的亂數 → 隨機角度格數 */
export const randStep = (r: number): number => Math.min(ANGLE_STEPS - 1, Math.floor(r * ANGLE_STEPS));
/** 圓周上第 k 個（共 n 個）等分點的角度格數 */
export const evenStep = (k: number, n: number): number => wrap(Math.round((k * ANGLE_STEPS) / n));
/** 角度（度；要是 0.5 的倍數）→ 格數 */
export const degStep = (deg: number): number => Math.round((deg * ANGLE_STEPS) / 360);

/**
 * 扇形命中：向量 (vx,vy)（長度 d>pr）和朝向單位向量 (fx,fy) 的夾角 ≤ 半角＋asin(pr/d)。
 * 用 cos(α+β)＝cosα·cosβ − sinα·sinβ 展開，不用反三角函式；α+β 超過 180° 時和舊版一樣夾到 π。
 */
export function inSectorAngle(vx: number, vy: number, d: number, fx: number, fy: number, deg: number, pr: number): boolean {
  const cos = (vx * fx + vy * fy) / d;
  // 超過半圈＝夾到 180°：舊版是 cos >= cos(π) = -1（朝向向量不是精確單位長，正後方可能算出 < -1，照舊不中）
  if (deg >= 360) return cos >= -1;
  const a = degStep(deg / 2);
  const sinA = sinStep(a);
  const cosA = cosStep(a);
  const sinB = Math.min(1, pr / d);
  if (a >= QUARTER && sinB >= sinA) return cos >= -1;
  const cosB = Math.sqrt(1 - sinB * sinB);
  return cos >= cosA * cosB - sinA * sinB;
}

const XP: readonly number[] = [
${chunk(xp, 10)}
];
/** 升到下一級要的經驗＝round(60 × level^1.7)（Lv1＝40，D-165）；表到 Lv${XP_LEVELS} */
export const xpCurve = (level: number): number => XP[Math.max(0, Math.min(${XP_LEVELS}, Math.floor(level)))]!;
`;
writeFileSync(new URL('../src/core/fixedMath.ts', import.meta.url), src);
console.log('wrote src/core/fixedMath.ts');
