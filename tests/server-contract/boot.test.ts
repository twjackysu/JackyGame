// 開機遷移的舊存檔收集（src/client/boot.ts）
import { describe, expect, it } from 'vitest';
import { legacySnapshot } from '../../src/client/boot';
import { MapStorage } from './backends';

describe('legacySnapshot', () => {
  it('只收 jg_ 開頭、不收備份與其他 key', () => {
    const st = new MapStorage();
    st.setItem('jg_rt_mistwood', '{"level":3}');
    st.setItem('jg_weapon', 'staff');
    st.setItem('jg_backup_1', '{}');
    st.setItem('jgdb:accounts\u0000a', '{}');
    st.setItem('jackygame.settings', '{}');
    expect(legacySnapshot(st)).toEqual({ jg_rt_mistwood: '{"level":3}', jg_weapon: 'staff' });
  });
});
