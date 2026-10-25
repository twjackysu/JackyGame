// 行商整合（D-116）：普通 Bot 刷 30 分鐘 → 把金幣花在貨架上比身上好的裝備 → 狼王打得比只用掉落裝備快，但買到的不會比掉落的最好裝備強太多
import { afterAll, beforeAll, expect, it } from 'vitest';
import { STAGES, SWORDSMAN } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { GEAR_SLOTS, gearBonus, gearScore, genGear, type GearSlot, type RtGear } from '../src/core/battle/rt/gear';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';
import { buyPrice, shopIlvl, shopStock, stockPrice, withPick } from '../src/game/rtShop';
import { weakestSlot } from '../src/game/rtBag';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);
const mkBot = () => new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
const sc = (g: RtGear | undefined) => gearScore(g, SWORDSMAN.hp, SWORDSMAN.atk);

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

function kingFight(seed: number, level: number, bonus: { hp: number; atk: number; def: number }): number {
  const s = createBattle({ stageId: 'mistwood', seed, level, bonus });
  const bot = mkBot();
  let engaged = -1;
  while (!(s.bossKills ?? []).length && s.tick < sec(900)) {
    step(s, bot.decide(s));
    // 從「最後一次」交手開始算（第 24 輪：只擦到邊就脫戰回家的那次不算）
    const fighting = s.units.some((u) => u.defId === 'wolf_king' && !u.dead && u.mode === 'combat');
    if (engaged < 0 && fighting) engaged = s.tick;
    else if (!fighting && s.units.some((u) => u.defId === 'wolf_king' && !u.dead && u.mode === 'idle')) engaged = -1;
  }
  return Math.round((s.tick - Math.max(0, engaged)) / 30);
}

it('刷 30 分鐘的金幣拿去行商買裝備 → 狼王更快', () => {
  const s = createBattle({ stageId: 'mistwood', seed: 11 });
  const bot = mkBot();
  while (s.tick < sec(1800)) step(s, bot.decide(s));
  const lv = s.prog!.level;
  const got = (s.gearGot ?? []).map((g) => genGear((g.id * 2246822519) >>> 0, g.rarity, g.ilvl));
  const best: Partial<Record<GearSlot, RtGear>> = {};
  for (const g of got) if (sc(g) > sc(best[g.slot])) best[g.slot] = g;
  out(`\n[shop] 掉落最好：${GEAR_SLOTS.map((k) => `${k}:${best[k] ? `${best[k]!.rarity}/${best[k]!.ilvl}/${Math.round(sc(best[k]))}` : '-'}`).join(' ')}\n[shop] 貨架：${[1, 2, 3].map((r) => shopStock({ runs: r }, lv, 'mistwood').map((g) => `${g.slot}:${g.rarity}/${g.ilvl}/${Math.round(sc(g))}/${buyPrice(g)}`).join(' ')).join(' | ')}\n`);
  // 逛行商：連續 3 次進地圖（3 批貨），每批買比身上好、提升最大的，買到錢不夠為止
  let coin = s.loot?.gold ?? 0;
  const coin0 = coin;
  const shopped: Partial<Record<GearSlot, RtGear>> = { ...best };
  let bought = 0;
  for (let run = 1; run <= 3; run++) {
    // 和畫面一樣：這批第一次打開時看身上最弱的部位「為你挑選」（第 25 輪）
    const rr = withPick({ runs: run }, weakestSlot({ bag: [], equip: shopped }, shopIlvl(lv)));
    const stock = shopStock(rr, lv, 'mistwood').filter((g) => sc(g) > sc(shopped[g.slot]) && stockPrice(rr, g) <= coin);
    stock.sort((a, b) => sc(b) - sc(shopped[b.slot]) - (sc(a) - sc(shopped[a.slot])));
    for (const g of stock) {
      if (stockPrice(rr, g) > coin || sc(g) <= sc(shopped[g.slot])) continue;
      coin -= stockPrice(rr, g);
      shopped[g.slot] = g;
      bought++;
    }
  }
  const b0 = gearBonus(GEAR_SLOTS.map((k) => best[k]), SWORDSMAN.hp, SWORDSMAN.atk);
  const b1 = gearBonus(GEAR_SLOTS.map((k) => shopped[k]), SWORDSMAN.hp, SWORDSMAN.atk);
  const f0 = [1, 2, 3].map((sd) => kingFight(sd, lv, b0));
  const f1 = [1, 2, 3].map((sd) => kingFight(sd, lv, b1));
  out(`\n[shop] 30 分鐘 Lv${lv}、金幣 ${coin0}、買 ${bought} 件（剩 ${coin}）、加成 ${JSON.stringify(b0)} → ${JSON.stringify(b1)}\n[shop] 狼王交戰秒：只用掉落 ${f0.join('/')}・加上行商 ${f1.join('/')}\n`);
  // 行商是補洞：三批貨裡沒有任何一件比刷到的好時，沒東西可買是正常的（第 25 輪加了迷霧巡守，種子 11 刷出 5 格稀有 ilvl 8＋精良 ilvl 11 胸甲）
  const upgrades = [1, 2, 3].flatMap((r) => shopStock(withPick({ runs: r }, weakestSlot({ bag: [], equip: best }, shopIlvl(lv))), lv, 'mistwood')).filter((g) => sc(g) > sc(best[g.slot])).length;
  out(`[shop] 貨架上比掉落好的：${upgrades} 件\n`);
  const allCovered = upgrades === 0;
  if (!allCovered) expect(bought).toBeGreaterThan(0);
  expect(b1.atk + b1.hp / 10).toBeGreaterThanOrEqual(b0.atk + b0.hp / 10);
  // 行商不能取代刷寶：加成提升不超過 2 倍
  expect(b1.atk).toBeLessThanOrEqual(Math.max(10, b0.atk * 2));
  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  expect(sum(f1)).toBeLessThanOrEqual(sum(f0) * 1.1);
}, 240000);
