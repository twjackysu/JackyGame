# 設計文件索引（第 18 輪整理，D-089）

> 開發迴圈選工作時**只看「現行」這幾份**＋ `docs/NEXT.md`。標「已過時」的文件頂端都有一行說明哪些部分還有效；衝突時以 `docs/DECISIONS.md` 較新的決策為準。

## 現行（新玩法：單人即時動作戰鬥＋大地圖刷寶）
| 文件 | 內容 | 狀態 |
|---|---|---|
| [20-swordsman-and-map.md](20-swordsman-and-map.md) | **主規格**：劍士技能、森林地圖、死亡與回復、刷寶三層目標、§B8 實作順序 P1～P5 | P1～P3 完成；**下一步 P4 刷寶** |
| [19-realtime-combat.md](19-realtime-combat.md) | 即時戰鬥核心規格（30 ticks/秒、預告、仇恨、狀態、模擬器） | 已實作；同伴與戀愛部分作廢（D-063） |
| [18-combat-class-world-v2.md](18-combat-class-world-v2.md) | 傷害公式、屬性、職業、名詞表 | 公式與名詞有效；回合制部分作廢（D-062） |
| [17-repositioning.md](17-repositioning.md) | 10/24 方向重定位（自選職業、戰鬥重寫、美術重做、淺白名詞） | 背景 |
| [21-p2-forest-integration.md](21-p2-forest-integration.md) | 森林地圖整合四個選擇 | Jacky 10/25 同意 ⭐ 方案，已實作 |
| [22-mistwood-draft.md](22-mistwood-draft.md) | 霧語森林 48×96 版面 | 已實作（`src/core/battle/rt/maps/mistwood.ts`） |

## 已過時（保留給舊主線與歷史參考）
01 市場調查、02 世界觀、03 回合制玩法、04 內容規劃、05 美術音效、06 技術架構、07 UI、08／10 劇本、09 數值表、11 自由探索、12 請教題目、13 腦力激盪、14 實作順序、15 技能與裝備、16 故事修訂。

## 遊戲裡現在有兩種玩法
1. **霧語森林・即時戰鬥**（新方向，標題入口）：`src/core/battle/rt/`（純 TS 核心）＋ `src/game/scenes/RtBattleScene.ts`。
2. **舊主線《星燼回響》**（回合制＋自由探索，序章到三結局可通關）：保留可玩，**不再加新功能**；之後新玩法成熟再決定怎麼合併或移除（D-065、D-087）。
