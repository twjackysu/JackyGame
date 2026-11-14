# 素材來源

- **AI 美術**（`public/art/`：標題主視覺、主角連恩的 Q 版戰鬥圖、霧角狼王、霧狼、荊棘菇）：由業主 Jacky 使用 AI 繪圖服務（GPT／Gemini）生成（2026-10-24），以 `scripts/import-art.mjs` 去背（rembg isnet-anime）後使用。
- **AI 美術（2026-11-11 追加）**：星骸守望者、晶殼魔像、星痕狼、燼狼、熔岩巡獵者、黑曜狼首、星蝕狼——由業主 Jacky 使用 Gemini 生成（R-020、R-021），以 `scripts/cut-sheet.py`（洋紅底去背＋分塊）與 `scripts/rim-art.py`（調亮＋柔光邊）處理後使用。（2026-11-11 第 173 輪：燼狼另以 `scripts/glow-art.py` 加粗裂紋、加暖光、提亮，原圖在 git 歷史 6d6e44b。）
- **AI 3D 模型渲染（2026-11-14 追加）**：武器欄圖示（長劍、長弓、法杖）與霧影狼／夜棘首領的走路影格——取自業主 Jacky 用 Tripo（付費帳號）為另一款遊戲生成的 3D 模型（`weapon_longsword`、`weapon_bow`、`weapon_staff`、`enemy_miasma_wolf`），以 `scripts/tripo/` 用 Blender 渲染成 2D 後使用。模型的商用權歸 Jacky，**不在本 repo 的 GPL-3.0 授權範圍內**，模型檔本身不收進本 repo。
- 其餘美術（地面、樹林、營火、光影、粒子、介面、其他部位的裝備圖示）與全部音效、音樂：程式即時生成，無外部素材。
