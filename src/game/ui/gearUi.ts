// 商店與背包共用的小元件：道具圖示、數值文字、角色有效數值。
import Phaser from 'phaser';
import { statsAtLevel, type BaseStats } from '../../core/battle/formulas';
import { gearBonus } from '../../core/state/equip';
import type { GameState, MemberId } from '../../core/state/gameState';
import { HEROES } from '../../data/combatants';
import { itemDef, type ItemDef } from '../../data/equipment';
import { UI_FONT } from '../fx/feel';

const GLYPH: Record<string, string> = { weapon: '⚔', armor: '⛨', charm: '◈', use: '✚', key: '✦' };
const GLYPH_COL: Record<string, number> = { weapon: 0xffb070, armor: 0x9fc8ff, charm: 0xd8a0ff, use: 0x8fffb0, key: 0xffe08a };

/** 道具圖示：有 AI 圖就用圖（可加 tint 區分階級），沒有就畫圓底＋符號 */
export function itemIcon(scene: Phaser.Scene, id: string, x: number, y: number, size: number): Phaser.GameObjects.GameObject[] {
  const d = itemDef(id);
  const out: Phaser.GameObjects.GameObject[] = [];
  const kindKey = d.slot ?? d.kind;
  const halo = scene.add.circle(x, y, size * 0.48, GLYPH_COL[kindKey] ?? 0xffffff, 0.12);
  out.push(halo);
  if (d.icon && scene.textures.exists(d.icon)) {
    const img = scene.add.image(x, y, d.icon);
    img.setScale(size / Math.max(img.width, img.height));
    if (d.tint) img.setTint(d.tint);
    out.push(img);
  } else {
    halo.setFillStyle(0x1a2040, 1).setStrokeStyle(2, GLYPH_COL[kindKey] ?? 0xffffff, 0.8);
    out.push(scene.add.text(x, y, GLYPH[kindKey] ?? '?', { fontFamily: UI_FONT, fontSize: `${Math.round(size * 0.5)}px`, color: '#ffffff' }).setOrigin(0.5));
  }
  return out;
}

const STAT_LABEL: [keyof BaseStats, string][] = [['atk', 'ATK'], ['def', 'DEF'], ['hp', 'HP'], ['spd', 'SPD']];

/** 「ATK+4　DEF+2」 */
export function bonusText(b: Partial<BaseStats> | undefined): string {
  if (!b) return '';
  return STAT_LABEL.filter(([k]) => (b[k] ?? 0) !== 0).map(([k, l]) => `${l}${(b[k] ?? 0) > 0 ? '+' : ''}${b[k]}`).join('　');
}

/** 差異：「ATK▲4 DEF▼1」；全 0 回傳空字串 */
export function deltaText(b: BaseStats): string {
  return STAT_LABEL.filter(([k]) => b[k] !== 0).map(([k, l]) => `${l}${b[k] > 0 ? '▲' : '▼'}${Math.abs(b[k])}`).join(' ');
}

export function deltaScore(b: BaseStats): number {
  return b.atk * 3 + b.def * 3 + b.hp * 0.4 + b.spd * 4;
}

/** 道具的一行說明（裝備：數值＋誰能裝） */
export function itemSubline(d: ItemDef): string {
  if (d.kind !== 'gear') return d.desc;
  const who = d.for ? `　${d.for.map((m) => HEROES[m]?.name ?? m).join('、')}` : '　全員';
  return `${bonusText(d.bonus)}${who}`;
}

/** 角色有效數值（等級＋裝備） */
export function memberStats(s: GameState, m: MemberId): { base: BaseStats; bonus: BaseStats; level: number } {
  const level = s.members[m]?.level ?? 1;
  const st = statsAtLevel(HEROES[m].base, level);
  return { base: { hp: st.hp, atk: st.atk, def: st.def, spd: st.spd }, bonus: gearBonus(s, m), level };
}

export function heroName(m: MemberId): string {
  return HEROES[m]?.name ?? m;
}
