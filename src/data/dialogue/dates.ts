// 城鎮約會事件（E5 v2，11-open-world §2.6；D-051）：好感達門檻＋同伴在隊伍中，
// 指定地點會出現頭上「♥」的同伴。走過去就觸發，每人一次。全年齡、點到為止。
import type { DialogueScript } from '../../core/dialogue/runner';

export const DATES: DialogueScript = {
  id: 'dates',
  start: 'end',
  nodes: {
    // 伊歐：灰燈鎮・孤兒院後院（第一章起）
    io_well: [
      { say: 'narration', text: '〔夜裡的灰燈鎮。孤兒院後院，伊歐坐在石階上，晃著腳。〕' },
      { say: 'io', text: '連恩。你小時候，也在這裡看星星嗎？' },
      { say: 'lian', text: '嗯。院長說井水會把星星裝起來，\n我就每天晚上來數，看有沒有少。' },
      { say: 'io', text: '……有少嗎？' },
      { say: 'lian', text: '每天都少一點。後來才知道，是我睡著了沒數完。' },
      { say: 'lian_inner', text: '（她笑了。很小聲，像怕把井裡的星星吵醒。）' },
      { say: 'io', text: '那今天，我幫你一起數。\n你數左邊，我數右邊。' },
      {
        choice: [
          { text: '「好。數到天亮也沒關係。」', next: 'io_well_a' },
          { text: '「……妳數到一半就會睡著吧。」', next: 'io_well_b' },
        ],
      },
    ],
    io_well_a: [
      { say: 'io', text: '……嗯。天亮的時候，星星會躲到你的燈裡。\n所以不會少。', effects: [{ affinity: 'io', delta: 8 }, { flag: 'date_io' }] },
      { say: 'lian_inner', text: '（我們數到第四十七顆的時候，\n她靠在我肩上睡著了。左邊、右邊，都數到同一顆。）' },
      { goto: 'end' },
    ],
    io_well_b: [
      { say: 'io', text: '才不會。……如果睡著了，你要叫醒我。', effects: [{ affinity: 'io', delta: 6 }, { flag: 'date_io' }] },
      { say: 'lian_inner', text: '（她數到第十二顆就睡著了。\n我沒有叫醒她。那天的星星，一顆都沒少。）' },
      { goto: 'end' },
    ],

    // 瑟琳：王都・噴水池（第三章起）
    serin_fountain: [
      { say: 'narration', text: '〔王都的噴水池。瑟琳站在池邊，盯著水面發呆。〕' },
      { say: 'serin', text: '……你來得正好。幫我看一下，這個劍穗，綁得歪不歪。' },
      { say: 'lian', text: '有點歪。……這是新的？' },
      { say: 'serin', text: '在市場買的。舊的那條，是離開家那天被扯斷的。\n一直捨不得換。' },
      { say: 'serin', text: '可是我想了很久。\n騎士的劍，應該掛著「現在要守護的東西」。' },
      { say: 'serin', text: '所以……你挑個顏色。' },
      {
        choice: [
          { text: '「藍色。跟妳眼睛一樣。」', next: 'serin_fountain_a' },
          { text: '「燈火的橘色。」', next: 'serin_fountain_b' },
        ],
      },
    ],
    serin_fountain_a: [
      { say: 'serin', text: '……你、你這人，說話不經大腦的嗎。', effects: [{ affinity: 'serin', delta: 8 }, { flag: 'date_serin' }] },
      { say: 'serin', text: '……但是，就藍色吧。' },
      { say: 'lian_inner', text: '（她背過身去綁劍穗，綁了三次才綁好。\n噴水池的水聲很大，大到我沒聽見她小聲說的那句話。）' },
      { goto: 'end' },
    ],
    serin_fountain_b: [
      { say: 'serin', text: '燈火……也好。在黑暗裡也找得到。', effects: [{ affinity: 'serin', delta: 6 }, { flag: 'date_serin' }] },
      { say: 'lian_inner', text: '（她把劍舉起來，對著路燈比了比。\n橘色的穗子晃了晃，她難得地笑出聲。）' },
      { goto: 'end' },
    ],

    // 莉歐拉：礦工營地・堆料場（第二章起）
    liora_sparks: [
      { say: 'narration', text: '〔礦工營地的堆料場。莉歐拉蹲在地上，面前排了一列小紙筒。〕' },
      { say: 'liora', text: '噓——別出聲。這是我做的「不會爆炸的火藥」。' },
      { say: 'lian', text: '……火藥不爆炸，那還叫火藥嗎？' },
      { say: 'liora', text: '它會「開花」。小時候礦坑停工那年，\n大家都沒錢過節，我就想，要是天上能開花就好了。' },
      { say: 'liora', text: '你幫我點最後一支。你是掌燈人嘛，點火你最專業。' },
      {
        choice: [
          { text: '（小心地點燃引信）', next: 'liora_sparks_a' },
          { text: '「先說好，炸了我不負責。」', next: 'liora_sparks_b' },
        ],
      },
    ],
    liora_sparks_a: [
      { say: 'narration', text: '〔細小的火光衝上夜空，啪地散成一朵金色的花。〕', effects: [{ affinity: 'liora', delta: 8 }, { flag: 'date_liora' }] },
      { say: 'liora', text: '成功了……！你看到了嗎？你看到了吧！' },
      { say: 'lian_inner', text: '（營地的礦工們都探出頭來。\n她在火光底下又叫又跳，臉上沾滿了煤灰——那是今晚最亮的東西。）' },
      { goto: 'end' },
    ],
    liora_sparks_b: [
      { say: 'liora', text: '哼，對我有點信心好不好！', effects: [{ affinity: 'liora', delta: 6 }, { flag: 'date_liora' }] },
      { say: 'narration', text: '〔火光衝上天，開出一朵歪歪的花。然後，又開了一朵。〕' },
      { say: 'liora', text: '……下一個發明，第一個給你看。說好了。' },
      { goto: 'end' },
    ],

    // 洛克：王都・酒館後巷的長椅（第三章起）
    rourke_bench: [
      { say: 'narration', text: '〔後巷的長椅。洛克一個人坐著，手裡轉著一枚舊硬幣。〕' },
      { say: 'rourke', text: '小子，來得正好。猜猜，正面還反面？' },
      { say: 'lian', text: '……你那枚，兩面都是正面吧。' },
      { say: 'rourke', text: '哈！眼睛真利。這是我第一次贏錢的那枚，\n後來找人把反面也刻成正面了。' },
      { say: 'rourke', text: '那時候我想，只要不給自己留反面，\n就永遠不會輸。……結果輸得最慘的，都是不肯離桌的時候。' },
      {
        choice: [
          { text: '「那現在呢？」', next: 'rourke_bench_a' },
          { text: '「我也想要一枚。」', next: 'rourke_bench_b' },
        ],
      },
    ],
    rourke_bench_a: [
      { say: 'rourke', text: '現在啊……現在我押的不是硬幣。', effects: [{ affinity: 'rourke', delta: 8 }, { flag: 'date_rourke' }] },
      { say: 'rourke', text: '（他把硬幣彈給我。）\n收著。哪天你覺得要輸了，就丟一次——反正都是正面。' },
      { goto: 'end' },
    ],
    rourke_bench_b: [
      { say: 'rourke', text: '想得美。這種東西，要自己贏來。', effects: [{ affinity: 'rourke', delta: 6 }, { flag: 'date_rourke' }] },
      { say: 'rourke', text: '……不過，陪老頭子喝一杯葡萄汁，\n倒是可以教你怎麼刻。' },
      { goto: 'end' },
    ],
    end: [],
  },
};
