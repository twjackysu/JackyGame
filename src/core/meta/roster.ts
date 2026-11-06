// 多角色與帳號共用倉庫的規則（F1，第 145 輪，D-302）。純函式、確定性；伺服器 handler 照這裡判斷。
export const CHARACTER_SLOTS = 3;
export const WAREHOUSE_MAX = 40;
export const NAME_MAX = 8;
export const WEAPONS = ['sword', 'bow', 'staff'] as const;
export type RosterWeapon = (typeof WEAPONS)[number];

/** 角色名：去頭尾空白、1～8 個字、不能有控制字元或 <>&"'（顯示在別人的畫面上：拍賣所、交易、天梯） */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const len = [...s].length;
  if (len < 1 || len > NAME_MAX) return null;
  if (/[\u0000-\u001f\u007f<>&"'\\]/.test(s)) return null;
  return s;
}

export const isWeapon = (v: unknown): v is RosterWeapon => typeof v === 'string' && (WEAPONS as readonly string[]).includes(v);

/** 第一個空的角色欄；滿了回 -1 */
export function freeSlot(used: readonly number[]): number {
  for (let i = 0; i < CHARACTER_SLOTS; i++) if (!used.includes(i)) return i;
  return -1;
}

/** 能不能刪：不能刪目前角色、不能刪最後一個、拍賣所或交易裡還有東西的不能刪（要先取消，免得物品消失） */
export function deleteBlocker(o: { isActive: boolean; count: number; escrowItems: number }): string | null {
  if (o.count <= 1) return 'last character';
  if (o.isActive) return 'active character';
  if (o.escrowItems > 0) return 'items in market or trade';
  return null;
}

/** 倉庫的擁有者 id（跟角色 id 分開的命名空間，不會撞） */
export const warehouseOwner = (accountId: string): string => `wh:${accountId}`;

/** 放到最後一格的 pos */
export const nextPos = (rows: readonly { pos: number }[]): number => rows.reduce((m, r) => Math.max(m, r.pos + 1), 0);
