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
    // 角色快取（第 147 輪）：HUD 讀它，要跟伺服器一樣
    const { characterCache } = await import('../src/client/characterCache');
    expect(characterCache.get()?.id).toBe(me!.id);
    expect(characterCache.wallet('coin')).toBe(me!.wallet.coin);
    expect(characterCache.get()?.xp).toBe(me!.xp);
    // 相遇「取」（第 147 輪）：伺服器發 60 金，快取跟著
    const coin0 = me!.wallet.coin;
    onlineLoot.meet('mw_hunter', 'take', 'bow');
    for (let i = 0; i < 50 && characterCache.wallet('coin') === coin0; i++) await new Promise((r) => setTimeout(r, 20));
    expect(characterCache.wallet('coin')).toBe(coin0 + 60);
    expect(onlineLootStatus.error).toBeNull();
    // 寶箱（第 148 輪）：白天的開過再開是 conflict「opened」——不是夜光的「還沒補滿」，不叫 refilling
    const { stageDef } = await import('../src/core/battle/rt/maps/world');
    const day = stageDef('mistwood')!.chests!.find((c) => !c.nightOnly)!;
    let refills = 0;
    onlineLoot.chest(day.id, () => refills++);
    for (let i = 0; i < 50 && onlineLootStatus.chests < 1; i++) await new Promise((r) => setTimeout(r, 20));
    expect(onlineLootStatus.chests).toBe(1);
    onlineLoot.chest(day.id, () => refills++);
    for (let i = 0; i < 50 && !onlineLootStatus.error; i++) await new Promise((r) => setTimeout(r, 20));
    expect(onlineLootStatus.error).toBe('opened');
    expect(refills).toBe(0);
  });
});
