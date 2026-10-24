// 支線進度提示（探索 HUD 目標列）。依順序顯示第一個成立的。點燈支線另有計數（ExploreHudScene）。
import type { Condition } from '../core/state/gameState';

export const SIDE_GOALS: readonly { when: Condition; text: string }[] = [
  { when: { all: [{ flag: 'q_lost_kid' }, { flag: 'q_lost_kid_found', not: true }] }, text: '◇ 找米亞（森林西南的蕈圈）' },
  { when: { all: [{ flag: 'q_lost_kid_found' }, { flag: 'q_lost_kid_done', not: true }] }, text: '◇ 帶米亞回家（灰燈鎮露絲）' },
];
