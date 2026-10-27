// 提示大字（tipOnce）的換行（第 37 輪）：bigText 不會自動換行，30px 一行大約只放得下 20 個全形字，
// 長的提示在 720 寬的畫面會超出左右兩邊。超過 18 字就在最靠近中間的標點（！，：——）後面斷成兩行。
export const TIP_LINE_MAX = 18;

/** 不算標點與括號的字數 */
function words(t: string): number {
  return [...t].filter((c) => !'！，：。、…—（）「」？　 '.includes(c)).length;
}

export function wrapTip(text: string): string {
  if (text.includes('\n') || [...text].length <= TIP_LINE_MAX) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i]!;
    const brk = '！，：。'.includes(c) || ((c === '—' || c === '…') && text[i - 1] === c);
    // 兩邊都要有字（第 45 輪：「…暈很久！）」在「！」後面斷，第二行只剩一個「）」）
    if (brk && words(text.slice(0, i + 1)) >= 2 && words(text.slice(i + 1)) >= 2 && (best < 0 || Math.abs(i + 1 - mid) < Math.abs(best - mid))) best = i + 1;
  }
  if (best <= 0 || best >= text.length) best = Math.ceil(mid);
  return `${text.slice(0, best)}\n${text.slice(best)}`;
}

/** 提示停留時間（第 40 輪）：短的 2.2 秒；長的（兩行）每字約 0.11 秒，最多 4 秒，讓手機上讀得完 */
export function tipMs(text: string, base = 2200): number {
  const n = [...text.replace(/\n/g, '')].length;
  return Math.min(4000, Math.max(base, n * 110));
}
