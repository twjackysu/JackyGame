#!/usr/bin/env python3
"""去背：python3 scripts/remove-bg.py in.png out.png（rembg + isnet-anime 模型，適合動漫風立繪）。
安裝：pip install "rembg[cpu]" --break-system-packages（第一次執行會從 GitHub 下載約 176MB 模型）。"""
import sys
from rembg import remove, new_session
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
out = remove(im, session=new_session('isnet-anime'), alpha_matting=False)
out.save(dst)
print('removed bg', src, '->', dst)
