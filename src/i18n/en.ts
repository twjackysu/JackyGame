import type { MessageKey } from './zh-TW';

/** English. Missing keys fall back to zh-TW. */
export const en: Partial<Record<MessageKey, string>> = {
  'game.title': 'Realm of Fate',
  'game.subtitle': 'Reborn in Another World',
  'title.tapToStart': 'Tap to Start',
  'title.version': 'v{version}',
  'boot.loading': 'Loading…',
  'auto.on': 'AUTO',
  'auto.off': 'MANUAL',
  'auto.locked': 'MANUAL',
  'auto.badge': 'AUTO',
  'auto.descOn': 'Auto-cast ON (fires when ready and in reach)',
  'auto.descOff': 'Auto-cast OFF (press it yourself)',
  'auto.descLocked': 'Always manual: time it against the red telegraph',
  'auto.tip': 'Your attack skills now cast by themselves — just move and dodge (MENU → Skills to switch back)',
  'bless.title': 'Ember Blessing',
  'bless.sub': 'Pick one — lasts this run (lost when you rest at a campfire or fall)',
  'bless.have': 'Active: ',
  'bless.reroll': 'Reroll ({n} left)',
  'bless.noReroll': 'No rerolls left',
  'bless.got': 'Blessing: {name}',
  'bless.gone': 'Your ember blessings fade',
  'bless.restAsk': 'Resting clears your {n} blessing(s)\nTap the campfire again to confirm',
  'bless.tip': 'Ember Blessings: kills fill the flame (top right); pick one when full. Resting or falling clears them',
};
