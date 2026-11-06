// 新角色的名字（F1，D-302）：原創，依序挑一個沒用過的（手機上不用打字）
export const NAME_POOL = ['艾薇', '洛恩', '米拉', '凱因', '諾雅', '賽勒', '緹雅', '朔', '琉衣', '岡德'];

export function pickName(used: readonly string[]): string {
  return NAME_POOL.find((n) => !used.includes(n)) ?? `旅人${used.length + 1}`;
}
