// 光門規則（D-218）：Boss 交戰中、而且已經被打掉血 → 往前的光門封住（追打／衝鋒／閃避踩到門不會被傳走）。
// 只是從滿血的 Boss 旁邊跑過去照樣能走（巢穴是死路、Boss 重生後光門在牠背後）。
export interface GateUnit {
  dead?: boolean;
  hp: number;
  maxHp: number;
  mode?: string;
  boss?: boolean;
}

export function gateSealed(units: readonly GateUnit[]): boolean {
  return units.some((e) => !e.dead && e.boss && (e.mode === 'combat' || e.mode === 'returning') && e.hp < e.maxHp);
}

// 第 93 輪（D-234）：巡邏精英（迷霧巡守、荊棘巡獵者、彗星巡者…）交戰中被打掉血、在主角 12 格內＝正在纏鬥。
// 走位跨區時不要跳地區名稱＋危險說明蓋在打鬥中間（D-233 只擋 Boss）。
export interface FightUnit extends GateUnit {
  elite?: boolean;
  dist: number; // 和主角的距離（格）
}

export function eliteFighting(units: readonly FightUnit[]): boolean {
  return units.some((e) => !e.dead && e.elite && !e.boss && e.mode === 'combat' && e.hp < e.maxHp && e.dist <= 12);
}
