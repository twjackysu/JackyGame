// 冒險地圖上的段位光環（第 149 輪，D-318）：荊棘（1100）以上才顯示；每次開遊戲只問伺服器一次，失敗下次再問；競技場結果直接更新。
import { describe, expect, it } from 'vitest';
import { forgetRank, pveAuraFor, pveRankAura, PVE_AURA_MIN, refreshRank, setRank } from '../src/game/rankCache';
import { PVP_START_RATING, rankAura, rankName } from '../src/core/meta/pvpRank';

describe('冒險地圖的段位光環', () => {
  it('起始分（沒打過競技場）不顯示；荊棘以上照競技場的光環', () => {
    expect(pveAuraFor(null)).toBeNull();
    expect(pveAuraFor(PVP_START_RATING)).toBeNull();
    expect(pveAuraFor(PVE_AURA_MIN - 1)).toBeNull();
    expect(rankName(PVE_AURA_MIN)).toBe('荊棘');
    expect(pveAuraFor(PVE_AURA_MIN)).toEqual(rankAura(PVE_AURA_MIN));
    expect(pveAuraFor(1450)).toEqual(rankAura(1450));
  });

  it('只問一次；伺服器壞了（null）下次再問；競技場結果直接更新；換角色重問', async () => {
    forgetRank();
    let asks = 0;
    let reply: unknown = null;
    const ask = async () => {
      asks++;
      return reply;
    };
    const flush = () => new Promise((r) => setTimeout(r, 0));
    refreshRank(ask);
    refreshRank(ask);
    expect(asks).toBe(1); // 問的途中不重問
    await flush();
    reply = { rating: 1200 };
    refreshRank(ask);
    expect(asks).toBe(2); // 第一次失敗，第二次再問
    await flush();
    refreshRank(ask);
    expect(asks).toBe(2); // 第二次成功（setRank 由 pvpOps 叫），不再問
    setRank(1300);
    expect(pveRankAura()).toEqual(rankAura(1300));
    forgetRank();
    expect(pveRankAura()).toBeNull();
    refreshRank(ask);
    expect(asks).toBe(3);
  });
});
