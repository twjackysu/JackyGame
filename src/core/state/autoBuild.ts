// 自動配裝／點技能（通關機器人與平衡模擬用；玩家不會用到）。
import { ITEM_DEFS } from '../../data/equipment';
import { EQUIP_SLOTS, slotType } from '../../data/rules';
import { buy, buyPrice, canEquip, equip, wornTemplate } from './equip';
import { bagIds } from './gear';
import { learn, learnState, treeFor } from './skillTree';
import type { GameState, MemberId } from './gameState';

const score = (id: string | undefined): number => {
  const b = id ? ITEM_DEFS[id]?.bonus ?? {} : {};
  return (b.atk ?? 0) * 3 + (b.def ?? 0) * 3 + (b.hp ?? 0) * 0.4 + (b.spd ?? 0) * 4 + (id && ITEM_DEFS[id]?.perk ? 30 : 0);
};

/** 先把背包裡比較好的裝上，再用錢買貨架上更好的（每格只買一件）。回傳換了幾件。 */
export function autoOutfit(s: GameState, stock: readonly string[] = [], keepGold = 60): number {
  let n = 0;
  for (const m of s.party as MemberId[]) {
    for (const slot of EQUIP_SLOTS) {
      const type = slotType(slot);
      const cur = wornTemplate(s, m, slot);
      const owned = bagIds(s).filter((id) => ITEM_DEFS[id]?.slot === type && canEquip(m, ITEM_DEFS[id]));
      const bestOwned = owned.sort((a, b) => score(b) - score(a))[0];
      if (bestOwned && score(bestOwned) > score(cur) && equip(s, m, bestOwned, slot)) { n++; continue; }
      const shop = stock.filter((id) => ITEM_DEFS[id]?.slot === type && canEquip(m, ITEM_DEFS[id]) && score(id) > score(cur))
        .sort((a, b) => score(b) - score(a))
        .find((id) => s.gold - buyPrice(id) >= keepGold);
      if (shop && buy(s, shop) && equip(s, m, shop, slot)) n++;
    }
  }
  return n;
}

/** 把技能點用完：分支 0 由上往下點滿，再點分支 1。回傳點了幾級。 */
export function autoLearn(s: GameState): number {
  let n = 0;
  for (const m of Object.keys(s.members) as MemberId[]) {
    const order = treeFor(m).sort((a, b) => a.branch - b.branch || a.row - b.row || a.col - b.col);
    for (let guard = 0; guard < 60; guard++) {
      const next = order.find((x) => learnState(s, m, x.id) === 'ok');
      if (!next || !learn(s, m, next.id)) break;
      n++;
    }
  }
  return n;
}
