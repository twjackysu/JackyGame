// 遊戲 Wiki 產生器（第 137 輪，D-273）：docs/wiki/*.md 全部由遊戲資料直接算出來，數字和遊戲永遠一致。
// 一般跑測試只檢查能產生；要寫檔：`npm run wiki`（WIKI=1）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMIES, WEAPONS, WEAPON_IDS } from '../src/core/battle/rt/data';
import { ENH_MAX, GEAR_ILVL_MAX, GEAR_SLOTS, PRO_SPECIAL_PCT, RARITY_NAME, SLOT_NAME, SPECIAL_KINDS, enhanceCost, genGear, type GearSlot, type Rarity } from '../src/core/battle/rt/gear';
import { AFFIX_ILVL_PLUS, HIDDEN_ILVL_PLUS, dropIlvlRange } from '../src/core/battle/rt/loot';
import { SKILL_MAX_RANK, SKILL_TREE } from '../src/core/meta/skills';
import { WORLD_MAPS } from '../src/game/worldMaps';
import type { StageDefinition } from '../src/core/battle/rt/types';

const SEC = 30;
const sec = (t: number): string => `${+(t / SEC).toFixed(2)} 秒`;
const NAV = '[Wiki 首頁](README.md)・[強化](enhance.md)・[技能樹](skills.md)・[裝備與神裝](gear.md)・[怪物與掉落](monsters.md)・[畫面集](gallery.md)・[交易與競技場](online.md)';
const head = (title: string): string => `# ${title}\n\n> ${NAV}\n>\n> 本頁由 \`npm run wiki\` 從遊戲資料自動產生，數字與遊戲版本一致。\n\n`;

function enhancePage(): string {
  let s = head('強化系統');
  s += '在**營火旁**打開「行囊・強化」，點一件裝備 →「強化！」→ 確認框會列出每項數值「原值 → 新值」，按「確定強化」。\n\n';
  s += `- 最高 **+${ENH_MAX}**。每強化一級，裝備的**底數值**（攻擊／HP／防禦）**+10%**（以未強化時為基準，+10 時是 2 倍）。\n`;
  s += '- 詞綴（✦）不吃強化；技能特效（★）在 **+7 時 ×1.25、+10 時 ×1.5**（第 4 欄的護盾特效改成 +5%／+10%）。\n';
  s += '- **失敗只扣材料，不會掉級、不會壞掉**。+1～+5 必定成功。\n';
  s += '- 材料：**粉塵**（怪物、分解裝備、懸賞）、**結晶**（精英、Boss、懸賞）。分解一件得到 `稀有度×2 + 物品等級÷2 + 強化等級` 粉塵。\n\n';
  s += '| 強化 | 粉塵 | 結晶 | 成功率 | 平均要試幾次 | 底數值倍率 | 技能特效 |\n|:-:|:-:|:-:|:-:|:-:|:-:|:-:|\n';
  let td = 0;
  let tc = 0;
  for (let e = 0; e < ENH_MAX; e++) {
    const c = enhanceCost(e);
    const tries = 100 / c.rate;
    td += c.dust * tries;
    tc += c.crystal * tries;
    const n = e + 1;
    s += `| +${e} → +${n} | ${c.dust} | ${c.crystal || '—'} | ${c.rate}% | ${tries.toFixed(1)} | ×${(1 + 0.1 * n).toFixed(1)} | ${n >= 10 ? '×1.5' : n >= 7 ? '×1.25' : '—'} |\n`;
  }
  s += `\n從 +0 打到 +${ENH_MAX} 平均要 **粉塵約 ${Math.round(td)}、結晶約 ${Math.round(tc)}**（含失敗）。\n\n`;
  s += '## 小技巧\n- 先把武器打到 +5（便宜又必成），攻擊加成最有感。\n- +6 以後才開始賭成功率；+7 讓技能特效變強，是很好的停損點。\n- 換到更好的裝備前別把舊裝備強化太高——分解只退一點點粉塵。\n';
  return s;
}

