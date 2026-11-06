// 所有 handler（每個命名空間一個檔案；新增方法：protocol.ts 的 Api 加一行＋這裡登記）
import type { HandlerTable } from '../router';
import { accountHandlers } from './account';
import { cardsHandlers } from './cards';
import { characterHandlers } from './character';
import { inventoryHandlers } from './inventory';
import { migrateHandlers } from './migrate';
import { shopHandlers } from './shop';
import { skillsHandlers } from './skills';

export const HANDLERS: HandlerTable = {
  ...accountHandlers,
  ...characterHandlers,
  ...migrateHandlers,
  ...inventoryHandlers,
  ...shopHandlers,
  ...skillsHandlers,
  ...cardsHandlers,
};
