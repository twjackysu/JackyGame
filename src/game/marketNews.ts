// 拍賣所賣出通知（第 149 輪，D-320）：伺服器 market.mine 的 news（上次看過之後才成交的掛單）→ 一則提示字。純函式。
import { isGear } from '../core/battle/rt/gear';
import { sellerGets } from '../core/meta/market';
import type { ListingView } from '../net/views';
import { gearTitleW, type WeaponId } from './weapon';

/** 「你不在的時候賣出 3 件・+N 金（扣手續費後）\nA\nB\n…等 3 件」；沒有就 null。first＝剛打開拍賣所（之後的是「剛剛」） */
export function soldNewsText(news: readonly ListingView[], first: boolean, w?: WeaponId): string | null {
  if (!news.length) return null;
  const names = news.map((l) => (isGear(l.gear) ? gearTitleW(l.gear, w) : '裝備'));
  const gain = news.reduce((s, l) => s + sellerGets(l.price), 0);
  const shown = names.slice(0, 2).join('\n') + (names.length > 2 ? `\n…等 ${names.length} 件` : '');
  return `${first ? '你不在的時候賣出' : '剛剛有人買走'} ${news.length} 件・+${gain} 金\n${shown}`;
}