function skillsPage(): string {
  let s = head('技能樹（三把武器）');
  s += `每升一級得 **1 技能點**（Lv N 共有 N−1 點），三把武器**共用同一份點數**，隨時免費重置（☰ → 技能點）。\n`;
  s += `每個技能最多 ${SKILL_MAX_RANK} 級；**滿 ${SKILL_MAX_RANK} 級**後技能樹往下長出三個分支：**原招／變化／變化二**，點一下就改用那種打法（隨時換回）。\n\n`;
  s += '## 每級加成（三把武器相同位置共用）\n| 位置 | 長劍 | 長弓 | 法杖 | 每級 |\n|:-:|---|---|---|---|\n';
  SKILL_TREE.forEach((t, i) => {
    s += `| ${i + 1} | ${WEAPONS.sword.skills[t.id]?.name ?? t.name} | ${WEAPONS.bow.skills[t.id]?.name ?? ''} | ${WEAPONS.staff.skills[t.id]?.name ?? ''} | ${t.per} |\n`;
  });
  for (const w of WEAPON_IDS) {
    const W = WEAPONS[w];
    const p = W.player;
    s += `\n## ${W.name}\n基礎：HP ${p.hp}・攻擊 ${p.atk}・防禦 ${p.def}・普攻射程 ${+(p.attackRange / 100).toFixed(1)} 格・爆擊 ${p.critRate}%・閃避冷卻 ${sec(p.dodge.cooldownTicks)}${p.mp !== 100 ? `・MP 上限 ${p.mp}` : ''}\n\n`;
    s += '```\n';
    for (const t of SKILL_TREE) {
      const sk = W.skills[t.id];
      if (!sk) continue;
      const a = W.variants[t.id];
      const b = W.variantsB[t.id];
      s += `${sk.name}（Lv 1～${SKILL_MAX_RANK}）${sk.mp ? '　大招' : ''}\n`;
      s += `  ├─ 原招\n${a ? `  ├─ ${a.variantName}\n` : ''}${b ? `  └─ ${b.variantName}\n` : ''}`;
    }
    s += '```\n\n| 技能 | 打法 | 冷卻 | 說明 |\n|---|---|:-:|---|\n';
    for (const t of SKILL_TREE) {
      const sk = W.skills[t.id];
      if (!sk) continue;
      const cd = sk.mp ? `MP ${sk.mp}` : sec(sk.cooldownTicks);
      s += `| **${sk.name}** | 原招 | ${cd} | ${(W.desc?.[t.id] ?? '').replace(/\|/g, '／')} |\n`;
      for (const [label, alt] of [['變化', W.variants[t.id]], ['變化二', W.variantsB[t.id]]] as const) {
        if (!alt) continue;
        s += `| | ${label}：**${alt.variantName}** | ${alt.mp ? `MP ${alt.mp}` : sec(alt.cooldownTicks)} | ${alt.desc.replace(/\|/g, '／')} |\n`;
      }
    }
  }
  return s;
}

