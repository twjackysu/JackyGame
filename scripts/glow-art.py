#!/usr/bin/env python3
"""立繪上的發光紋路（熔岩裂紋、星紋）縮到遊戲裡的大小會糊掉時用（第 173 輪，燼狼）：把暖色亮紋加粗、暈開一圈光，身體再提亮一點，直接存回去。
用法：python3 scripts/glow-art.py public/art/enemy_x.webp ff8a30 [暈開半徑=5] [強度=0.9] [身體 gamma=0.85]
只挑「紅明顯大於藍、而且夠亮」的像素當紋路；要從原圖做（重複跑會越來越亮）。"""
import sys
import numpy as np
from PIL import Image, ImageFilter

path, hexc = sys.argv[1], sys.argv[2]
rad = float(sys.argv[3]) if len(sys.argv) > 3 else 5
k = float(sys.argv[4]) if len(sys.argv) > 4 else 0.9
gamma = float(sys.argv[5]) if len(sys.argv) > 5 else 0.85
col = np.array([int(hexc[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
a = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
rgb, al = a[..., :3], a[..., 3] / 255
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# 紋路：暖色（r 比 b 高很多）且亮；邊緣那圈柔光（半透明）不算
vein = np.clip((r - b - 60) / 70, 0, 1) * np.clip((r - 140) / 60, 0, 1) * (al > 0.9)
V = Image.fromarray((vein * 255).astype(np.uint8))
thick = np.array(V.filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
halo = np.array(V.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255
body = 255 * (rgb / 255) ** gamma
glow = np.clip(halo * 1.5, 0, 1)[..., None] * k
out = body + (255 - body) * glow * (col / 255)  # 濾色（screen）疊一層暖光
hot = np.array([255, 196, 96], dtype=np.float32)
out = out * (1 - thick[..., None] * 0.7) + hot * thick[..., None] * 0.7  # 紋路本身加粗、變亮黃
res = np.dstack([np.clip(out, 0, 255), a[..., 3]]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(path, quality=92, method=6)
print('glow', path, hexc, rad, k, gamma, 'vein px', int((vein > 0.5).sum()))
