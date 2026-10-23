import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, getLocale, setLocale, t } from '../src/i18n';

afterEach(() => setLocale(DEFAULT_LOCALE));

describe('i18n t()', () => {
  it('defaults to zh-TW', () => {
    expect(getLocale()).toBe('zh-TW');
    expect(t('game.title')).toBe('星燼回響');
    expect(t('title.tapToStart')).toBe('點擊開始');
  });

  it('switches locale', () => {
    setLocale('en');
    expect(t('title.tapToStart')).toBe('Tap to Start');
  });

  it('falls back to the key for unknown keys', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates params and leaves unknown placeholders', () => {
    expect(t('title.version', { version: '1.2.3' })).toBe('版本 1.2.3');
    expect(t('title.version')).toBe('版本 {version}');
  });
});
