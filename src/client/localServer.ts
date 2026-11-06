// 開機時建立「遊戲裡的伺服器」（本機版）：LocalDb → GameServer → LocalTransport → GameClient。
// 畫面層只拿到 GameClient；上線版把這個檔案換成連 WsTransport 的版本（server 程式不會被打包進去）。
import { LocalTransport } from '../net/LocalTransport';
import { LOCAL_TOKEN, LocalAuth } from '../server/auth';
import { systemClock } from '../server/clock';
import { openLocalDb } from '../server/db/local/LocalDb';
import { GameServer } from '../server/GameServer';
import { GameClient } from './GameClient';

export interface LocalStack {
  client: GameClient;
  kind: 'idb' | 'kv' | 'memory';
}

export async function startLocalServer(): Promise<LocalStack> {
  const { db, kind } = await openLocalDb(() => systemClock.now());
  const server = new GameServer({ db, auth: new LocalAuth(), local: true, sim: true });
  const client = new GameClient(new LocalTransport((j) => server.handle(j)), { token: LOCAL_TOKEN });
  return { client, kind };
}