function gearPage(): string {
  let s = head('裝備與神裝');
  s += `六個部位：${GEAR_SLOTS.map((g) => SLOT_NAME[g]).join('、')}。稀有度：普通（白）／精良（藍）／稀有（金）。\n\n`;
  s += '- **物品等級（ilvl 1～12）** 決定數值與名字：越深的地圖、越強的怪掉得越高。\n';
  s += '- **詞綴（✦）**：精良 1 條、稀有 2 條、**深夜的稀有 3 條**（名字「夜燼・…」）。\n';
  s += `- **技能特效（★）**：稀有必帶 1 條；精良有 ${PRO_SPECIAL_PCT}% 機率帶 1 條（數值減半）。\n`;
  s += '- 強化每級底數值 +10%，見 [強化](enhance.md)。\n\n';
  s += '## 底數值（未強化）\n| 部位 | ilvl 1 普通 | ilvl 6 精良 | ilvl 12 稀有 | ilvl 12 稀有 +10 |\n|---|---|---|---|---|\n';
  const fmt = (b: { atk?: number; hp?: number; def?: number }, m = 1): string => [b.atk && `攻擊 ${Math.round(b.atk * m)}`, b.hp && `HP ${Math.round(b.hp * m)}`, b.def && `防禦 ${Math.round(b.def * m)}`].filter(Boolean).join('・');
  for (const slot of GEAR_SLOTS) {
    const g = (r: Rarity, l: number) => genGear(1, r, l, { slot: slot as GearSlot });
    s += `| ${SLOT_NAME[slot]} | ${fmt(g(1, 1).base)} | ${fmt(g(2, 6).base)} | ${fmt(g(3, 12).base)} | ${fmt(g(3, 12).base, 2)} |\n`;
  }
  s += '\n## 名稱（依物品等級）\n| 部位 | ilvl 1–2 | 3–4 | 5–6 | 7+ |\n|---|---|---|---|---|\n';
  for (const slot of GEAR_SLOTS) s += `| ${SLOT_NAME[slot]} | ${[1, 3, 5, 7].map((l) => genGear(1, 1, l, { slot }).name).join(' | ')} |\n`;
  s += '\n稀有裝的後綴依地圖：霧語森林「霧語」、荊棘谷「荊冠」、燼紅裂谷「燼心」、星隕高原「星骸」（精良帶特效時是「薄霧／荊芒／燼紋／星紋」）。\n\n';
  s += '## 詞綴範圍（L＝物品等級）\n| 詞綴 | 名字開頭 | ilvl 6 | ilvl 12 |\n|---|---|---|---|\n';
  const aff: [string, string, (L: number, t: number) => number, string][] = [
    ['攻擊', '鋒利的', (L, t) => Math.round(1 + L * (0.2 + 0.3 * t)), ''],
    ['HP', '厚實的', (L, t) => Math.round(6 + L * (3 + 3 * t)), ''],
    ['防禦', '堅固的', (L, t) => Math.round(1 + L * (0.2 + 0.3 * t)), ''],
    ['攻擊 %', '嗜血的', (L, t) => Math.round(1 + 2 * t + L * 0.2), '%'],
    ['HP %', '強韌的', (L, t) => Math.round(2 + 2 * t + L * 0.2), '%'],
  ];
  for (const [n, pre, f, u] of aff) s += `| ${n} | ${pre} | ${f(6, 0)}～${f(6, 0.999)}${u} | ${f(12, 0)}～${f(12, 0.999)}${u} |\n`;
  s += '\n## 技能特效（★，稀有的數值；精良減半）\n| 種類 | 範圍 | 可能出現在 |\n|---|---|---|\n';
  const kinds: Record<string, [string, string]> = { cd: ['冷卻 −%', '8～15%'], dmg: ['傷害 +%', '12～25%'], area: ['範圍 +%', '15～30%'], block: ['護盾 +%', '10～20%'], dist: ['第 3 欄範圍 +%', '20～40%（和「範圍 +%」合計上限 50%）'] };
  for (const [k, [n, r]] of Object.entries(kinds)) {
    const on = Object.entries(SPECIAL_KINDS).filter(([, ks]) => ks.includes(k as never)).map(([id]) => WEAPON_IDS.map((w) => WEAPONS[w].skills[id]?.name).filter(Boolean).join('／'));
    s += `| ${n} | ${r} | ${on.join('、')} |\n`;
  }
  s += '\n## 神裝清單（最強的那一件長怎樣）\n「神裝」＝ **深夜掉的稀有（夜燼）**、**物品等級 12**、**+10**：三條詞綴＋一條 ×1.5 的技能特效。\n\n';
  s += '| 部位 | 神裝名稱範例 | 底數值（+10） | 怎麼拿 |\n|---|---|---|---|\n';
  GEAR_SLOTS.forEach((slot, i) => {
    const g = genGear(11 + i * 7, 3, 12, { slot, night: true, region: 'starfall' });
    s += `| ${SLOT_NAME[slot]} | ${g.name} | ${fmt(g.base, 2)} | 星隕高原深夜的精英、Boss、暴怒星骸守望者 |\n`;
  });
  s += '\n武器的名字跟著你拿的武器變（長劍「王牙大劍」、長弓與法杖各有自己的名字）；詞綴開頭（嗜血的、強韌的…）是第一條詞綴決定的。\n';
  s += '\n**刷神裝的路線**：通關後到星隕高原（建議 Lv14＋）→ 在 ☰ 打開「暴怒」、打倒暴怒版 Boss 一次，那張地圖就解鎖深夜 → 深夜的精英與 Boss 物品等級最高、稀有權重最高；不倒下連殺引出的**隱藏首領**再 +2 物品等級、稀有權重 ×2。\n';
  return s;
}

