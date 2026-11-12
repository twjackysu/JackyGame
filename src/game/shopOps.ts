// 行商的畫面層橋接（第 153 輪，從 RtBattleScene 搬出；跟 marketOps／warehouseOps 同一套）：
// 畫面只送意圖，價格、庫存、扣款、勝負、獎金都由伺服器決定（D-285、D-289）；結果寫回舊 key（authoritative），呼叫的場景再重讀。
import { captureLegacy, legacyOp } from '../client/legacyOps';
import type { ShopIntent } from './ui/rtShopPanel';

export const shopOps = {
  /** 行商的一個動作（買／買了直接穿、賣、雜貨、補貨）；region＝在哪張地圖的行商。伺服器壞了或拒絕回 null */
  deal: (intent: ShopIntent, region: string): Promise<true | null> =>
    legacyOp(
      captureLegacy(),
      ['items', 'wallet', 'shop'],
      async (c, me) => {
        const itemOf = (uid: string) => {
          const it = me.items.find((i) => i.gear.uid === uid);
          if (!it) throw new Error('item not synced');
          return it.id;
        };
        if (intent.kind === 'goods') return c.call('shop.buyGoods', { characterId: me.id, goodsId: intent.id });
        if (intent.kind === 'reroll') return (await c.call('shop.reroll', { characterId: me.id, region })).character;
        if (intent.kind === 'sell') return (await c.call('shop.sell', { characterId: me.id, itemIds: intent.uids.map(itemOf) })).character;
        const v = (await c.call('shop.buy', { characterId: me.id, region, uid: intent.uid })).character;
        if (!intent.wear) return v;
        const mine = v.items.filter((i) => i.location === 'bag').sort((a, b) => a.pos - b.pos)[0]!;
        return c.call('inventory.equip', { characterId: me.id, itemId: mine.id });
      },
      (v) => v,
      true,
    ).then((v) => (v ? true : null)),
};
