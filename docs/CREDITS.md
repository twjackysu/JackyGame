# 素材來源

- **AI 美術**（`public/art/`：標題主視覺、主角連恩的 Q 版戰鬥圖、霧角狼王、霧狼、荊棘菇）：由業主 Jacky 使用 AI 繪圖服務（GPT／Gemini）生成（2026-10-24），以 `scripts/import-art.mjs` 去背（rembg isnet-anime）後使用。
- **AI 美術（2026-11-11 追加）**：星骸守望者、晶殼魔像、星痕狼、燼狼、熔岩巡獵者、黑曜狼首、星蝕狼——由業主 Jacky 使用 Gemini 生成（R-020、R-021），以 `scripts/cut-sheet.py`（洋紅底去背＋分塊）與 `scripts/rim-art.py`（調亮＋柔光邊）處理後使用。（2026-11-11 第 173 輪：燼狼另以 `scripts/glow-art.py` 加粗裂紋、加暖光、提亮，原圖在 git 歷史 6d6e44b。）
- 其餘美術（地面、樹林、營火、光影、粒子、介面、裝備圖示）與全部音效、音樂：程式即時生成，無外部素材。
