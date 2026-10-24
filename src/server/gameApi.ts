// 前端改變玩家資產的唯一入口（design/14 階段 1.5）。
// 現在由 LocalGameApi（同一個程式裡直接呼叫）實作；連線版換成 RemoteGameApi（fetch），介面不變。
// 所有輸入輸出都是可序列化的純資料；每個操作帶 operationId（重複送出不重複扣款或給獎）。
import type { MemberId } from '../core/state/gameState';
import type { Slot } from '../data/equipment';

export type ConsumableId = 'potion_s' | 'potion_m' | 'lamp_oil' | 'blast_bottle';

export interface ApiResult<T = undefined> {
  ok: boolean;
  /** 失敗原因（給 UI 顯示用的代碼） */
  error?: 'no_affixes' | 'bad_locks' | 'pending' | 'locked' | 'max_level' | 'not_enough_materials' | 'not_enough_gold' | 'not_for_sale' | 'not_owned' | 'cannot_equip' | 'already_claimed' | 'not_found' | 'invalid';
  /** 同一 operationId 已處理過：沒有再次生效 */
  duplicate?: boolean;
  operationId: string;
  rulesVersion: number;
  data?: T;
}

export interface BattleRewards {
  /** 掉落的裝備模板 id（已放進背包） */
  drops: string[];
  /** 這場是否首殺了會給技能點的 Boss */
  newBossPoint: boolean;
}

export interface EnhanceResult {
  success: boolean;
  guaranteed: boolean;
  from: number;
  to: number;
  level: number;
  blessing: number;
  chance: number;
}

export interface GameApi {
  /** 詞綴重鑄：locks＝要保留的詞綴索引（最多 2 條）；結果是候選，要再呼叫 settleReroll */
  reroll(operationId: string, req: { instanceId: string; locks: number[] }): ApiResult<{ candidate: { id: string; value: number }[]; previous: { id: string; value: number }[] }>;
  /** 接受新詞綴（accept=true）或保留舊詞綴 */
  settleReroll(operationId: string, req: { instanceId: string; accept: boolean }): ApiResult;
  /** 分解指定的裝備實例（傳說以上要明確指定）；quick=true 時只分解一鍵分解範圍內的 */
  salvage(operationId: string, req: { instanceIds: string[]; quick?: boolean }): ApiResult<{ salvaged: number; materials: Record<string, number> }>;
  /** 上鎖／解鎖（上鎖的不能賣、不能分解） */
  setLock(operationId: string, req: { instanceId: string; locked: boolean }): ApiResult;
  /** 強化一件裝備實例（扣金幣與材料，擲 'enhance' stream） */
  enhance(operationId: string, req: { instanceId: string }): ApiResult<EnhanceResult>;
  buy(operationId: string, req: { itemId: string; discountPct?: number }): ApiResult;
  sell(operationId: string, req: { itemId: string }): ApiResult;
  /** ref：instanceId，或模板 id（取背包裡第一件） */
  equip(operationId: string, req: { member: MemberId; ref: string }): ApiResult;
  unequip(operationId: string, req: { member: MemberId; slot: Slot }): ApiResult;
  /** 技能樹重置（營火外收費） */
  resetTree(operationId: string, req: { member: MemberId; atCamp: boolean }): ApiResult;
  /** 開地圖上的寶箱（內容由伺服器端的地圖資料決定） */
  openChest(operationId: string, req: { areaId: string; entityId: string }): ApiResult<{ text: string }>;
  /** 打倒或趕跑地圖上的明雷小怪後領金幣 */
  claimEnemyGold(operationId: string, req: { areaId: string; entityId: string }): ApiResult<{ gold: number }>;
  /** 劇情／明雷戰鬥勝利：同步剩餘消耗品、擲掉落、記首殺 */
  claimBattleRewards(operationId: string, req: { defeated: string[]; consumablesLeft: Partial<Record<ConsumableId, number>> }): ApiResult<BattleRewards>;
}
