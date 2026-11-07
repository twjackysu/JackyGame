// 「前世的記憶」本子（從 RtBattleScene 照搬，第 153 輪 Q5）：每張地圖一塊、放不下就分頁、內容比畫面矮時整組置中。
// 只是顯示：讀 loadMemories，不改任何資料。返回鍵交給呼叫的人（場景會回暫停選單）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { loadMemories, MEMORIES, memoriesOf } from '../memories';
import { mapOpen } from '../rtRecord';
import { WORLD_MAPS } from '../worldMaps';

export function buildMemoryBook(scene: Phaser.Scene, onBack: () => void): Phaser.GameObjects.Container {
  const have = loadMemories();
  const H2 = GAME_HEIGHT / 2;
  const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0614, 0.92).setInteractive()];
  const top = -H2 + 100;
  items.push(scene.add.text(0, top, `✦ 前世的記憶　${have.length}/${MEMORIES.length}`, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#d8b0ff' }).setOrigin(0.5));
  const all = have.length >= MEMORIES.length;
  // 第 67 輪：全部想起來之後副標換成收尾的一句（以前 12/12 還在教「走過去就會想起來」）
  items.push(scene.add.text(0, top + 52, all ? '全部想起來了・這一世的故事，換你自己寫下去' : '地上浮著的紫色光點・走過去就會想起來（每段 +1 結晶）', { fontFamily: UI_FONT, fontSize: '19px', color: all ? '#d8b0ff' : '#9a88b8' }).setOrigin(0.5));
  // 每張地圖一塊；放不下就分頁（第 42 輪：12 段全想起來時，360×640 最後一段會蓋到「返回」）
  const y0 = top + 100;
  const room = H2 - 130 - y0; // 下面留給返回／翻頁
  const blocks: Phaser.GameObjects.Container[] = [];
  for (const wm of WORLD_MAPS) {
    const c = scene.add.container(0, 0);
    // 第 99 輪（D-246）：還沒開放的地圖不寫名字（標題也只列開放的地圖；以前第一張圖就看到「星隕高原」）
    const known = mapOpen(wm.id);
    c.add(scene.add.text(-310, 0, known ? wm.name : '？？？（還沒去過的地方）', { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: known ? wm.color : '#6a5a80' }).setOrigin(0, 0));
    let y = 38;
    for (const m of memoriesOf(wm.id)) {
      const got = have.includes(m.id);
      const t = scene.add.text(-290, y, got ? m.lines : '？？？（還沒想起來）', { fontFamily: got ? TITLE_FONT : UI_FONT, fontSize: '20px', color: got ? '#f0e6ff' : '#6a5a80', lineSpacing: 6, wordWrap: { width: 590, useAdvancedWrap: true } }).setOrigin(0, 0);
      c.add(t);
      y += t.height + 16;
    }
    c.setData('h', y + 14);
    blocks.push(c);
  }
  if (all) {
    // 第 67 輪：12 段全收集的小結語（接在最後一張地圖後面，最後一頁原本空一大塊）
    const c = scene.add.container(0, 0);
    const t = scene.add.text(0, 10, '——停服那一晚，最後一個念頭是「好想再玩一次」。\n現在不用登入，也不會再停服了。', { fontFamily: TITLE_FONT, fontSize: '20px', color: '#ffd8a0', align: 'center', lineSpacing: 8, wordWrap: { width: 600, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    c.add(t);
    c.setData('h', t.height + 40);
    blocks.push(c);
  }
  const pages: Phaser.GameObjects.Container[][] = [[]];
  let used = 0;
  for (const c of blocks) {
    const h = c.getData('h') as number;
    if (used + h > room && pages[pages.length - 1]!.length) {
      pages.push([]);
      used = 0;
    }
    c.setY(y0 + used);
    used += h;
    pages[pages.length - 1]!.push(c);
    items.push(c);
  }
  const lastY = Math.max(...pages.map((pg) => pg.reduce((n, c) => n + (c.getData('h') as number), 0)));
  const by = Math.min(y0 + lastY + 40, H2 - 70);
  let page = 0;
  const btn = (x: number, label: string, fn: () => void, main = false): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, by, label, { fontFamily: UI_FONT, fontSize: main ? '28px' : '24px', fontStyle: '700', color: '#1a0f08', backgroundColor: main ? '#d8b0ff' : '#a890c8' }).setOrigin(0.5).setPadding(main ? 28 : 18, 12, main ? 28 : 18, 12).setInteractive({ useHandCursor: true });
    t.on('pointerdown', fn);
    items.push(t);
    return t;
  };
  const pageTxt = pages.length > 1 ? scene.add.text(0, by - 52, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#9a88b8' }).setOrigin(0.5) : null;
  if (pageTxt) items.push(pageTxt);
  const show = (): void => {
    pages.forEach((pg, i) => pg.forEach((c) => c.setVisible(i === page)));
    pageTxt?.setText(`第 ${page + 1}／${pages.length} 頁`);
  };
  if (pages.length > 1) {
    btn(-200, '‹ 上一頁', () => { SFX.uiTap(); page = (page + pages.length - 1) % pages.length; show(); });
    btn(200, '下一頁 ›', () => { SFX.uiTap(); page = (page + 1) % pages.length; show(); });
  }
  show();
  btn(0, '返回', () => {
    SFX.uiCancel();
    onBack();
  }, true);
  // 第 47 輪：長螢幕上整本擠在上半部、標題貼著 HUD，下半部空著 → 內容比畫面矮時整組往下挪到置中
  const shift = Math.max(0, Math.floor((H2 - 70 - by) / 2));
  if (shift) for (const o of items.slice(1)) (o as unknown as Phaser.GameObjects.Components.Transform).y += shift;
  return scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, items).setDepth(960);
}
