// 冒險地圖上的段位光環（第 149 輪，D-318）：競技場打到「荊棘」段位（1100）以上，冒險時主角腳下也有光環——PvP 的外觀獎勵在 PvE 也看得到。
// 段位分是伺服器的（pvp.ladder）；這裡只是畫面用的快取：每次開遊戲（或換角色）第一次進地圖時問一次，競技場打完直接更新。
import { rankAura, type RankAura } from '../core/meta/pvpRank';

/** 冒險地圖上從這個段位分起才顯示（見習／霧語不顯示：沒打過競技場的人起始 1000 分就是霧語，不想讓大家腳下突然多一圈） */
export const PVE_AURA_MIN = 1100;

let rating: number | null = null;
let asked = false;

/** 進地圖時叫：這次開遊戲還沒問過就叫 ask（pvpOps.ladder；它回來會 setRank）。背景，不擋進場 */
export function refreshRank(ask: () => Promise<unknown>): void {
  if (asked) return;
  asked = true;
  void ask().then((v) => {
    if (!v) asked = false; // 伺服器壞了：下次進地圖再問
  });
}

/** 競技場拿到新的段位分（天梯、開局、結算） */
export function setRank(r: number): void {
  rating = r;
  asked = true;
}

/** 換角色：下次進地圖重問 */
export function forgetRank(): void {
  rating = null;
  asked = false;
}

/** 冒險地圖主角腳下要畫的光環（沒有＝不畫） */
export function pveRankAura(): RankAura | null {
  return pveAuraFor(rating);
}
export function pveAuraFor(r: number | null): RankAura | null {
  return r !== null && r >= PVE_AURA_MIN ? rankAura(r) : null;
}
