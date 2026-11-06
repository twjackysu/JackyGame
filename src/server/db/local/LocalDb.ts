// 本機版資料庫（D-277）：IndexedDB（一個 object store 存所有表，key＝"表\0id"）；
// 瀏覽器沒有 IndexedDB（舊 WebView、部分無痕模式）就退回 localStorage（key 前綴 jgdb:）。
// 這是 src/server 裡唯一碰瀏覽器儲存的地方；線上版換成 db/mssql，不會打包這個檔案。
import { DocDb, type Change, type DocStore } from '../docDb';
import { MemoryStore } from '../memory/MemoryDb';
import { TABLES, type TableName } from '../../repos/types';

const SEP = '\u0000';
type Loaded = Partial<Record<TableName, Record<string, unknown>>>;

function into(out: Loaded, key: string, row: unknown): void {
  const i = key.indexOf(SEP);
  if (i < 0) return;
  const t = key.slice(0, i) as TableName;
  if (!TABLES.includes(t)) return;
  (out[t] ??= {})[key.slice(i + 1)] = row;
}

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });

export class IdbStore implements DocStore {
  private constructor(private readonly db: IDBDatabase) {}
  static readonly STORE = 'rows';

  static async open(idb: IDBFactory, name: string): Promise<IdbStore> {
    const r = idb.open(name, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(IdbStore.STORE)) r.result.createObjectStore(IdbStore.STORE);
    };
    return new IdbStore(await req(r));
  }

  async load(): Promise<Loaded> {
    const t = this.db.transaction(IdbStore.STORE, 'readonly').objectStore(IdbStore.STORE);
    const [keys, rows] = await Promise.all([req(t.getAllKeys()), req(t.getAll())]);
    const out: Loaded = {};
    keys.forEach((k, i) => into(out, String(k), rows[i]));
    return out;
  }

  commit(changes: readonly Change[]): Promise<void> {
    return new Promise((ok, fail) => {
      // relaxed：不等 fsync（面板動作要即時；本機單人存檔，當機最多掉最後一筆，過渡期舊 key 也還在）
      const tx = this.db.transaction(IdbStore.STORE, 'readwrite', { durability: 'relaxed' });
      const st = tx.objectStore(IdbStore.STORE);
      for (const c of changes) {
        const k = `${c.table}${SEP}${c.id}`;
        if (c.row === null) st.delete(k);
        else st.put(c.row, k);
      }
      tx.oncomplete = () => ok();
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/** localStorage 版（退路）：每列一個 key；一次 commit 寫多個 key 不是原子的，但本機單一分頁可以接受 */
export class KvStore implements DocStore {
  constructor(
    private readonly kv: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>,
    private readonly prefix = 'jgdb:',
  ) {}
  async load(): Promise<Loaded> {
    const out: Loaded = {};
    for (let i = 0; i < this.kv.length; i++) {
      const k = this.kv.key(i);
      if (!k?.startsWith(this.prefix)) continue;
      try {
        into(out, k.slice(this.prefix.length), JSON.parse(this.kv.getItem(k) ?? 'null'));
      } catch {
        /* 壞掉的列略過 */
      }
    }
    return out;
  }
  async commit(changes: readonly Change[]): Promise<void> {
    for (const c of changes) {
      const k = `${this.prefix}${c.table}${SEP}${c.id}`;
      if (c.row === null) this.kv.removeItem(k);
      else this.kv.setItem(k, JSON.stringify(c.row));
    }
  }
  async close(): Promise<void> {}
}

/** 開啟本機資料庫：先試 IndexedDB，不行就用 localStorage，再不行（無痕模式全擋）只放記憶體 */
export async function openLocalDb(now: () => number, env: { indexedDB?: IDBFactory; localStorage?: Storage } = globalThis as never, name = 'jackygame'): Promise<{ db: DocDb; kind: 'idb' | 'kv' | 'memory' }> {
  if (env.indexedDB) {
    try {
      return { db: await DocDb.open(await IdbStore.open(env.indexedDB, name), now), kind: 'idb' };
    } catch {
      /* 往下退 */
    }
  }
  if (env.localStorage) {
    try {
      env.localStorage.setItem('jgdb:probe', '1');
      env.localStorage.removeItem('jgdb:probe');
      return { db: await DocDb.open(new KvStore(env.localStorage), now), kind: 'kv' };
    } catch {
      /* 往下退 */
    }
  }
  return { db: await DocDb.open(new MemoryStore(), now), kind: 'memory' };
}
