// 懸賞板文字（Q5 拆出 src/game/rt/BountyBoard.ts，第 148 輪）：搬家前後字一樣——這張圖打得到的寫這張圖的怪名，打不到的寫總稱＋「（別圖）」。
import { describe, expect, it } from 'vitest';
import { bountyBoardText, stageEnemyIds } from '../src/game/rt/BountyBoard';
import { stageDef } from '../src/core/battle/rt/maps/world';

const list = [
  { target: 'wolf', got: 3, need: 12 },
  { target: 'thorn_mother', got: 0, need: 1 },
  { target: 'alpha_wolf', got: 1, need: 2 },
];

describe('懸賞板文字', () => {
  it('霧語森林：狼寫「野狼」、荊棘母樹在這張圖、精英寫總稱', () => {
    expect(bountyBoardText(list, stageEnemyIds(stageDef('mistwood')))).toMatchInlineSnapshot(`
      "懸賞
      野狼 3/12
      荊棘母樹 0/1
      首領級精英 1/2"
    `);
  });
  it('燼紅裂谷：荊棘母樹不在這張圖 →（別圖）', () => {
    expect(bountyBoardText(list, stageEnemyIds(stageDef('emberrift')))).toMatchInlineSnapshot(`
      "懸賞
      燼鬃狼 3/12
      荊棘母樹 0/1（別圖）
      首領級精英 1/2"
    `);
  });
});
