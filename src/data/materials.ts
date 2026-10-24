// 強化／重鑄／製作材料（D-053：材料總種類 ≤ 7）。存在 GameState.inventory（模板 id → 數量），不是裝備實例。
export interface MaterialDef {
  id: string;
  name: string;
  desc: string;
}

export const MATERIALS: readonly MaterialDef[] = [
  { id: 'mat_dust', name: '星燼粉塵', desc: '分解任何裝備都會得到。強化的基本材料。' },
  { id: 'mat_crystal', name: '魔力結晶', desc: '分解稀有以上裝備、精英與 Boss 掉落。+6 以上強化與重鑄需要。' },
  { id: 'mat_legend', name: '傳說殘片', desc: '分解傳說裝備得到。高階強化與鎖定詞綴需要。' },
  { id: 'mat_divine', name: '神格碎片', desc: '重複的神級裝備會凝聚成碎片；集滿可以指定製作已見過的神級。' },
];

export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export const MAX_MATERIAL_KINDS = 7;
