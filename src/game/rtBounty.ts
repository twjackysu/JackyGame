// 營地懸賞（D-109）：同時掛 3 張「打倒 X 隻 Y」，完成自動領粉塵／結晶、立刻換一張新的。
// 純資料函式（有測試）；存在霧語森林獨立紀錄 `RtRecord.bounty`。
export interface Bounty {
  /** 第幾張（決定內容，同編號同結果） */
  n: number;
  target: string;
  need: number;
  got: number;
  reward: { dust: number; crystal: number };
}

export interface BountyState {
  list: Bounty[];
  /** 下一張的編號 */
  next: number;
  /** 累計完成張數 */
  done: number;
}

/** 懸賞池：數量範圍與獎勵（深夜限定的怪不列，白天也要能完成） */
export const BOUNTY_POOL: readonly { target: string; need: [number, number]; reward: { dust: number; crystal: number } }[] = [
  { target: 'wolf', need: [12, 20], reward: { dust: 6, crystal: 0 } },
  { target: 'thorn_shooter', need: [4, 6], reward: { dust: 6, crystal: 0 } },
  { target: 'alpha_wolf', need: [2, 3], reward: { dust: 4, crystal: 1 } },
  { target: 'thorn_mother', need: [1, 1], reward: { dust: 4, crystal: 1 } },
  { target: 'wolf_king', need: [1, 1], reward: { dust: 6, crystal: 2 } },
];

export const BOUNTY_SLOTS = 3;

const BOUNTY_ALIAS: Readonly<Record<string, string>> = { thorn_wolf: 'wolf', thorn_queen: 'wolf_king', thorn_stalker: 'alpha_wolf', mist_warden: 'alpha_wolf', ember_wolf: 'wolf', ember_shroom: 'thorn_shooter', obsidian_alpha: 'alpha_wolf', magma_stalker: 'alpha_wolf', ember_colossus: 'wolf_king' };

function hash(n: number): number {
  let x = (Math.imul(n + 1, 2654435761) ^ 0x5bd1e995) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

/** 第 n 張懸賞；avoid 裡的目標跳過（同時掛著的三張不重複） */
export function makeBounty(n: number, avoid: readonly string[] = []): Bounty {
  const h = hash(n);
  const pool = BOUNTY_POOL.filter((p) => !avoid.includes(p.target));
  const p = (pool.length ? pool : BOUNTY_POOL)[h % (pool.length || BOUNTY_POOL.length)]!;
  const need = p.need[0] + ((h >>> 8) % (p.need[1] - p.need[0] + 1));
  return { n, target: p.target, need, got: 0, reward: { ...p.reward } };
}

function fill(st: BountyState): BountyState {
  const list = [...st.list];
  let next = st.next;
  while (list.length < BOUNTY_SLOTS) list.push(makeBounty(next++, list.map((b) => b.target)));
  return { list, next, done: st.done };
}

/** 讀檔時檢查形狀；壞資料或沒有就重新開始 */
export function cleanBounties(raw: unknown): BountyState {
  const r = raw as Partial<BountyState> | undefined;
  const ok = (b: unknown): b is Bounty => {
    const x = b as Bounty;
    return !!x && Number.isInteger(x.n) && BOUNTY_POOL.some((p) => p.target === x.target) && Number.isInteger(x.need) && x.need > 0 && Number.isInteger(x.got) && x.got >= 0 && x.got < x.need && !!x.reward;
  };
  const list = Array.isArray(r?.list) ? r.list.filter(ok).slice(0, BOUNTY_SLOTS) : [];
  const next = Number.isInteger(r?.next) && (r!.next as number) >= 0 ? (r!.next as number) : 0;
  const done = Number.isInteger(r?.done) && (r!.done as number) >= 0 ? (r!.done as number) : 0;
  return fill({ list, next: Math.max(next, ...list.map((b) => b.n + 1)), done });
}

/** 打倒一隻 defId：對應的懸賞 +1；完成的移除、補新的，回傳完成的那些 */
export function bountyKill(st: BountyState, defId0: string): { st: BountyState; completed: Bounty[] } {
  // 懸賞和荊棘谷共用（D-114）：棘背狼算野狼、棘冠狼后算 Boss 懸賞
  const defId = BOUNTY_ALIAS[defId0] ?? defId0;
  if (!st.list.some((b) => b.target === defId)) return { st, completed: [] };
  const completed: Bounty[] = [];
  const list: Bounty[] = [];
  for (const b of st.list) {
    if (b.target !== defId) {
      list.push(b);
      continue;
    }
    const got = b.got + 1;
    if (got >= b.need) completed.push({ ...b, got });
    else list.push({ ...b, got });
  }
  return { st: fill({ list, next: st.next, done: st.done + completed.length }), completed };
}
