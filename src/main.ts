import { autoLearn, autoOutfit } from './core/state/autoBuild';
import { shopStock } from './core/state/equip';
import Phaser from 'phaser';
import { installAudioUnlock } from './audio/sfx';
import { ENHANCE_STEPS } from './data/enhancement';
import { createGameConfig } from './game/config';
import { applySettings } from './game/settings';
import { installFpsGuard } from './game/perf/fpsGuard';
import { gameApi, opId, session } from './game/session';

installAudioUnlock();
applySettings();

// Block pinch-zoom / double-tap zoom gestures that slip past CSS on iOS Safari.
for (const evt of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

const game = new Phaser.Game(createGameConfig('game'));
installFpsGuard(game);

if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
  (window as unknown as { __session?: typeof session }).__session = session;
  // 通關機器人：像玩家一樣買裝備、點技能（區域 id → 附近商店）
  const AREA_SHOP: Record<string, string> = { greylamp: 'ch1_general', mistwood: 'ch1_general', wolfpath: 'ch1_general', minecamp: 'ch2_camp', mine: 'ch2_camp', capital: 'capital', depths: 'capital', rift: 'capital' };
  (window as unknown as { __auto?: (area: string) => string }).__auto = (area: string) => {
    const s = session.state;
    const g = autoOutfit(s, shopStock(AREA_SHOP[area] ?? 'ch1_general'));
    const l = autoLearn(s);
    // 強化身上的裝備到 +5（必成區間；至少留 60 金），走 GameApi
    let e = 0;
    for (const m of s.party) {
      for (const iid of Object.values(s.members[m]?.equipment ?? {})) {
        const inst = iid ? s.gear[iid] : undefined;
        while (inst && inst.enhancement < 5 && s.gold - (ENHANCE_STEPS[inst.enhancement]?.cost.gold ?? 1e9) >= 60) {
          if (!gameApi.enhance(opId('enhance'), { instanceId: inst.instanceId }).ok) break;
          e++;
        }
      }
    }
    if (g || l || e) session.save();
    return g || l || e ? `auto: gear ${g}, skills ${l}, enhance ${e}, gold ${s.gold}, dust ${s.inventory.mat_dust ?? 0}` : '';
  };
}
