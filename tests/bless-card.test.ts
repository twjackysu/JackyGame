// 第 205 輪（D-410）：祝福卡上的「觸發方式」小標與「搭配」提示——純資料規則。
// 連動本身的行為（影步的必暴觸發綻光、燼爆連鎖、疾雷縮短五欄冷卻…）在 tests/rt-bless.test.ts。
import { describe, expect, it } from 'vitest';
import { EFFECT_IDS, effectDef, tryVariantId } from '../src/core/battle/rt/effects';
import { UNIQUE_IDS } from '../src/core/battle/rt/gear';
import { BLESS_CARD, blessSynergy, blessTrigger, synergyKey, type BlessTrigger } from '../src/game/ui/blessCard';
import { en } from '../src/i18n/en';
import { zhTW } from '../src/i18n/zh-TW';

const def = (id: string, w: 'sword' | 'bow' | 'staff' = 'sword') => effectDef(id, w)!;
const syn = (offer: string, ...have: string[]) => blessSynergy(def(offer), have.map((h) => def(h)));
const SKILLS = ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'];
const ALL = [...EFFECT_IDS, ...SKILLS.flatMap((s) => [tryVariantId(s, 1), tryVariantId(s, 2)])];

describe('祝福卡的小標與搭配（D-410）', () => {
  it('每個效果（含試招、獨特效果）都有觸發方式的小標，中英文都有字', () => {
    const want: Record<string, BlessTrigger> = { ember_edge: 'attack', storm_caller: 'attack', frost_touch: 'skill', venom_skill: 'skill', heavy_echo: 'skill', shadow_step: 'dodge', after_image: 'dodge', ember_burst: 'kill', vital_ember: 'kill', crit_bloom: 'crit', guard_pulse: 'guard', executioner: 'execute', quick_hands: 'cooldown', wide_arc: 'boost' };
    for (const [id, trig] of Object.entries(want)) expect(blessTrigger(def(id)), id).toBe(trig);
    expect(blessTrigger(def(tryVariantId('whirlwind', 1)))).toBe('variant');
    for (const id of [...ALL, ...UNIQUE_IDS]) {
      const k = `bless.trig.${blessTrigger(def(id))}`;
      expect((zhTW as Record<string, string>)[k], k).toBeTruthy();
      expect((en as Record<string, string>)[k], k).toBeTruthy();
    }
  });

  it('搭配：只在真的會互相帶動時出現，方向說對', () => {
    // 必暴 × 暴擊就炸（兩個方向的說法不同）
    expect(syn('crit_bloom', 'shadow_step')).toMatchObject({ kind: 'crit', lead: false, with: { id: 'shadow_step' } });
    expect(syn('shadow_step', 'crit_bloom')).toMatchObject({ kind: 'crit', lead: true });
    // 冷卻縮短 × 靠技能觸發
    for (const id of ['frost_touch', 'venom_skill', 'heavy_echo', 'guard_pulse']) {
      expect(syn(id, 'quick_hands'), id).toMatchObject({ kind: 'cooldown', lead: false });
      expect(syn('quick_hands', id), id).toMatchObject({ kind: 'cooldown', lead: true });
    }
    // 斬首 × 擊殺觸發；同一個時機的兩個
    expect(syn('executioner', 'ember_burst')).toMatchObject({ kind: 'finish', lead: true });
    expect(syn('vital_ember', 'executioner')).toMatchObject({ kind: 'finish', lead: false });
    expect(syn('after_image', 'shadow_step')).toMatchObject({ kind: 'dodge' });
    expect(syn('vital_ember', 'ember_burst')).toMatchObject({ kind: 'kill' });
    expect(syn('venom_skill', 'frost_touch')).toMatchObject({ kind: 'skillHit' });
    expect(syn('storm_caller', 'ember_edge')).toMatchObject({ kind: 'attack' });
    // 沒有連動的不硬湊
    expect(syn('wide_arc', 'executioner', 'shadow_step', 'ember_edge')).toBeUndefined();
    expect(syn('ember_edge', 'frost_touch', 'quick_hands', 'crit_bloom')).toBeUndefined();
    expect(syn('quick_hands', 'ember_edge', 'executioner', 'wide_arc')).toBeUndefined();
    expect(syn('crit_bloom')).toBeUndefined();
    // 自己不和自己搭（獨特效果裝備和祝福是同一池）
    expect(syn('shadow_step', 'shadow_step')).toBeUndefined();
  });

  it('身上有好幾個對得上時，挑最有感的那一條（必暴連動排最前）', () => {
    expect(syn('crit_bloom', 'quick_hands', 'shadow_step')).toMatchObject({ kind: 'crit', with: { id: 'shadow_step' } });
    expect(syn('after_image', 'shadow_step', 'quick_hands')).toMatchObject({ kind: 'dodge' });
    expect(syn('vital_ember', 'ember_burst', 'executioner')).toMatchObject({ kind: 'finish', with: { id: 'executioner' } });
  });

  it('每一種搭配的字都放得進卡片下緣那條籤（三把武器、所有配對）', () => {
    let seen = 0;
    for (const w of ['sword', 'bow', 'staff'] as const) {
      for (const a of ALL) {
        for (const b of [...EFFECT_IDS, ...UNIQUE_IDS]) {
          const s = blessSynergy(def(a, w), [def(b, w)]);
          if (!s) continue;
          seen++;
          for (const tbl of [zhTW, en] as Record<string, string>[]) {
            const raw = tbl[synergyKey(s)];
            expect(raw, synergyKey(s)).toBeTruthy();
            const text = `✦ ${tbl['bless.syn.pre']}｜${raw!.replace('{name}', s.with.name)}`;
            // 粗估寬度：全形字＝字級、半形＝字級的 0.56；卡寬 640、兩邊各留 18＋膠囊內距 14
            const wpx = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.56) * BLESS_CARD.synFont, 0) + 28;
            expect(wpx, text).toBeLessThanOrEqual(640 - 36);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(30);
  });
});

// 第 206 輪：效果圖鑑每條獨特效果列出「搭配祝福」——同一份 pair 規則
describe('效果圖鑑的搭配祝福（blessPartners）', async () => {
  const { CODEX_SYN, blessPartners, codexSynNames } = await import('../src/game/ui/blessCard');
  const pool = EFFECT_IDS.map((id) => def(id));
  const ids = (id: string) => blessPartners(def(id), pool).map((d) => d.id);
  it('列出真的會連動的、不含自己，最要緊的排前面', () => {
    expect(ids('shadow_step')[0]).toBe('crit_bloom'); // 必暴引爆綻光排在「同一下閃避」的殘影前面
    expect(ids('shadow_step')).toContain('after_image');
    expect(ids('executioner')).toEqual(expect.arrayContaining(['ember_burst', 'vital_ember']));
    expect(ids('guard_pulse')).toEqual(['quick_hands']);
    for (const id of EFFECT_IDS) expect(ids(id), id).not.toContain(id);
  });
  it('兩邊對得上：A 的清單有 B，B 的清單就有 A', () => {
    for (const a of EFFECT_IDS) for (const b of ids(a)) expect(ids(b), `${b}←${a}`).toContain(a);
  });
  it('名字太多時只列前幾個、後面加「…」', () => {
    const m = [{ name: '甲' }, { name: '乙' }, { name: '丙' }];
    expect(codexSynNames(m, 3)).toBe('甲、乙、丙');
    expect(codexSynNames(m, 2)).toBe('甲、乙…');
    expect(CODEX_SYN.max).toBeGreaterThanOrEqual(1);
    expect((zhTW as Record<string, string>)['codex.syn']).toContain('{names}');
    expect((en as Record<string, string>)['codex.syn']).toContain('{names}');
  });
});
