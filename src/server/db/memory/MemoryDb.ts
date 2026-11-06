// 測試用：資料只在記憶體（關掉就沒了）
import { DocDb, type DocStore } from '../docDb';

export class MemoryStore implements DocStore {
  async load() {
    return {};
  }
  async commit(): Promise<void> {}
  async close(): Promise<void> {}
}

export const openMemoryDb = (now: () => number): Promise<DocDb> => DocDb.open(new MemoryStore(), now);
