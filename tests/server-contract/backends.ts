// 契約測試的資料庫實作清單：同一組測試對每一個跑（之後加 mssql，CI 用 service container）。
import { IDBFactory } from 'fake-indexeddb';
import { DocDb } from '../../src/server/db/docDb';
import { MemoryStore } from '../../src/server/db/memory/MemoryDb';
import { IdbStore, KvStore } from '../../src/server/db/local/LocalDb';
import type { Db } from '../../src/server/repos/types';
import { MssqlDb } from '../../src/server/db/mssql/MssqlDb';
import { OWN_TABLES } from '../../src/server/db/mssql/schema';

/** CI 的 mssql job 設這個環境變數（service container）；本機沒有 SQL Server 就不跑這一份 */
export const MSSQL_TEST = process.env.GAME_DB_TEST_CONNECTION;

/** 簡單的 Storage（localStorage 的替身） */
export class MapStorage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

export interface Backend {
  name: string;
  /** 開一個新的空資料庫；reopen() 用同一份底層儲存再開一次（測持久化） */
  fresh(now: () => number): Promise<{ db: Db; reopen?: () => Promise<Db> }>;
}

let n = 0;
export const BACKENDS: Backend[] = [
  { name: 'memory', fresh: async (now) => ({ db: await DocDb.open(new MemoryStore(), now) }) },
  {
    name: 'local-idb',
    fresh: async (now) => {
      const idb = new IDBFactory();
      const name = `t${++n}`;
      return { db: await DocDb.open(await IdbStore.open(idb, name), now), reopen: async () => DocDb.open(await IdbStore.open(idb, name), now) };
    },
  },
  {
    name: 'local-kv',
    fresh: async (now) => {
      const st = new MapStorage();
      return { db: await DocDb.open(new KvStore(st), now), reopen: async () => DocDb.open(new KvStore(st), now) };
    },
  },
  ...(MSSQL_TEST
    ? [
        {
          name: 'mssql',
          fresh: async (now: () => number) => {
            const db = await MssqlDb.open(MSSQL_TEST, now);
            for (const t of OWN_TABLES) await db.k.deleteFrom(t).execute();
            return { db, reopen: async () => MssqlDb.open(MSSQL_TEST, now) };
          },
        } satisfies Backend,
      ]
    : []),
];
