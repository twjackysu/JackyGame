#!/usr/bin/env python3
"""深色立繪在深色地圖上看不見時用（第 172 輪，R-020／R-021 的狼）：把圖調亮一點、外面加一圈有顏色的柔光邊，直接存回去。
用法：python3 scripts/rim-art.py public/art/enemy_x.webp ff9a50 [gamma=0.8] [邊寬=3]
要從剛切好的圖做（重複跑會越來越亮、邊越來越厚）。"""
import sys
import numpy as np
from PIL import Image, ImageFilter

path, hexc = sys.argv[1], sys.argv[2]
gamma = float(sys.argv[3]) if len(sys.argv) > 3 else 0.8
wd = int(sys.argv[4]) if len(sys.argv) > 4 else 3
col = np.array([int(hexc[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
im = Image.open(path).convert('RGBA')
pad = wd * 3
big = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
big.paste(im, (pad, pad))
a = np.array(big).astype(np.float32)
rgb = 255 * (a[..., :3] / 255) ** gamma
al = a[..., 3] / 255
A = Image.fromarray((al * 255).astype(np.uint8))
grown = A.filter(ImageFilter.MaxFilter(wd * 2 + 1)).filter(ImageFilter.GaussianBlur(wd * 0.6))
rim = np.array(grown).astype(np.float32) / 255 * 0.9
out_a = al + rim * (1 - al)
out_rgb = (rgb * al[..., None] + col * (rim * (1 - al))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
res = np.dstack([np.clip(out_rgb, 0, 255), out_a * 255]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(path, quality=92, method=6)
print('rim', path, hexc, gamma, wd)
