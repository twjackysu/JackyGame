// 線上版正式登入（Entra，第 149 輪）：標題版本號上面一行「線上帳號：名字　〔登出〕」。
// 只從 TitleScene 的 VITE_SERVER_URL 分支動態載入，離線版 bundle 不含。
import Phaser from 'phaser';
import { bootServer } from '../../client/boot';
import { UI_FONT } from '../fx/feel';

export async function accountLine(scene: Phaser.Scene, x: number, y: number, busy: () => boolean): Promise<void> {
  const { account } = await bootServer();
  if (!account || !scene.sys.isActive()) return;
  const tx = scene.add
    .text(x, y, `線上帳號：${account.name}　〔登出〕`, { fontFamily: UI_FONT, fontSize: '22px', color: '#b8c0e8' })
    .setOrigin(0.5)
    .setAlpha(0.85)
    .setInteractive({ useHandCursor: true });
  tx.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (busy()) return;
    if (confirm('要登出線上帳號嗎？（進度都在伺服器，之後登入就回來）')) account.logout();
  });
}