function monstersPage(): string {
  let s = head('怪物與掉落');
  s += '每隻怪都會掉金幣；粉塵、結晶、藥水照下表機率各自判定。**裝備**另外判定：「裝備機率」是每件的機率，稀有度權重是 普通：精良：稀有。\n';
  s += '區域加成（越深的區域掉落越多）、深夜、狼群暴動、隱藏首領都會再提高機率與物品等級。\n\n';
  s += `**物品等級最高 ${GEAR_ILVL_MAX}**：表裡的「基礎 ilvl」加上各種加成後超過 ${GEAR_ILVL_MAX} 的，掉出來就是 ${GEAR_ILVL_MAX}。每張圖下面的「實際掉到手上的物品等級」是成品的等級（標 ＊ 的是已經頂到上限——這時深夜／暴怒多給的是**件數、稀有機率和深夜第三條詞綴**，不是等級）。\n\n`;
  const seen = new Set<string>();
  for (const m of WORLD_MAPS) {
    const st: StageDefinition = m.make();
    const ids = new Set<string>([...st.enemies.map((e) => e.enemyId), ...(st.spawnGroups ?? []).map((g) => g.enemyId), ...Object.keys(st.gearDrops ?? {})]);
    if (st.riot) ids.add(st.riot.enemyId), st.riot.eliteId && ids.add(st.riot.eliteId);
    if (st.hiddenElite) ids.add(st.hiddenElite.enemyId);
    s += `## ${m.name}${m.postGame ? '（通關後）' : ''}\nBoss：**${m.boss}**・建議等級 Lv${m.bossLv}${st.night ? `・深夜：怪物 HP +${st.night.hpPct}%、攻擊 +${st.night.atkPct}%、掉落 +${st.night.lootPct}%、物品等級 +${st.night.ilvlPlus}` : ''}\n\n`;
    s += '| 怪物 | HP | 攻擊 | 防禦 | 金幣 | 粉塵 | 結晶 | 藥水 | 裝備機率 | 基礎 ilvl | 稀有度權重 |\n|---|--:|--:|--:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|\n';
    const rows = [...ids].map((id) => ENEMIES[id]).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.hp - b.hp);
    for (const e of rows) {
      const it = (k: string): string => {
        const x = e.drops?.items?.find((i) => i.id === k);
        return x ? `${x.chance}%${x.count ? `×${x.count[0]}～${x.count[1]}` : ''}` : '—';
      };
      const gd = st.gearDrops?.[e.id];
      s += `| ${e.name} | ${e.hp} | ${e.atk} | ${e.def} | ${e.drops ? `${e.drops.gold[0]}～${e.drops.gold[1]}` : '—'} | ${it('dust')} | ${it('crystal')} | ${it('potion')} | ${gd ? `${gd.chance}%${gd.count && gd.count > 1 ? ` ×${gd.count} 次` : ''}${gd.firstRare ? '（首殺保底稀有）' : ''}` : '—'} | ${gd ? Math.min(GEAR_ILVL_MAX, gd.ilvl) : '—'} | ${gd ? gd.rarity.join('：') : '—'} |\n`;
      seen.add(e.id);
    }
    // 成品物品等級對照（D-340）：和掉落擲骰同一條算式＋上限
    const cell = (id: string, o: { night?: boolean; fury?: boolean }): string => {
      const r = dropIlvlRange(st, id, o);
      return r ? `${r.min === r.max ? r.min : `${r.min}～${r.max}`}${r.capped ? '＊' : ''}` : '—';
    };
    s += `\n**實際掉到手上的物品等級**（同一種怪在越深的區域越高${st.eliteAffixes ? `；帶詞綴的精英再 +${AFFIX_ILVL_PLUS}` : ''}${st.hiddenElite ? `；隱藏首領再 +${HIDDEN_ILVL_PLUS}` : ''}；最高 ${GEAR_ILVL_MAX}）\n\n`;
    s += `| 怪物 | 白天 |${st.night ? ' 深夜 |' : ''}${st.bossZone?.fury ? ` 暴怒 |${st.night ? ' 暴怒＋深夜 |' : ''}` : ''}\n|---|:-:|${st.night ? ':-:|' : ''}${st.bossZone?.fury ? `:-:|${st.night ? ':-:|' : ''}` : ''}\n`;
    for (const e of rows) {
      const cells = [cell(e.id, {}), ...(st.night ? [cell(e.id, { night: true })] : []), ...(st.bossZone?.fury ? [cell(e.id, { fury: true }), ...(st.night ? [cell(e.id, { fury: true, night: true })] : [])] : [])];
      if (cells.every((c) => c === '—')) continue;
      s += `| ${e.name} | ${cells.join(' | ')} |\n`;
    }
    const fury = st.bossZone?.fury;
    if (fury) s += `\n**暴怒版 ${m.boss}**：HP +${fury.hpPct}%、攻擊 +${fury.atkPct}%、冷卻 −${fury.cdPct}%；掉 ${fury.count} 次裝備、物品等級 +${fury.ilvlPlus}（最高 ${GEAR_ILVL_MAX}）、稀有度權重 ${fury.rarity.join('：')}。\n`;
    if (st.hiddenElite) s += `\n**隱藏首領**：不倒下連殺 ${st.hiddenElite.streak} 隻出現（${ENEMIES[st.hiddenElite.enemyId]?.name ?? ''}，掉落 +${st.hiddenElite.lootPct ?? 0}%、物品等級 +2、稀有權重 ×2）。\n`;
    if (st.riot) s += `\n**狼群暴動**：不定時一群 ${ENEMIES[st.riot.enemyId]?.name ?? ''} 衝過來，掉落 +${st.riot.lootPct ?? 0}%。\n`;
    s += '\n';
  }
  void RARITY_NAME;
  return s;
}

