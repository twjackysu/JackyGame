import type { MessageKey } from './zh-TW';

/** English. Missing keys fall back to zh-TW. */
export const en: Partial<Record<MessageKey, string>> = {
  'game.title': 'Echoes of Starfall',
  'game.subtitle': 'Echoes of Starfall',
  'title.tapToStart': 'Tap to Start',
  'title.version': 'v{version}',
  'boot.loading': 'Loading…',
};
