// 拍賣所（V4，24 §4.1）的畫面層橋接：每個動作都交給伺服器（上架費、手續費、物品換主人、模擬玩家都在伺服器），
// 結果「以伺服器為準」寫回舊 key（legacyOp authoritative，D-285）。拍賣所沒有本機舊做法：伺服器壞了就顯示失敗。
// 注意：模擬玩家只在 market.browse／mine 時補跑，可能剛好買走你的掛單 → 每個動作最後都帶回最新的角色並寫回錢包，
// 不然下一次別的面板 migrate.sync 會用舊 key 的金幣蓋掉賣掉的收入。
import type { GearSlot } from '../core/battle/rt/gear';
import type { CharacterView, ListingView } from '../net/views';
import { captureLegacy, legacyOp } from '../client/legacyOps';
import { ApiError } from '../net/protocol';

export interface MarketPage {
  listings: ListingView[];
  page: number;
  /** 這頁各「部位:稀有度」最近成交的中位數（第 154 輪，D-333；成交太少的沒有） */
  refs: Record<string, number>;
  /** 我的掛單（開著的在前） */
  mine: ListingView[];
  /** 上次看過之後才賣出的掛單（伺服器算，第 149 輪） */
  news: ListingView[];
  character: CharacterView;
  /** 這次的動作被伺服器拒絕（錢不夠、已經被買走…）：錯誤碼與訊息；畫面照樣更新 */
  failed?: string;
}

const itemIdOf = (me: CharacterView, uid: string): string => {
  const it = me.items.find((i) => i.location === 'bag' && i.gear.uid === uid);
  if (!it) throw new Error('item not synced');
  return it.id;
};

const sortMine = (ls: ListingView[]): ListingView[] => [...ls].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.createdAt - a.createdAt);

/** 做一個動作（可以沒有），然後重新看一頁市場＋我的掛單；全部在同一個 legacyOp 裡，寫回一次 */
function step(act: ((c: Parameters<Parameters<typeof legacyOp>[2]>[0], me: CharacterView) => Promise<unknown>) | null, slot: GearSlot | undefined, page: number): Promise<MarketPage | null> {
  return legacyOp(
    captureLegacy(),
    ['items', 'wallet'],
    async (c, me) => {
      let failed: string | undefined;
      if (act)
        try {
          await act(c, me);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code === 'internal') throw e;
          failed = e.message;
        }
      const b = await c.call('market.browse', slot ? { slot, page, refs: true } : { page, refs: true });
      const m = await c.call('market.mine', { characterId: me.id });
      return { listings: b.listings, page: b.page, refs: b.refs ?? {}, mine: sortMine(m.listings), news: m.news ?? [], character: m.character, failed };
    },
    (r) => r.character,
    true,
  );
}

export const marketOps = {
  view: (slot: GearSlot | undefined, page: number) => step(null, slot, page),
  list: (uid: string, price: number, slot: GearSlot | undefined, page: number) => step((c, me) => c.call('market.list', { characterId: me.id, itemId: itemIdOf(me, uid), price }), slot, page),
  cancel: (listingId: string, slot: GearSlot | undefined, page: number) => step((c, me) => c.call('market.cancel', { characterId: me.id, listingId }), slot, page),
  buy: (listingId: string, slot: GearSlot | undefined, page: number) => step((c, me) => c.call('market.buy', { characterId: me.id, listingId }), slot, page),
  /** 最近成交的價格（第 153 輪，D-329；只讀）：上架時參考定價。伺服器壞了回 null */
  history: (slot: GearSlot, rarity: number): Promise<number[] | null> =>
    legacyOp(captureLegacy(), [], async (c, me) => ({ h: await c.call('market.history', { slot, rarity }), me }), (r) => r.me, true).then((r) => r?.h.sales.map((s) => s.price) ?? null),
};
export type MarketOps = typeof marketOps;
