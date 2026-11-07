// V6 驗收（23 §5「本機 server/ 整合測試：兩個客戶端交易＋PvP」，第 148 輪）：
// 真的起 node:http 伺服器（記憶體資料庫、DevAuth、頻率限制、local: false＝跟線上一樣沒有模擬玩家），兩個帳號用 HttpTransport 從零開始：
// 打怪拿掉落（伺服器擲）→ 拍賣所上架／購買 → 面對面交易換回來 → 競技場打一場（伺服器重跑判勝負）。物品與金幣總數全程對得上。
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttp } from '../server/http';
import { DevAuth } from '../server/devAuth';
import { GameClient } from '../src/client/GameClient';
import { playPvp } from '../src/core/battle/rt/pvpMatch';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleCommandBody } from '../src/core/battle/rt/types';
import { listFee, sellerGets } from '../src/core/meta/market';
import { stageDef } from '../src/core/battle/rt/maps/world';
import { HttpTransport } from '../src/net/HttpTransport';
import { ApiError } from '../src/net/protocol';
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { GameServer } from '../src/server/GameServer';
import { RateLimiter } from '../src/server/rateLimit';

let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const db = await DocDb.open(new MemoryStore(), () => Date.now());
  const game = new GameServer({ db, auth: new DevAuth(), limiter: new RateLimiter(), local: false });
  const http = createHttp(game, { corsOrigins: [] });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => new Promise((r) => http.close(() => r()));
});
afterAll(() => close());

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};
/** 交易類每秒 2 次（rateLimit.ts）：連續的交易動作之間等一下，像真人按按鈕 */
const breath = () => new Promise((r) => setTimeout(r, 550));

describe('兩個客戶端走完線上的一天（HTTP）', () => {
  it('打怪 → 拍賣所 → 面對面交易 → 競技場', async () => {
    let n = 0;
    const mk = (token: string) => new GameClient(new HttpTransport(`${base}/api`), { token, timeoutMs: 8000, retries: 2, newRequestId: () => `${token}-${++n}` });
    const a = mk('dev:flow_alice');
    const b = mk('dev:flow_bob');
    const A = await a.call('character.create', { name: '艾薇', weapon: 'bow' });
    const B = await b.call('character.create', { name: '洛恩', weapon: 'sword' });

    // 1) 打怪：A 打倒狼王（第一次保底稀有），B 打幾隻狼拿金幣——數量與稀有度都是伺服器擲的
    const ba = await a.call('battle.start', { characterId: A.id, stageId: 'mistwood' });
    const boss = await a.call('loot.claim', { characterId: A.id, battleId: ba.battleId, killSeq: 1, enemyId: 'wolf_king', fixedIdx: 0 });
    const rare = boss.drops.find((d) => d.kind === 'gear' && d.rarity === 3);
    expect(rare?.itemId).toBeTruthy();
    // 同一隻 Boss 馬上再申請：數量上限擋下
    expect(await code(a.call('loot.claim', { characterId: A.id, battleId: ba.battleId, killSeq: 2, enemyId: 'wolf_king', fixedIdx: 0 }))).toBe('rejected');
    const bb = await b.call('battle.start', { characterId: B.id, stageId: 'mistwood' });
    const groups = stageDef('mistwood')!.spawnGroups!.filter((g) => g.enemyId === 'wolf' && !g.nightOnly);
    let bv = B;
    for (let i = 0; i < 8; i++) bv = (await b.call('loot.claim', { characterId: B.id, battleId: bb.battleId, killSeq: i + 1, enemyId: 'wolf', groupId: groups[i % groups.length]!.id })).character;
    expect(bv.wallet.coin).toBeGreaterThan(1);
    const coinA0 = boss.character.wallet.coin;
    const coinB0 = bv.wallet.coin;

    // 2) 拍賣所：A 上架稀有裝，B 看得到、買得起就買
    const price = Math.max(1, Math.floor(coinB0 / 2));
    const listed = await a.call('market.list', { characterId: A.id, itemId: rare!.itemId!, price });
    expect(listed.character.wallet.coin).toBe(coinA0 - listFee(price));
    await breath();
    const page = await b.call('market.browse', {});
    const l = page.listings.find((x) => x.id === listed.listing.id);
    expect(l).toMatchObject({ price, mine: false, sellerName: '艾薇' });
    const bought = await b.call('market.buy', { characterId: B.id, listingId: l!.id });
    expect(bought.wallet.coin).toBe(coinB0 - price);
    expect(bought.items.some((i) => i.id === rare!.itemId && i.location === 'bag')).toBe(true);
    const meA = await a.call('character.get', { id: A.id });
    expect(meA.wallet.coin).toBe(coinA0 - listFee(price) + sellerGets(price));
    expect(meA.items.some((i) => i.id === rare!.itemId)).toBe(false);
    // 已經賣掉的不能再買
    await breath();
    expect(await code(b.call('market.buy', { characterId: B.id, listingId: l!.id }))).not.toBe('ok');

    // 3) 面對面交易：B 把裝備賣回給 A（A 付金幣），雙方鎖定、對同一版確認才交換
    await breath();
    const { trade } = await b.call('trade.open', { characterId: B.id, partnerCharacterId: A.id });
    await breath();
    await b.call('trade.offer', { characterId: B.id, tradeId: trade.id, items: [rare!.itemId!], coin: 0 });
    const back = Math.min(meA.wallet.coin, price);
    await a.call('trade.offer', { characterId: A.id, tradeId: trade.id, items: [], coin: back });
    await breath();
    await b.call('trade.lock', { characterId: B.id, tradeId: trade.id });
    const locked = await a.call('trade.lock', { characterId: A.id, tradeId: trade.id });
    expect(locked.trade.locked).toEqual({ me: true, them: true });
    await breath();
    await a.call('trade.confirm', { characterId: A.id, tradeId: trade.id, rev: locked.trade.rev });
    const done = await b.call('trade.confirm', { characterId: B.id, tradeId: trade.id, rev: locked.trade.rev });
    expect(done.trade.status).toBe('done');
    const fa = await a.call('character.get', { id: A.id });
    const fb = await b.call('character.get', { id: B.id });
    expect(fa.items.some((i) => i.id === rare!.itemId && i.location === 'bag')).toBe(true);
    expect(fb.items.some((i) => i.id === rare!.itemId)).toBe(false);
    // 金幣守恆：兩人總和＝打怪拿到的 − 上架費 − 拍賣所抽成
    expect(fa.wallet.coin + fb.wallet.coin).toBe(coinA0 + coinB0 - listFee(price) - (price - sellerGets(price)));

    // 4) 競技場：A 開一場、本機用 Bot 打完送指令紀錄，伺服器重跑判勝負；B 碰不到 A 的對局
    const st = await a.call('pvp.start', { characterId: A.id });
    expect(await code(b.call('pvp.finish', { characterId: A.id, matchId: st.matchId, inputs: [] }))).toBe('not_found');
    const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
    const local = playPvp({ seed: st.seed, me: st.me, foe: st.foe }, (s) => bot.decide(s) as BattleCommandBody[]);
    const res = await a.call('pvp.finish', { characterId: A.id, matchId: st.matchId, inputs: local.inputs });
    expect(res.outcome).toBe(local.s.outcome);
    expect((await a.call('pvp.ladder', { characterId: A.id })).rating).toBe(res.rating);
  }, 60000);
});
