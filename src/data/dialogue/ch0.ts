// 序章「被留下的燈」。來源：docs/design/08-script-ch0-ch1.md §序章。
// 格式見 src/core/dialogue/runner.ts / docs/design/06-tech-architecture.md §3.3。
import type { DialogueScript } from '../../core/dialogue/runner';

export const CH0: DialogueScript = {
  id: 'ch0',
  nodes: {
    // 0-1 冷開場（前世）
    start: [
      { say: 'narration', text: '〔手機螢幕裡，像素風的最終 Boss 戰。〕' },
      { say: 'narration', text: '〔五盞燈印依序亮起——共鳴光柱。〕' },
      { say: 'narration', text: '〔「ALL ACHIEVEMENTS UNLOCKED」〕' },
      { say: 'lian_inner', text: '（凌晨三點。《Starfall Requiem》，全成就。）' },
      { say: 'lian_inner', text: '（這款沒人玩的遊戲……\n大概只有我破完了吧。）' },
      { say: 'narration', text: '〔手機滑落，螢幕熄滅。〕' },
      { say: 'narration', text: '〔自動門「叮咚」一聲。黑幕。〕' },
      { goto: 'corridor' },
    ],

    // 0-2 沉星迴廊（遺跡外層）
    corridor: [
      { say: 'narration', text: '〔滴水聲。提燈的光暈在石牆上搖晃。〕' },
      { say: 'knight', text: '喂，燈！照前面！發什麼呆？' },
      { say: 'lian_inner', text: '（……燈？我手上提著一盞燈。）' },
      { say: 'lian_inner', text: '（前面是穿著星紋鎧甲的騎士們。）' },
      {
        say: 'lian_inner',
        text: '（這個迴廊、這套鎧甲——\n這是《Starfall Requiem》的開場關卡。）',
        // 前世全成就的記憶：攻略筆記第一條
        effects: [{ codex: 'captain_starcore' }],
      },
      { say: 'lian_inner', text: '（而我是……開場被騎士團丟在遺跡裡的路人 NPC，）' },
      { say: 'lian_inner', text: '（掌燈人「連恩」！？）' },
      { say: 'gwen', text: '停。' },
      { say: 'narration', text: '〔葛文回頭。〕' },
      { say: 'gwen', text: '掌燈人，你的燈太暗，腳步太慢。' },
      { say: 'gwen', text: '從這裡開始，你留下來看守退路。' },
      { say: 'lian_inner', text: '（原作的這一幕——「看守退路」的意思，\n是當引開魔物的誘餌。）' },
      { say: 'serin', text: '隊長，把雜役一個人留在這裡——' },
      { say: 'gwen', text: '瑟琳，你的工作是揮劍，不是同情。走。' },
      {
        choice: [
          {
            text: '「我被雇來照路，不是被雇來送死的。」',
            check: { stat: 'cha', dc: 3 },
            effects: [
              { affinity: 'serin', delta: 5 },
              { rep: 'order', delta: -5 },
            ],
            failEffects: [{ rep: 'order', delta: -5 }],
            next: 'protest_ok',
            fail: 'protest_fail',
          },
          {
            text: '「……知道了。」（隱忍）',
            effects: [{ rep: 'order', delta: 5 }],
            next: 'endure',
          },
          {
            text: '「隊長，你背包裡那枚星核，報告上會寫嗎？」',
            check: { codex: 'captain_starcore' },
            effects: [
              { divergence: 5 },
              { rep: 'order', delta: -15 },
              { flag: 'exposed_captain' },
            ],
            next: 'expose',
          },
        ],
      },
    ],
    protest_ok: [
      { say: 'narration', text: '〔騎士們面面相覷，隊伍一陣動搖。〕' },
      { say: 'narration', text: '〔瑟琳回頭看了你一眼。〕' },
      { goto: 'left_behind' },
    ],
    protest_fail: [
      { say: 'narration', text: '〔你被一把推開，撞上濕冷的石牆。〕' },
      { goto: 'left_behind' },
    ],
    endure: [{ goto: 'left_behind' }],
    expose: [
      { say: 'narration', text: '〔葛文的臉色一沉。〕' },
      { say: 'gwen', text: '……掌燈人，你被解雇了。就在這裡。' },
      { goto: 'left_behind' },
    ],
    left_behind: [
      { say: 'narration', text: '〔遠征隊的光漸漸遠去。只剩一盞提燈。〕' },
      { goto: 'wall' },
    ],

    // 0-3 牆中之物（教學戰）
    wall: [
      { say: 'narration', text: '〔石牆裂開，紫黑色的爪子伸出。〕' },
      { say: 'lian_inner', text: '（來了。開場教學戰。）' },
      { say: 'lian_inner', text: '（原作裡，連恩在這裡被吃掉，\n然後畫面切到瑟琳回頭——）' },
      { say: 'lian_inner', text: '（……開什麼玩笑。這場，我玩過一千次。）' },
      { goto: 'tutorial' },
    ],
    tutorial: [
      // 蝕化獸：HP 低、攻擊慢；星燼從 10 開始；時機/格擋/閃避/共鳴教學由戰鬥場景處理
      { event: 'battle', id: 'ch0_tutorial', outcomes: { win: 'after_battle', lose: 'tutorial_retry' } },
    ],
    tutorial_retry: [
      { say: 'lian_inner', text: '（……手滑了。再來一次。）' },
      { goto: 'tutorial' },
    ],
    after_battle: [
      { say: 'narration', text: '〔寂靜。煙塵中，提燈靜靜燃燒。〕' },
      { say: 'narration', text: '〔腳步聲——瑟琳跑了回來。〕' },
      { say: 'serin', text: '……剛剛那道光柱，是你？' },
      { say: 'narration', text: '〔葛文帶隊趕回。〕' },
      { say: 'gwen', text: '遺跡機關誤觸罷了。' },
      { say: 'gwen', text: '掌燈人，拿了錢滾回你的鎮子。' },
      { say: 'lian_inner', text: '（果然。在這個世界，\n「掌燈人很強」這件事，還沒有人相信。）' },
      { say: 'narration', text: '〔擦身而過時，瑟琳低聲開口。〕' },
      { say: 'serin', text: '喂，掌燈人。——下次，別搶我的對手。', effects: [{ flag: 'serin_met' }] },
      { goto: 'leave' },
    ],

    // 0-4 離開
    leave: [
      { say: 'lian_inner', text: '（好吧。被趕出遠征隊，回灰燈鎮。\n和原作一模一樣。）' },
      { say: 'lian_inner', text: '（但原作的連恩，就死在剛才那面牆前。）' },
      { say: 'lian_inner', text: '（這一次……我要改寫所有的結局。）' },
      { event: 'chapterCard', id: 'ch1' },
      { goto: 'end' },
    ],
    end: [],
  },
};
