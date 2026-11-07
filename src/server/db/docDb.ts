// 文件式資料庫（MemoryDb、LocalDb 共用）：整份資料放在記憶體快取，交易用「寫入暫存層」，
// commit 時一次寫回快取並交給 DocStore 持久化（IndexedDB／localStorage）。交易一次只跑一個（互斥鎖），
// 和 SQL 版的 SERIALIZABLE 交易行為一致：handler 看不出差別。
import { ApiError } from '../../net/protocol';
import type { CurrencyId } from '../../net/views';
import { CURRENCIES, TABLES, type Db, type Repos, type TableName, type Tables } from '../repos/types';

export type Change = { table: TableName; id: string; row: unknown | null };

/** 持久化層：開啟時讀回全部資料、commit 時寫入異動 */
export interface DocStore {
  load(): Promise<Partial<Record<TableName, Record<string, unknown>>>>;
  commit(changes: readonly Change[]): Promise<void>;
  close(): Promise<void>;
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

type Cache = Map<TableName, Map<string, unknown>>;

class Tx {
  readonly writes = new Map<string, Change>();
  constructor(private readonly cache: Cache) {}
  private key(t: TableName, id: string): string {
    return `${t}\u0000${id}`;
  }
  get<K extends TableName>(t: K, id: string): Tables[K] | undefined {
    const w = this.writes.get(this.key(t, id));
    if (w) return clone((w.row ?? undefined) as Tables[K] | undefined);
    return clone(this.cache.get(t)?.get(id) as Tables[K] | undefined);
  }
  put<K extends TableName>(t: K, id: string, row: Tables[K]): void {
    this.writes.set(this.key(t, id), { table: t, id, row: clone(row) });
  }
  del(t: TableName, id: string): void {
    this.writes.set(this.key(t, id), { table: t, id, row: null });
  }
  /** 掃整張表（本機資料量小；SQL 版用索引） */
  scan<K extends TableName>(t: K, pred: (row: Tables[K]) => boolean): Tables[K][] {
    const out = new Map<string, Tables[K]>();
    for (const [id, row] of this.cache.get(t) ?? []) out.set(id, row as Tables[K]);
    for (const w of this.writes.values()) {
      if (w.table !== t) continue;
      if (w.row === null) out.delete(w.id);
      else out.set(w.id, w.row as Tables[K]);
    }
    return [...out.values()].filter(pred).map(clone);
  }
}

function versioned<K extends 'characters' | 'items' | 'listings' | 'trades'>(tx: Tx, t: K, row: Tables[K]): Tables[K] {
  const cur = tx.get(t, row.id);
  if (cur && cur.version !== row.version) throw new ApiError('conflict', `${t} ${row.id} version ${row.version} != ${cur.version}`);
  const next = { ...row, version: (cur?.version ?? row.version) + (cur ? 1 : 0) };
  tx.put(t, row.id, next);
  return clone(next);
}

let ledgerSeq = 0;

function reposOf(tx: Tx, now: () => number): Repos {
  const walletId = (c: string, cur: CurrencyId) => `${c}:${cur}`;
  return {
    accounts: {
      get: async (id) => tx.get('accounts', id),
      put: async (row) => tx.put('accounts', row.id, row),
    },
    characters: {
      get: async (id) => tx.get('characters', id),
      listByAccount: async (a) => tx.scan('characters', (r) => r.accountId === a).sort((x, y) => x.slot - y.slot),
      save: async (row) => versioned(tx, 'characters', row),
      delete: async (id) => tx.del('characters', id),
    },
    items: {
      get: async (id) => tx.get('items', id),
      listByOwner: async (o) => tx.scan('items', (r) => r.ownerId === o).sort((x, y) => (x.location < y.location ? -1 : x.location > y.location ? 1 : x.pos - y.pos)),
      save: async (row) => versioned(tx, 'items', row),
      delete: async (id) => tx.del('items', id),
    },
    wallets: {
      balances: async (c) => {
        const out = { coin: 0, dust: 0, crystal: 0 } as Record<CurrencyId, number>;
        for (const cur of CURRENCIES) out[cur] = tx.get('wallets', walletId(c, cur))?.balance ?? 0;
        return out;
      },
      apply: async (c, cur, delta, reason, refId) => {
        if (!Number.isSafeInteger(delta)) throw new ApiError('bad_request', 'delta must be an integer');
        const id = walletId(c, cur);
        const w = tx.get('wallets', id) ?? { id, characterId: c, currency: cur, balance: 0, version: 0 };
        const balance = w.balance + delta;
        if (balance < 0) throw new ApiError('rejected', `not enough ${cur}`);
        tx.put('wallets', id, { ...w, balance, version: w.version + 1 });
        const at = now();
        const lid = `${at.toString(36)}-${(ledgerSeq = (ledgerSeq + 1) % 1e9).toString(36)}-${c}`;
        tx.put('ledger', lid, { id: lid, characterId: c, currency: cur, delta, balanceAfter: balance, reason, refId, at });
        return balance;
      },
      ledger: async (c) => tx.scan('ledger', (r) => r.characterId === c).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
      deleteCharacter: async (c) => {
        for (const cur of CURRENCIES) tx.del('wallets', walletId(c, cur));
        for (const l of tx.scan('ledger', (r) => r.characterId === c)) tx.del('ledger', l.id);
      },
    },
    requests: {
      get: async (id) => tx.get('requests', id),
      put: async (row) => tx.put('requests', row.id, row),
      prune: async (before) => {
        for (const r of tx.scan('requests', (x) => x.at < before)) tx.del('requests', r.id);
      },
    },
    audit: {
      add: async (row) => {
        const id = `${row.at.toString(36)}-${(ledgerSeq = (ledgerSeq + 1) % 1e9).toString(36)}`;
        tx.put('audit', id, { ...row, id });
      },
      recent: async (a, limit) =>
        tx
          .scan('audit', (r) => r.accountId === a)
          .sort((x, y) => y.at - x.at || auditSeq(y.id) - auditSeq(x.id))
          .slice(0, Math.max(0, limit))
          .map(({ accountId, action, detail, at }) => ({ accountId, action, detail, at })),
    },
    listings: {
      get: async (id) => tx.get('listings', id),
      save: async (row) => versioned(tx, 'listings', row),
      listOpen: async (q) =>
        tx
          .scan('listings', (r) => r.status === 'open' && r.expiresAt > q.aliveAt && (q.slot === undefined || r.slot === q.slot) && (q.rarity === undefined || r.rarity === q.rarity) && r.sellerAccountId !== q.excludeAccountId)
          .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
          .slice(q.offset, q.offset + q.limit),
      listBySeller: async (c, limit) => tx.scan('listings', (r) => r.sellerCharacterId === c).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1)).slice(0, limit),
      listSold: async (q) =>
        tx
          .scan('listings', (r) => r.status === 'sold' && r.slot === q.slot && r.rarity === q.rarity)
          .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0) || (a.id < b.id ? 1 : -1))
          .slice(0, q.limit),
    },
    trades: {
      get: async (id) => tx.get('trades', id),
      save: async (row) => versioned(tx, 'trades', row),
      listByCharacter: async (c, limit) => tx.scan('trades', (r) => r.aCharacterId === c || r.bCharacterId === c).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1)).slice(0, limit),
    },
  };
}

export class DocDb implements Db {
  private chain: Promise<unknown> = Promise.resolve();
  private constructor(
    private readonly store: DocStore,
    private readonly cache: Cache,
    private readonly now: () => number,
  ) {}

  static async open(store: DocStore, now: () => number): Promise<DocDb> {
    const data = await store.load();
    const cache: Cache = new Map();
    for (const t of TABLES) cache.set(t, new Map(Object.entries(data[t] ?? {})));
    return new DocDb(store, cache, now);
  }

  tx<T>(fn: (r: Repos) => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const tx = new Tx(this.cache);
      const out = await fn(reposOf(tx, this.now));
      const changes = [...tx.writes.values()];
      if (changes.length) {
        await this.store.commit(changes);
        for (const c of changes) {
          const m = this.cache.get(c.table)!;
          if (c.row === null) m.delete(c.id);
          else m.set(c.id, c.row);
        }
      }
      return out;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    await this.chain;
    await this.store.close();
  }
}

/** 稽核 id 的序號部分（`<at36>-<seq36>`；同一毫秒照寫入順序排） */
const auditSeq = (id: string): number => parseInt(id.slice(id.indexOf('-') + 1), 36) || 0;
