# Tripo 3D 模型 → JackyGame 2D 圖

Jacky 在另一款遊戲（`twjackysu/curses-too-useful`，原 yuming-city）用 Tripo 付費產的 3D 模型，放在那邊的 `art-inbox/tripo/<id>/`（GLB＋`SOURCE.json`）。這裡用 Blender（`pip install bpy`，無 GPU 也能跑）渲染成 2D，再加 JackyGame 的貼紙描邊。

- `render_view.py`：GLB → 透明底 PNG（正交相機；`--view thin` 武器平放、`--view yaw:<度>` 環繞；`--frames a-b:step` 渲染動畫）
- `stickerize.py`：裁切、斜放、深色外描邊、提飽和
- `build.py`：目前用到的三把武器圖示＋瘴氣狼走路影格表，一鍵重做

**授權**：模型是 Jacky 付費帳號產出（商用權歸他），不是 CC0，也不在本 repo 的 GPL 範圍內；不要把 GLB 複製進這個 repo，只放渲染後的圖。

**還能用的**（Jacky 11/14 只先核准武器圖示＋瘴氣狼）：`weapon_axe`／`weapon_hammer`／`weapon_alchemy_crossbow` 等可做獨特裝備圖示；`enemy_poison_slime`（畫風最接近）、`prop_campfire_v2`、`prop_cursed_chest`、`prop_guild_quest_board`（懸賞板）、`black_market_merchant`（旅商，要先擺姿勢）。人形角色是正常頭身，跟 Q 版主角放一起不搭，不建議用。要用之前先問 Jacky。
