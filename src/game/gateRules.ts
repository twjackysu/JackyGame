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
