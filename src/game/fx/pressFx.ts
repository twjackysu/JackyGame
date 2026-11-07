// 按鈕按下的回饋（A5，第 152 輪）：全遊戲的文字按鈕（有底色、置中的 Text）按下時縮一下再彈回來＋一道亮光掃過。
// 不用每個面板各自加：每個場景 create 後在它的 input 上聽 gameobjectdown，一個地方管全部。
// 純畫面：不改任何按鈕的行為；物件正在被別的 tween 動（例如呼吸的提示鍵）就不碰它。
import Phaser from 'phaser';
import { getSettings } from '../settings';

const PRESS = 0.9;
const MS = 70;

function isButton(o: Phaser.GameObjects.GameObject): o is Phaser.GameObjects.Text {
  if (!(o instanceof Phaser.GameObjects.Text)) return false;
  const bg = o.style.backgroundColor;
  return !!bg && bg !== 'transparent' && o.originX === 0.5 && o.originY === 0.5;
}

/** 亮光：一條斜的白色半透明長方形從左掃到右（加在按鈕所在的容器裡，跟著位移） */
function gloss(scene: Phaser.Scene, t: Phaser.GameObjects.Text): void {
  const w = t.displayWidth;
  const h = t.displayHeight;
  const bar = scene.add.rectangle(t.x - w / 2, t.y, Math.max(10, w * 0.12), h, 0xffffff, 0.35).setAngle(14).setBlendMode(Phaser.BlendModes.ADD);
  bar.setDepth(t.depth + 0.01);
  const parent = t.parentContainer;
  if (parent) parent.addAt(bar, parent.getIndex(t) + 1);
  // 只露出按鈕範圍內的部分：用 alpha 收尾代替遮罩（遮罩每個按鈕一張太貴）
  scene.tweens.add({ targets: bar, x: t.x + w / 2, alpha: 0, duration: 240, ease: 'Sine.In', onComplete: () => bar.destroy() });
}

export function pressFx(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject): void {
  if (!isButton(o) || !o.active || scene.tweens.isTweening(o)) return;
  const sx = o.scaleX;
  const sy = o.scaleY;
  scene.tweens.add({ targets: o, scaleX: sx * PRESS, scaleY: sy * PRESS, duration: MS, yoyo: true, ease: 'Quad.Out', onComplete: () => { if (o.active) o.setScale(sx, sy); } });
  if (!getSettings().lowFx) gloss(scene, o);
}

let installed = false;
export function installPressFx(game: Phaser.Game): void {
  if (installed) return;
  installed = true;
  const attach = (sc: Phaser.Scene): void => {
    sc.input?.on(Phaser.Input.Events.GAMEOBJECT_DOWN, (_p: Phaser.Input.Pointer, o: Phaser.GameObjects.GameObject) => pressFx(sc, o));
  };
  const hook = (sc: Phaser.Scene): void => {
    // InputPlugin 在場景關掉時會清掉自己的監聽 → 每次 create 都重新掛；已經在跑的（開機第一個場景）現在就掛
    sc.sys.events.on(Phaser.Scenes.Events.CREATE, () => attach(sc));
    if (sc.sys.settings.status >= Phaser.Scenes.CREATING && sc.sys.settings.status <= Phaser.Scenes.SLEEPING) attach(sc);
  };
  const all = (): void => { for (const sc of game.scene.scenes) hook(sc); };
  // isBooted 在 boot() 就是 true，但場景要到 READY（材質準備好）才加進 SceneManager → 看 isRunning
  if (game.isRunning) all();
  else game.events.once(Phaser.Core.Events.READY, all);
}
