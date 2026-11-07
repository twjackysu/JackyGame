// 競技場（V5 非同步 PvP 天梯，24 §6.2）的畫面層橋接：開局（種子、雙方配裝、對手）與勝負判定都在伺服器。
// 畫面只在本機用同一份引擎打、記下自己的指令（pvpMatch.playPvp 的即時版），打完把紀錄交給伺服器重跑。
// PvP 不改錢包與行囊（獎勵只有段位稱號），所以 legacyOp 不寫回任何欄位。
import type { PvpInputs, PvpMatchSetup } from '../core/battle/rt/pvpMatch';
import type { PvpLadderView } from '../net/views';
import { captureLegacy, legacyOp } from '../client/legacyOps';
import { setRank } from './rankCache';

export interface PvpOpen {
  matchId: string;
  setup: PvpMatchSetup;
  foeName: string;
  foeRating: number;
  rating: number;
}
export interface PvpResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  rating: number;
  delta: number;
}

export const pvpOps = {
  /** 天梯排行（只讀；一樣先同步舊存檔，角色才會是最新的） */
  ladder: (): Promise<PvpLadderView | null> =>
    legacyOp(captureLegacy(), [], async (c, me) => ({ v: await c.call('pvp.ladder', { characterId: me.id }), me }), (r) => r.me, true).then((r) => {
      if (r) setRank(r.v.rating);
      return r?.v ?? null;
    }),
  /** 開一局（伺服器挑對手、發種子；foeId＝天梯上指名挑戰）；伺服器壞了或不能挑回 null */
  start: (foeId?: string): Promise<PvpOpen | null> =>
    legacyOp(
      captureLegacy(),
      [],
      async (c, me) => {
        const v = await c.call('pvp.start', { characterId: me.id, ...(foeId ? { foeId } : {}) });
        const open: PvpOpen = { matchId: v.matchId, setup: { seed: v.seed, me: v.me, foe: v.foe }, foeName: v.foeName, foeRating: v.foeRating, rating: v.rating };
        return { open, me };
      },
      (r) => r.me,
      true,
    ).then((r) => {
      if (r) setRank(r.open.rating);
      return r?.open ?? null;
    }),
  /** 交出指令紀錄，伺服器重跑判勝負；紀錄被拒（rejected）或伺服器壞了回 null */
  finish: (matchId: string, inputs: PvpInputs): Promise<PvpResult | null> =>
    legacyOp(
      captureLegacy(),
      [],
      async (c, me) => ({ res: await c.call('pvp.finish', { characterId: me.id, matchId, inputs }), me }),
      (r) => r.me,
      true,
    ).then((r) => {
      if (r) setRank(r.res.rating);
      return r?.res ?? null;
    }),
};
