// 帳本對帳（第 154 輪，26-security §3.3）：錢包餘額必須等於帳本異動加總，而且每一行的 balanceAfter 要接得起來。
// 金錢只能透過 wallets.apply（同時寫餘額與一行帳）異動；對不上＝有人繞過了它（或資料庫被直接改）→ 告警、記稽核。
// 純讀取。給上線後的每日排程用（server/main.ts 之後接 cron），現在由契約測試在每種資料庫上跑完整流程後檢查。
import type { CurrencyId } from '../net/views';
import { CURRENCIES, type Repos } from './repos/types';

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