function indexPage(): string {
  return `# 《命運之境》遊戲 Wiki

> 本 Wiki 由 \`npm run wiki\` 從遊戲資料自動產生，數字與遊戲版本一致。回 [README](../../README.md)

| 頁面 | 內容 |
|---|---|
| [強化系統](enhance.md) | +1～+${ENH_MAX} 的材料、成功率、數值倍率、平均花費 |
| [技能樹](skills.md) | 長劍／長弓／法杖的五個技能、每級加成、三種打法（原招／變化／變化二） |
| [裝備與神裝](gear.md) | 部位、稀有度、詞綴與技能特效範圍、各部位名稱、神裝清單與刷法 |
| [怪物與掉落](monsters.md) | 四張地圖每隻怪的數值、金幣／粉塵／結晶／藥水機率、裝備掉率與稀有度權重 |
| [畫面集](gallery.md) | 70 張遊戲截圖：三把武器的技能與變化、Boss、地圖、行囊、行商、燼牌… |
| [交易・競技場・線上化](online.md) | 拍賣所、面對面交易、競技場天梯、多角色；「換掉連線字串就能上線」的架構與防作弊（手寫，不是產生的） |

## 新手三件事
1. 技能會自己放，你只管走位：**紅色／黃框預告**走出去，來不及就按閃避。
2. 升級後打開 ☰ → **技能樹**點技能；撿到裝備打開「行囊」換上。
3. 在**營火旁**休息、強化、找行商買賣，或打一場營火燼牌。

## 地圖順序
${WORLD_MAPS.map((m, i) => `${i + 1}. **${m.name}**（Boss：${m.boss}，建議 Lv${m.bossLv}）${m.postGame ? '——通關後開放' : ''}`).join('\n')}
`;
}

const PAGES: Record<string, () => string> = { 'README.md': indexPage, 'enhance.md': enhancePage, 'skills.md': skillsPage, 'gear.md': gearPage, 'monsters.md': monstersPage };

describe('wiki 產生器', () => {
  it('每一頁都能產生、沒有 undefined／NaN', () => {
    for (const [f, fn] of Object.entries(PAGES)) {
      const t = fn();
      expect(t.length, f).toBeGreaterThan(300);
      expect(t, f).not.toMatch(/undefined|NaN/);
    }
  });
  it.runIf(process.env.WIKI === '1')('寫入 docs/wiki', () => {
    mkdirSync('docs/wiki', { recursive: true });
    for (const [f, fn] of Object.entries(PAGES)) writeFileSync(`docs/wiki/${f}`, fn());
  });
});
