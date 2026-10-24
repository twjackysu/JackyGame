#!/usr/bin/env python3
"""去背：python3 scripts/remove-bg.py in.png out.png（rembg + isnet-anime 模型，適合動漫風立繪）。
安裝：pip install "rembg[cpu]" --break-system-packages（第一次執行會從 GitHub 下載約 176MB 模型）。
背景複雜時模型會給大片半透明（例：洛克、瓦爾德蘭），半透明像素超過 7% 就把 alpha 二值化（>90）再羽化 1px。"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
out = remove(im, session=new_session('isnet-anime'))
a = np.array(out)
alpha = a[..., 3]
mid = ((alpha > 20) & (alpha < 200)).mean()
if mid > 0.07:
    hard = Image.fromarray(np.where(alpha > 90, 255, 0).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
    a[..., 3] = np.array(hard)
    out = Image.fromarray(a)
    print(f'binarized alpha (mid={mid:.2f})')
out.save(dst)
print('removed bg', src, '->', dst)
