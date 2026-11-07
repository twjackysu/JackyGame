// 對帳函式本身（第 154 輪，26 §3.3）：餘額和帳本對不上、或某一行 balanceAfter 接不起來都要抓到。
import { describe, expect, it } from 'vitest';
import { reconcileCharacter, runLedgerAudit } from '../src/server/ledgerCheck';
import type { LedgerRow, Repos } from '../src/server/repos/types';

const fake = (bal: Record<string, number>, rows: Omit<LedgerRow, 'characterId' | 'at' | 'reason'>[]): Repos =>
  ({ wallets: { balances: async () => bal, ledger: async () => rows.map((r) => ({ ...r, characterId: 'c', at: 0, reason: 'x' })) } }) as unknown as Repos;

describe('reconcileCharacter', () => {
  it('對得上回空陣列', async () => {
    expect(await reconcileCharacter(fake({ coin: 70, dust: 0, crystal: 0 }, [{ id: '1', currency: 'coin', delta: 100, balanceAfter: 100 }, { id: '2', currency: 'coin', delta: -30, balanceAfter: 70 }]), 'c')).toEqual([]);
  });
  it('餘額被直接改（帳本沒有那筆）', async () => {
    expect(await reconcileCharacter(fake({ coin: 9999, dust: 0, crystal: 0 }, [{ id: '1', currency: 'coin', delta: 100, balanceAfter: 100 }]), 'c')).toEqual([{ characterId: 'c', currency: 'coin', balance: 9999, ledgerSum: 100 }]);
  });
  it('中間某一行 balanceAfter 接不起來', async () => {
    const r = await reconcileCharacter(fake({ coin: 70, dust: 5, crystal: 0 }, [{ id: '1', currency: 'coin', delta: 100, balanceAfter: 100 }, { id: '2', currency: 'dust', delta: 5, balanceAfter: 5 }, { id: '3', currency: 'coin', delta: -30, balanceAfter: 80 }]), 'c');
    expect(r).toEqual([{ characterId: 'c', currency: 'coin', balance: 70, ledgerSum: 70, brokenAt: '3' }]);
  });
});

describe('runLedgerAudit', () => {
  it('對不上的角色寫一行稽核 ledger.mismatch（帶帳號）、回傳全部不符', async () => {
    const audits: { accountId: string; action: string; detail: string; at: number }[] = [];
    const repos = {
      wallets: { activeSince: async () => ['c1', 'c2'], balances: async (c: string) => ({ coin: c === 'c1' ? 50 : 10, dust: 0, crystal: 0 }), ledger: async (c: string) => [{ id: '1', characterId: c, currency: 'coin', delta: 10, balanceAfter: 10, reason: 'x', at: 0 }] },
      characters: { get: async (id: string) => ({ id, accountId: `acc-${id}` }) },
      audit: { add: async (row: (typeof audits)[number]) => void audits.push(row) },
    } as unknown as Repos;
    const db = { tx: <T>(fn: (r: Repos) => Promise<T>) => fn(repos), close: async () => {} };
    const bad = await runLedgerAudit(db, 0, 123);
    expect(bad).toEqual([{ characterId: 'c1', currency: 'coin', balance: 50, ledgerSum: 10 }]);
    expect(audits).toEqual([{ accountId: 'acc-c1', action: 'ledger.mismatch', detail: JSON.stringify(bad[0]), at: 123 }]);
  });
});
