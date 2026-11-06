// 換角色時舊 key 的替換（D-302）：角色的 key 全換掉，裝置 key（操作設定、教學提示、開場、備份）留著。
import { describe, expect, it } from 'vitest';
import { applyLegacy } from '../src/client/roster';
import { pickName, NAME_POOL } from '../src/game/rosterNames';
import { MapStorage } from './server-contract/backends';

describe('applyLegacy', () => {
  it('清掉舊角色的 key、寫入新角色的；裝置 key 不動；別的程式的 key 不動', () => {
    const ls = new MapStorage();
    const old: Record<string, string> = { jg_rt_mistwood: '{"level":12}', jg_rt_thornvale: '{"bossKills":1}', jg_weapon: 'bow', jg_memories: '["m1"]', jg_cards: '{}', jg_rt_controls: '{"a":1}', jg_rt_hint_seen: '1', jg_tip_block: '1', jg_prologue_seen: '1', jg_backup_1: '{}', jg_night_tips_mistwood: '2', 'jackygame.settings': '{"volume":0.5}' };
    for (const [k, v] of Object.entries(old)) ls.setItem(k, v);
    applyLegacy(ls, { jg_rt_mistwood: '{"level":1}', jg_weapon: 'staff', jg_tip_block: 'x', jg_rt_controls: 'x' });
    const now: Record<string, string> = {};
    for (let i = 0; i < ls.length; i++) now[ls.key(i)!] = ls.getItem(ls.key(i)!)!;
    expect(now).toEqual({ jg_rt_mistwood: '{"level":1}', jg_weapon: 'staff', jg_rt_controls: '{"a":1}', jg_rt_hint_seen: '1', jg_tip_block: '1', jg_prologue_seen: '1', jg_backup_1: '{}', jg_night_tips_mistwood: '2', 'jackygame.settings': '{"volume":0.5}' });
  });
  it('新角色名字挑沒用過的', () => {
    expect(pickName(['旅人'])).toBe(NAME_POOL[0]);
    expect(pickName([NAME_POOL[0]!])).toBe(NAME_POOL[1]);
  });
});
