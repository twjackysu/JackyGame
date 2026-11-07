// 帳本對帳（第 154 輪，26-security §3.3）：錢包餘額必須等於帳本異動加總，而且每一行的 balanceAfter 要接得起來。
// 金錢只能透過 wallets.apply（同時寫餘額與一行帳）異動；對不上＝有人繞過了它（或資料庫被直接改）→ 告警、記稽核。
// 純讀取。給上線後的每日排程用（server/main.ts 之後接 cron），現在由契約測試在每種資料庫上跑完整流程後檢查。
import type { CurrencyId } from '../net/views';
import { CURRENCIES, type Db, type Repos } from './repos/types';

export interface LedgerMismatch {
  characterId: string;
  currency: CurrencyId;
  /** 錢包餘額 */
  balance: number;
  /** 帳本加總 */
  ledgerSum: number;
  /** 哪一行帳的 balanceAfter 接不起來（沒有＝每行都對，只是總數不對） */
  brokenAt?: string;
}

export async function reconcileCharacter(r: Repos, characterId: string): Promise<LedgerMismatch[]> {
  const bal = await r.wallets.balances(characterId);
  const rows = await r.wallets.ledger(characterId);
  const out: LedgerMismatch[] = [];
  for (const cur of CURRENCIES) {
    let sum = 0;
    let brokenAt: string | undefined;
    for (const l of rows) {
      if (l.currency !== cur) continue;
      sum += l.delta;
      if (brokenAt === undefined && l.balanceAfter !== sum) brokenAt = l.id;
    }
    const balance = bal[cur] ?? 0;
    if (balance !== sum || brokenAt !== undefined) out.push({ characterId, currency: cur, balance, ledgerSum: sum, ...(brokenAt !== undefined ? { brokenAt } : {}) });
  }
  return out;
}

/** 一次最多對幾個角色（一天的量；超過的下一次再對，從 since 往後的照角色 id 排） */
export const LEDGER_AUDIT_MAX = 5000;

/**
 * 每日對帳（D-334）：since 之後有記帳的角色逐一對帳，對不上的每一筆寫一行稽核 `ledger.mismatch`。
 * 每個角色各自一個資料庫交易（不把整批鎖在一起）。回傳全部對不上的。
 */
export async function runLedgerAudit(db: Db, since: number, now: number): Promise<LedgerMismatch[]> {
  const ids = await db.tx((r) => r.wallets.activeSince(since, LEDGER_AUDIT_MAX));
  const all: LedgerMismatch[] = [];
  for (const id of ids) {
    const bad = await db.tx(async (r) => {
      const m = await reconcileCharacter(r, id);
      if (m.length) {
        const c = await r.characters.get(id);
        for (const x of m) await r.audit.add({ accountId: c?.accountId ?? '?', action: 'ledger.mismatch', detail: JSON.stringify(x), at: now });
      }
      return m;
    });
    all.push(...bad);
  }
  return all;
}
