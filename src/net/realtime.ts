// 即時 PvP 的訊息格式（第 147 輪，24 §6.2 #2）：伺服器 src/server/realtime/BattleRoom.ts、客戶端 src/client/RoomClient.ts 共用。
// 只有 JSON 可以表示的資料（24 鐵律：邊界只傳 JSON）；傳輸層之後是 WebSocket（WsTransport），本機測試用記憶體佇列模擬延遲與掉包。

/** 引擎指令的 JSON 形狀（src/net 不 import core；伺服器用 validCmd 檢查，客戶端照伺服器給的跑） */
export interface RtCommand {
  type: string;
  pid?: number;
  [k: string]: unknown;
}

/** 客戶端 → 伺服器：還沒被確認的指令（seq 遞增；t＝想在第幾個 tick 生效） */
export interface RtInputMsg {
  type: 'input';
  inputs: { seq: number; t: number; c: RtCommand[] }[];
}
export interface RtResendMsg {
  type: 'resend';
  from: number;
}
export type RtClientMsg = RtInputMsg | RtResendMsg;

/** 伺服器 → 客戶端：第 t 個 tick 套用了哪些指令（pid 在指令上）；ack＝你的指令收到第幾號；hash 每 SNAP_EVERY tick 附一次 */
export interface RtFrame {
  type: 'frame';
  t: number;
  c: RtCommand[];
  ack: number;
  hash?: string;
  outcome?: string;
}
export type RtServerMsg = RtFrame;

/** 最多可以排到幾個 tick 之後（約 1 秒） */
export const RT_MAX_AHEAD = 30;
/** 每幾個 tick 附一次 hash */
export const RT_SNAP_EVERY = 30;
/** 一個封包最多幾筆（擋灌爆） */
export const RT_MAX_INPUTS_PER_MSG = 64;
