// 面板遮擋（Q5 拆 RtBattleScene 第二塊，第 143 輪）：☰／行商／行囊等面板開著，或在「調整按鈕位置」時，
// 把會從半透明遮罩底下透出來的字藏起來，面板關掉後還原。原本是場景的 menuBanners()＋bannerHidden（行為不變）。
import Phaser from 'phaser';
import { BANNER_DEPTH } from '../fx/feel';

/** 場景每幀交給這個系統看的東西（都是場景自己的物件，系統不持有場景） */
export interface BannerView {
  menuActive: boolean;
  editing: boolean;
  hint?: Phaser.GameObjects.GameObject & { active: boolean; setVisible(v: boolean): unknown };
  topCard?: { active: boolean; setVisible(v: boolean): unknown } | null;
  calmText?: Phaser.GameObjects.Text | null;
  children: readonly Phaser.GameObjects.GameObject[];
  /** 地區名稱／說明字（depth 66） */
  zoneTexts: readonly Phaser.GameObjects.Text[];
  /** HUD 字：箭頭距離、出口箭頭、懸賞板（☰ 開著藏、調位置時照常顯示） */
  hud: (t: Phaser.GameObjects.Text) => boolean;
}

export class BannerSystem {
  /** 被藏起來、等一下要還原的字 */
  private readonly hidden = new Set<Phaser.GameObjects.Text>();

  reset(): void {
    this.hidden.clear();
  }

  update(v: BannerView): void {
    // 第 47 輪：開場操作說明框（depth 70）會透過面板的半透明遮罩疊在「技能點」標題上 → 面板開著時一起藏起
    if (v.hint?.active) v.hint.setVisible(!v.menuActive && !v.editing);
    // 第 59 輪：上方的記憶卡／回禮卡（depth 940）從暫停選單（960、遮罩 0.84）底下透出來 → 一起藏起
    if (v.topCard?.active) v.topCard.setVisible(!v.menuActive && !v.editing);
    // 第 103 輪：營火旁／休息中的字條（depth 65）在 ☰ 遮罩底下透到「回標題」鈕旁邊 → 面板開著時藏起；關掉後下一幀 HUD 會照原條件再顯示
    if (v.menuActive && v.calmText?.visible) v.calmText.setVisible(false);
    // 第 105 輪（D-253）：調整按鈕位置時也藏置中大字／地區字（HUD、營火字條、箭頭距離字照常顯示：調位置要看得到實際畫面）
    const editing = v.editing && !v.menuActive;
    if (editing && this.hidden.size) {
      // 從 ☰ 進來時被藏的 HUD 字先還原
      for (const t of this.hidden)
        if (t.active && v.hud(t)) {
          t.setVisible(true);
          this.hidden.delete(t);
        }
    }
    if (v.menuActive || editing) {
      for (const o of v.children) {
        // 第 102 輪（D-250）：地區名稱／說明也藏；第 104 輪（D-252）：箭頭距離字、懸賞板也藏
        if (!(o instanceof Phaser.GameObjects.Text) || !o.visible) continue;
        if (o.depth === BANNER_DEPTH || v.zoneTexts.includes(o) || (!editing && v.hud(o))) {
          o.setVisible(false);
          this.hidden.add(o);
        }
      }
    } else if (this.hidden.size) {
      for (const t of this.hidden) if (t.active) t.setVisible(true);
      this.hidden.clear();
    }
  }
}
