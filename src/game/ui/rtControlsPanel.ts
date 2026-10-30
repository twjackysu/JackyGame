// 即時戰鬥「操作設定」面板（D-088）：調整按鈕位置／交換技能、左手模式、按鈕大小、桌機快捷鍵。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS } from '../../core/battle/rt/data';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { ACTIONS, ACTION_LABEL, SCALES, defaultControls, keyName, rebind, setLeftHand, type RtAction, type RtControls } from '../rtControls';

/** 開面板；關閉時呼叫 done（edit=true 代表要進「調整按鈕位置」模式）。回傳的容器由呼叫端在 done 裡銷毀 */
/** nameOf：技能欄 id → 顯示名稱（第 43 輪：拿弓／杖時以前還是列出長劍的招式名，要用呼叫端的 skillDef） */
export function openRtControlsPanel(scene: Phaser.Scene, start: RtControls, done: (c: RtControls, edit: boolean) => void, nameOf: (id: string) => string = (id) => SKILLS[id]?.name ?? id): Phaser.GameObjects.Container {
  let c = start;
  let waiting: RtAction | null = null;
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  const kb = scene.input.keyboard;
  const onKey = (ev: KeyboardEvent): void => {
    if (!waiting) return;
    ev.preventDefault?.();
    if (ev.keyCode !== 27) c = rebind(c, waiting, ev.keyCode); // Esc＝取消
    waiting = null;
    SFX.confirm();
    render();
  };
  kb?.on('keydown', onKey);
  root.once(Phaser.GameObjects.Events.DESTROY, () => kb?.off('keydown', onKey));

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 26): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(18, 9, 18, 9).setInteractive({ useHandCursor: true });
    t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    return t;
  };
  const label = (x: number, y: number, s: string, color = '#c8d0f0', size = 22, ox = 0.5): Phaser.GameObjects.Text =>
    scene.add.text(x, y, s, { fontFamily: UI_FONT, fontSize: `${size}px`, color }).setOrigin(ox, 0.5);

  function render(): void {
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.94).setInteractive()];
    items.push(scene.add.text(0, -570, '操作設定', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(btn(0, -480, '調整按鈕位置・交換技能 ▶', () => done(c, true), true, 28));
    items.push(label(-300, -400, '左手模式', '#ffffff', 26, 0));
    items.push(btn(120, -400, c.leftHand ? '開（搖桿在右）' : '關（搖桿在左）', () => {
      c = setLeftHand(c, !c.leftHand);
      render();
    }));
    items.push(label(-300, -325, '按鈕大小', '#ffffff', 26, 0));
    (['小', '中', '大'] as const).forEach((n, i) => {
      items.push(btn(30 + i * 100, -325, n, () => {
        c = { ...c, scale: SCALES[i]! };
        render();
      }, c.scale === SCALES[i]));
    });
    items.push(label(0, -262, `技能欄：${c.order.map((id, i) => `${i + 1} ${nameOf(id)}`).join('　')}`, '#e8dcc0', 21));
    items.push(label(0, -215, waiting ? `請按下「${ACTION_LABEL[waiting]}」的新按鍵（Esc 取消）` : '桌機快捷鍵：點一下，再按想要的鍵（手機不用設）', waiting ? '#7dffb0' : '#c8d0f0', 22));
    ACTIONS.forEach((a, i) => {
      const col = i < 4 ? 0 : 1; // 左欄：走路四鍵；右欄：技能與其他
      const row = col === 0 ? i : i - 4;
      const x = col === 0 ? -170 : 170;
      const y = -160 + row * 58;
      const sk = a.startsWith('slot') ? nameOf(c.order[Number(a.slice(4)) - 1]!) : null;
      items.push(label(x - 150, y, sk ? `${ACTION_LABEL[a]}（${sk}）` : ACTION_LABEL[a], '#ffffff', 19, 0));
      items.push(btn(x + 110, y, waiting === a ? '…' : keyName(c.keys[a]), () => {
        waiting = waiting === a ? null : a;
        render();
      }, waiting === a, 20));
    });
    items.push(btn(-150, 300 + Math.round(TALL * 0.45), '全部恢復預設', () => {
      c = defaultControls();
      waiting = null;
      render();
    }));
    items.push(btn(150, 300 + Math.round(TALL * 0.45), '完成', () => done(c, false), true, 28));
    root.add(items);
  }
  render();
  return root;
}
