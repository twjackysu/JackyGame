# 設計文件索引（第 18 輪整理，D-089）

> 開發迴圈選工作時看這幾份＋ `docs/NEXT.md`；衝突時以 `docs/DECISIONS.md` 較新的決策為準。

## 現行（新玩法：單人即時動作戰鬥＋大地圖刷寶）
| 文件 | 內容 | 狀態 |
|---|---|---|
| [20-swordsman-and-map.md](20-swordsman-and-map.md) | **主規格**：劍士技能、森林地圖、死亡與回復、刷寶三層目標、§B8 實作順序 P1～P5 | P1～P3 完成；**下一步 P4 刷寶** |
| [19-realtime-combat.md](19-realtime-combat.md) | 即時戰鬥核心規格（30 ticks/秒、預告、仇恨、狀態、模擬器） | 已實作；同伴與戀愛部分作廢（D-063） |
| [18-combat-class-world-v2.md](18-combat-class-world-v2.md) | 傷害公式、屬性、職業、名詞表 | 公式與名詞有效；回合制部分作廢（D-062） |
| [17-repositioning.md](17-repositioning.md) | 10/24 方向重定位（自選職業、戰鬥重寫、美術重做、淺白名詞） | 背景 |
| [21-p2-forest-integration.md](21-p2-forest-integration.md) | 森林地圖整合四個選擇 | Jacky 10/25 同意 ⭐ 方案，已實作 |
| [22-mistwood-draft.md](22-mistwood-draft.md) | 霧語森林 48×96 版面 | 已實作（`src/core/battle/rt/maps/mistwood.ts`） |

## 已刪除
- 01～16（舊主線：回合制戰鬥、自由探索、劇本、燼牌、技能樹等）已隨舊主線一起刪除（D-097），要查看 git 歷史。

## 遊戲現在只有一種玩法
**霧語森林・即時戰鬥**：`src/core/battle/rt/`（純 TS 核心）＋ `src/game/scenes/RtBattleScene.ts`（畫面）。
