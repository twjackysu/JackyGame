// 獨特效果圖鑑（P3-c，D-357）：十條效果、現在有沒有（行囊＋身上）、哪張圖掉——通關後「下一趟去哪、想換什麼」的目標（RF-09）。
// 只有顯示：效果資料、掉落表與機率都讀 core（effects.ts、loot.ts），這裡不放任何規則。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { effectDef } from '../../core/battle/rt/effects';
import { UNIQUE_COLOR, UNIQUE_IDS, UNIQUE_TITLES } from '../../core/battle/rt/gear';
import { UNIQUE_DROP, uniqueSources } from '../../core/battle/rt/loot';
import type { WeaponKind } from '../../core/battle/rt/data';
import { t } from '../../i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { drawEffectIcon } from '../fx/effectIcon';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { WORLD_MAPS } from '../worldMaps';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function openCodexPanel(scene: Phaser.Scene, weapon: WeaponKind, owned: readonly string[], stageId: string, onClose: () => void): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1850);
  const shade = scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06040a, 0.94).setInteractive();
  root.add(shade);
  // 長螢幕把每列拉高、字跟著放大（16:9 是 95、19.5:9 是 116）
  const ROW = Math.max(90, Math.min(116, Math.floor((GAME_HEIGHT - 330) / UNIQUE_IDS.length)));
  const f = (n: number): string => `${Math.round((n * ROW) / 94)}px`;
  const k = ROW / 94;
  const total = UNIQUE_IDS.length * ROW;
  const top = Math.max(150, Math.round(GAME_HEIGHT / 2 - total / 2 - 30));
  const got = UNIQUE_IDS.filter((id) => owned.includes(id)).length;
  root.add(scene.add.text(cx, top - 92, t('codex.title', { n: got, max: UNIQUE_IDS.length }), { fontFamily: TITLE_FONT, fontSize: '44px', color: hex(UNIQUE_COLOR), stroke: '#2a1404', strokeThickness: 7 }).setOrigin(0.5));
  root.add(scene.add.text(cx, top - 40, t('codex.sub'), { fontFamily: UI_FONT, fontSize: '20px', color: '#e8dcc0' }).setOrigin(0.5));
  const g = scene.add.graphics();
  root.add(g);
  const mapName = (id: string): string => WORLD_MAPS.find((m) => m.id === id)?.name ?? id;
  UNIQUE_IDS.forEach((id, i) => {
    const d = effectDef(id, weapon);
    if (!d) return;
    const y = top + i * ROW + ROW / 2;
    const has = owned.includes(id);
    const here = uniqueSources(id).includes(stageId);
    g.fillStyle(has ? 0x24160c : 0x16130f, 0.97).fillRoundedRect(cx - 336, y - ROW / 2 + 4, 672, ROW - 8, 12);
    g.lineStyle(has ? 3 : 2, has ? UNIQUE_COLOR : 0x4a4438, has ? 0.95 : 0.8).strokeRoundedRect(cx - 336, y - ROW / 2 + 4, 672, ROW - 8, 12);
    drawEffectIcon(g, cx - 288, y, 30, d.element, !has, d.glyph);
    if (has) g.lineStyle(4, UNIQUE_COLOR, 1).strokeCircle(cx - 288, y, 36);
    root.add(scene.add.text(cx - 240, y - 27 * k, d.name, { fontFamily: TITLE_FONT, fontSize: f(27), color: has ? hex(UNIQUE_COLOR) : '#b0a690', stroke: '#140a04', strokeThickness: 4 }).setOrigin(0, 0.5));
    root.add(scene.add.text(cx - 240 + Math.round(27 * k) * d.name.length + 14, y - 26 * k, t('codex.item', { title: UNIQUE_TITLES[id] ?? '' }), { fontFamily: UI_FONT, fontSize: f(17), color: '#8a8270' }).setOrigin(0, 0.5));
    root.add(scene.add.text(cx + 322, y - 27 * k, has ? t('codex.has') : t('codex.none'), { fontFamily: UI_FONT, fontSize: f(19), fontStyle: '700', color: has ? '#7dffb0' : '#8a8270' }).setOrigin(1, 0.5));
    root.add(scene.add.text(cx - 240, y + 2 * k, d.desc, { fontFamily: UI_FONT, fontSize: f(d.desc.length > 24 ? 17 : 19), color: has ? '#f4ecd8' : '#c8c0ac' }).setOrigin(0, 0.5));
    // 掉落地圖：這張圖會掉的用橘色標出來（不只靠顏色：前面加「▶」）
    const src = uniqueSources(id).map((s) => (s === stageId ? `▶${mapName(s)}` : mapName(s))).join('、');
    root.add(scene.add.text(cx - 240, y + 28 * k, t('codex.from', { maps: src }), { fontFamily: UI_FONT, fontSize: f(17), fontStyle: here ? '700' : '400', color: here ? '#ffb070' : '#9a927e' }).setOrigin(0, 0.5));
  });
  const foot = `${t('codex.rates', { elite: UNIQUE_DROP.elite, boss: UNIQUE_DROP.boss, hidden: UNIQUE_DROP.hidden, fury: UNIQUE_DROP.fury, night: UNIQUE_DROP.nightPlus })}\n${t('codex.rule')}`;
  root.add(scene.add.text(cx, top + total + 12, foot, { fontFamily: UI_FONT, fontSize: '19px', color: '#b8a888', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
  root.add(scene.add.text(cx, GAME_HEIGHT - 44, t('bless.listClose'), { fontFamily: UI_FONT, fontSize: '20px', color: '#8a8270' }).setOrigin(0.5));
  const openedAt = Date.now();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (Date.now() - openedAt < 250) return;
    SFX.uiTap();
    onClose();
  });
  return root;
}
