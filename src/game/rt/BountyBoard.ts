// 營地懸賞板的文字（Q5 拆場景第四塊，第 148 輪；從 RtBattleScene.refreshBounty 搬出來，字一個都不變）：
// 純函式（沒有 Phaser），場景只負責 setText。懸賞三張地圖共用：這張地圖打不到的目標標「（別圖）」。
import { ENEMIES } from '../../core/battle/rt/data';
import type { StageDefinition } from '../../core/battle/rt/types';
import { bountyIdsHere, bountyTargetsOf, type Bounty } from '../../core/meta/bounty';

/** 打不到（或精英類）時的總稱 */
export const BOUNTY_LABEL: Record<string, string> = { wolf: '野狼／棘背狼／燼鬃狼／星痕狼', wolf_king: '狼王／狼后／岩王／守望者', thorn_shooter: '荊棘射手／燼芯菇／星芒菇', alpha_wolf: '首領級精英' };

/** 這張地圖上會出現的怪（重生點＋固定怪） */
export function stageEnemyIds(stg: StageDefinition | undefined): string[] {
  return [...(stg?.spawnGroups ?? []).map((g) => g.enemyId), ...(stg?.enemies ?? []).map((e) => e.enemyId)];
}

/** 懸賞板全文（第一行「懸賞」，之後每張一行） */
export function bountyBoardText(list: readonly Pick<Bounty, 'target' | 'got' | 'need'>[], ids: readonly string[]): string {
  const here = bountyTargetsOf(ids);
  // 第 43 輪：這張圖打得到的只寫這張圖的怪名（以前一律「野狼／棘背狼／燼鬃狼／星痕狼」，小字又長又難讀）；精英類照舊寫「首領級精英」
  const nameOf = (t: string): string => {
    if (t === 'alpha_wolf' || !here.has(t)) return BOUNTY_LABEL[t] ?? ENEMIES[t]?.name ?? t;
    return bountyIdsHere(t, ids).map((id) => ENEMIES[id]?.name ?? id).join('／');
  };
  return ['懸賞', ...list.map((b) => `${nameOf(b.target)} ${b.got}/${b.need}${here.has(b.target) ? '' : '（別圖）'}`)].join('\n');
}
