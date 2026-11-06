// 線上版 PvE 掉落回報（D-307）：VITE_SERVER_URL 有值時，進場 battle.start、打倒怪 loot.claim，伺服器的角色真的拿到掉落；
// 召喚物、不會掉東西的不回報。離線版（沒設）什麼都不做——那條路由 tests 其他檔案的 golden hash／通關機器人保證。
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHttp } from '../server/http';
import { DevAuth } from '../server/devAuth';
import type { Unit } from '../src/core/battle/rt/types';
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { GameServer } from '../src/server/GameServer';

let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const db = await DocDb.open(new MemoryStore(), () => Date.now());
  const game = new GameServer({ db, auth: new DevAuth(), local: false, rng: () => 0.01 });
  const http = createHttp(game, { corsOrigins: [] });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => new Promise((r) => http.close(() => r()));
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

const unit = (x: Partial<Unit>): Unit => ({ side: 'enemy', defId: 'wolf', ...x }) as Unit;

describe('線上版 PvE 掉落回報', () => {
  it('進場＋打倒狼 → 伺服器的角色拿到金幣與裝備；召喚的狼不算', async () => {
    vi.stubEnv('VITE_SERVER_URL', base);
    vi.stubEnv('VITE_AUTH_MODE', 'dev');
    const { onlineLoot, onlineLootStatus } = await import('../src/game/onlineLoot');
    const { bootServer } = await import('../src/client/boot');
    onlineLoot.start('mistwood', false, 'bow');
    onlineLoot.kill(unit({ groupId: 'entry' }));
    onlineLoot.kill(unit({ groupId: 'entry', summonedBy: 3 } as Partial<Unit>));
    onlineLoot.kill(unit({ groupId: 'entry' }));
    for (let i = 0; i < 50 && onlineLootStatus.claims < 2 && !onlineLootStatus.error; i++) await new Promise((r) => setTimeout(r, 20));
    expect(onlineLootStatus.error).toBeNull();
    expect(onlineLootStatus.claims).toBe(2);
    const { client, kind } = await bootServer();
    expect(kind).toBe('online');
    const [me] = await client.call('character.list', {});
    expect(me!.weapon).toBe('bow');
    expect(me!.wallet.coin).toBeGreaterThan(0);
    expect(me!.items.filter((i) => i.location === 'bag').length).toBe(2);
  });
});
