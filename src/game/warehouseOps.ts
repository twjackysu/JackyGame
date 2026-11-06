// 帳號共用倉庫（F1，D-302）的畫面層橋接：放進／拿出都由伺服器做，結果寫回舊 key（legacyOp authoritative，跟交易一樣）。
import type { CharacterView, WarehouseView } from '../net/views';
import { captureLegacy, legacyOp } from '../client/legacyOps';
import { ApiError } from '../net/protocol';
import type { GameClient } from '../client/GameClient';

export interface WarehousePage {
  warehouse: WarehouseView;
  character: CharacterView;
  /** 被伺服器拒絕的原因（倉庫滿、行囊滿…） */
  failed?: string;
}

function step(act: (c: GameClient, me: CharacterView) => Promise<WarehousePage>): Promise<WarehousePage | null> {
  return legacyOp(
    captureLegacy(),
    ['items'],
    async (c, me) => {
      try {
        return await act(c, me);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code === 'internal') throw e;
        return { warehouse: await c.call('warehouse.get', {}), character: me, failed: e.message };
      }
    },
    (r) => r.character,
    true,
  );
}

export const warehouseOps = {
  view: () => step(async (c, me) => ({ warehouse: await c.call('warehouse.get', {}), character: me })),
  put: (itemId: string) => step((c, me) => c.call('warehouse.put', { characterId: me.id, itemId })),
  take: (itemId: string) => step((c, me) => c.call('warehouse.take', { characterId: me.id, itemId })),
};
export type WarehouseOps = typeof warehouseOps;
