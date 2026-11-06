// 換角色清掉「剛遇到」（第 147 輪）：上一個角色選了「助」，新角色進同一張圖照樣有道謝。
import { describe, expect, it } from 'vitest';
import { encountersOf, forgetMetThisVisit, markMetThisVisit, pendingThanks } from '../src/game/encounters';

describe('metThisVisit 換角色', () => {
  it('forgetMetThisVisit 之後 pendingThanks 又看得到', () => {
    const e = encountersOf('mistwood')[0]!;
    markMetThisVisit(e.id, 'mistwood');
    expect(pendingThanks({ [e.id]: 'spare' }, 'mistwood').map((x) => x.id)).not.toContain(e.id);
    forgetMetThisVisit();
    expect(pendingThanks({ [e.id]: 'spare' }, 'mistwood').map((x) => x.id)).toContain(e.id);
  });
});
