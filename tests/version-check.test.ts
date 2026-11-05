import { describe, expect, it } from 'vitest';
import { decideUpdate, isNewer, parseBuildInfo, reloadUrl, updateText } from '../src/versionCheck';

const L = { version: '1.0.1', build: 'aaaaaaa', time: 1000 };
const R = { version: '1.0.2', build: 'bbbbbbb', time: 2000 };

describe('versionCheck（D-270）', () => {
  it('parse 擋掉壞資料', () => {
    expect(parseBuildInfo(R)).toEqual(R);
    expect(parseBuildInfo(null)).toBeNull();
    expect(parseBuildInfo({ version: '1', build: '', time: 1 })).toBeNull();
    expect(parseBuildInfo({ version: '1', build: 'x', time: 'no' })).toBeNull();
    expect(parseBuildInfo('<html>')).toBeNull();
  });
  it('只有不同 build 而且比較新才算新版', () => {
    expect(isNewer(L, R)).toBe(true);
    expect(isNewer(L, { ...R, build: L.build })).toBe(false);
    expect(isNewer(L, { ...R, time: 500 })).toBe(false); // CDN 舊資料不倒退
    expect(isNewer(L, null)).toBe(false); // 離線
  });
  it('標題自動重整、冒險中跳提示、App 請下載、重整過一次還是舊的就不再重整', () => {
    const o = { native: false, inGame: false, tried: null };
    expect(decideUpdate(L, R, o)).toBe('reload');
    expect(decideUpdate(L, R, { ...o, inGame: true })).toBe('banner');
    expect(decideUpdate(L, R, { ...o, tried: R.build })).toBe('banner');
    expect(decideUpdate(L, R, { ...o, native: true })).toBe('native');
    expect(decideUpdate(L, L, o)).toBe('none');
    expect(decideUpdate(L, null, o)).toBe('none');
  });
  it('重整網址保留 debug、換掉舊的 v', () => {
    expect(reloadUrl('https://x.io/JackyGame/?debug&v=old#a', 'bbb')).toBe('https://x.io/JackyGame/?debug=&v=bbb');
    expect(reloadUrl('https://x.io/JackyGame/', 'bbb')).toBe('https://x.io/JackyGame/?v=bbb');
  });
  it('提示文字', () => {
    expect(updateText(L, R, 'web')).toBe('有新版本 1.0.2（你的是 1.0.1）');
    expect(updateText(L, { ...R, version: '1.0.1' }, 'web')).toBe('有新版本 1.0.1');
    expect(updateText(L, R, 'android')).toContain('APK');
  });
});
