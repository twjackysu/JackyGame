// 面對面交易（託管，F3，24 §4.2）的畫面層橋接：每個動作都交給伺服器（託管、換主人、金幣都在伺服器），
// 結果以伺服器為準寫回舊 key（legacyOp authoritative，跟拍賣所一樣）。對方是模擬冒險者時，它的回應已經包在回應裡。
import type { CharacterView, TradeView, WeaponView } from '../net/views';
import { captureLegacy, legacyOp } from '../client/legacyOps';
import { ApiError } from '../net/protocol';
import type { GameClient } from '../client/GameClient';

export interface TradePartner {
  characterId: string;
  name: string;
  weapon: WeaponView;
}
export interface TradePage {
  trade: TradeView | null;
  partners: TradePartner[];
  /** 還開著的交易（離開面板再回來可以接著做） */
  open: { id: string; partnerName: string }[];
  character: CharacterView;
  /** 被伺服器拒絕的原因（錢不夠、版本過期…）；畫面照樣更新 */
  failed?: string;
}

type Act = (c: GameClient, me: CharacterView) => Promise<{ trade: TradeView; character: CharacterView } | { partners: TradePartner[]; open: TradePage['open'] }>;

function step(act: Act): Promise<TradePage | null> {
  return legacyOp(
    captureLegacy(),
    ['items', 'wallet'],
    async (c, me) => {
      try {
        const r = await act(c, me);
        if ('partners' in r) return { trade: null, partners: r.partners, open: r.open, character: me };
        return { trade: r.trade, partners: [], open: [], character: r.character };
      } catch (e) {
        if (!(e instanceof ApiError) || e.code === 'internal') throw e;
        return { trade: null, partners: [], open: [], character: me, failed: e.message };
      }
    },
    (r) => r.character,
    true,
  );
}

export const tradeOps = {
  partners: () => step((c, me) => c.call('trade.partners', { characterId: me.id })),
  open: (partnerCharacterId: string) => step((c, me) => c.call('trade.open', { characterId: me.id, partnerCharacterId })),
  get: (tradeId: string) => step((c, me) => c.call('trade.get', { characterId: me.id, tradeId })),
  offer: (tradeId: string, items: string[], coin: number) => step((c, me) => c.call('trade.offer', { characterId: me.id, tradeId, items, coin })),
  lock: (tradeId: string) => step((c, me) => c.call('trade.lock', { characterId: me.id, tradeId })),
  confirm: (tradeId: string, rev: number) => step((c, me) => c.call('trade.confirm', { characterId: me.id, tradeId, rev })),
  cancel: (tradeId: string) => step((c, me) => c.call('trade.cancel', { characterId: me.id, tradeId })),
};
export type TradeOps = typeof tradeOps;
