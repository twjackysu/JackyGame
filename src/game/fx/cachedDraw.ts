// 把「指令很多、動作很慢」的程式美術（營火旁的旅商／燼牌對手、路上的相遇人物）畫進一張小貼圖（D-332）。
// Phaser 的 Graphics 每一幀都會把全部指令重新拆成三角形；一個旅商就有幾百筆，營火旁兩個人＋相遇的人
// 每幀約 1,600 筆（第 154 輪量的，占冒險地圖 Graphics 的一半以上）。改成：每秒重畫 24 次到 RenderTexture，
// 其他幀只移動那張貼圖（跟著鏡頭走、位置每幀都準）。呼吸、眨眼、斗篷晃動這些慢動作 24fps 看不出差別。
import Phaser from 'phaser';

/** 貼圖範圍（以腳底為原點、單位是 s＝每個設計單位幾像素）：左、上、右、下 */
export interface DrawBox { l: number; t: number; r: number; b: number }

export class CachedDraw {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly ax: number;
  private readonly ay: number;
  private last = -1e9;
  private lastKey = '';

  /** s＝每個設計單位幾像素（固定，地圖的縮放不會變）；box 用設計單位。要在場景 create 時、跟它同層的 Graphics 之前建立（同 depth 時才排在下面）。 */
  constructor(scene: Phaser.Scene, s: number, box: DrawBox, private readonly hz = 24) {
    const w = Math.ceil((box.r - box.l) * s);
    const h = Math.ceil((box.b - box.t) * s);
    this.ax = Math.round(-box.l * s);
    this.ay = Math.round(-box.t * s);
    this.g = scene.make.graphics({}, false);
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setVisible(false);
    // 畫筆不在場景的顯示列表上，場景關掉時要自己收（貼圖會跟著場景一起收）
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.g.destroy());
  }

  setDepth(d: number): this {
    this.rt.setDepth(d);
    return this;
  }

  /**
   * 腳底畫在畫面 (x, y)。key 不同（換了人物、換了樣子）就馬上重畫；否則每 1/hz 秒重畫一次。
   * draw 收到的是貼圖裡的腳底座標。
   */
  show(x: number, y: number, now: number, key: string, draw: (g: Phaser.GameObjects.Graphics, fx: number, fy: number, now: number) => void): void {
    if (key !== this.lastKey || now - this.last >= 1000 / this.hz || now < this.last) {
      this.last = now;
      this.lastKey = key;
      draw(this.g.clear(), this.ax, this.ay, now);
      this.rt.clear().draw(this.g, 0, 0);
    }
    this.rt.setPosition(x - this.ax, y - this.ay).setVisible(true);
  }

  hide(): void {
    this.rt.setVisible(false);
  }

}
