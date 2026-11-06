// 過渡期（D-302）：換角色時哪些舊 key 留在裝置上、不跟著角色走（操作設定、教學提示、開場動畫：玩家已經會了）。
// 伺服器（toLegacy 不輸出）與客戶端（換角色時不清掉）共用。
export const DEVICE_KEY = /^jg_(rt_controls$|rt_hint_seen$|tip_|night_tips_|streak_hint_|prologue_seen$|backup_)/;
