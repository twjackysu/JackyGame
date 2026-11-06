// 新角色的名字（F1，D-302）：原創，依序挑一個沒用過的（手機上不用打字）
export const NAME_POOL = ['艾薇', '洛恩', '米拉', '凱因', '諾雅', '賽勒', '緹雅', '朔', '琉衣', '岡德'];

export function pickName(used: readonly string[]): string {
  return NAME_POOL.find((n) => !used.includes(n)) ?? `旅人${used.length + 1}`;
}

/** 改名（第 147 輪）：名字池裡 current 的下一個（跳過別的角色在用的）；按一下換一個 */
export function nextName(current: string, used: readonly string[]): string {
  const start = NAME_POOL.indexOf(current);
  for (let i = 1; i <= NAME_POOL.length; i++) {
    const n = NAME_POOL[(start + i + NAME_POOL.length) % NAME_POOL.length]!;
    if (n !== current && !used.includes(n)) return n;
  }
  return current;
}
