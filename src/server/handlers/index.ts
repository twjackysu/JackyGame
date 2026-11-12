// 所有 handler（每個命名空間一個檔案；新增方法：protocol.ts 的 Api 加一行＋這裡登記）
import type { HandlerTable } from '../router';
import { accountHandlers } from './account';
import { characterHandlers } from './character';
import { inventoryHandlers } from './inventory';
import { lootHandlers } from './loot';
import { marketHandlers } from './market';
import { migrateHandlers } from './migrate';
import { pvpHandlers } from './pvp';
import { shopHandlers } from './shop';
import { skillsHandlers } from './skills';
import { storyHandlers } from './story';
import { tradeHandlers } from './trade';
import { warehouseHandlers } from './warehouse';

export const HANDLERS: HandlerTable = {
  ...accountHandlers,
  ...characterHandlers,
  ...migrateHandlers,
  ...inventoryHandlers,
  ...shopHandlers,
  ...skillsHandlers,
  ...storyHandlers,
  ...marketHandlers,
  ...pvpHandlers,
  ...tradeHandlers,
  ...warehouseHandlers,
  ...lootHandlers,
};
