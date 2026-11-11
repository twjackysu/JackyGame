#!/usr/bin/env python3
"""洋紅底的多物件 sheet → 每個物件一張去背 WebP（第 172 輪，R-020／R-021）。
用法：python3 scripts/cut-sheet.py art-inbox/sheet_x.png name1,name2,... [輸出資料夾=public/art]
做法：照「離底色多遠」算透明度（發光、光暈保留成半透明並把洋紅色抽掉）→ 取相連區塊，最大的 N 塊是 N 個物件（左到右對應名字），
其餘小塊（火星、星屑）歸給最近的那一隻 → 各自裁邊存檔。不照格線切，所以尾巴和隔壁重疊也不會被切到。
不會刪原圖。"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, names = sys.argv[1], sys.argv[2].split(',')
out = sys.argv[3] if len(sys.argv) > 3 else 'public/art'
im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
# 底色：四個角落的中位數
cs = np.concatenate([im[:12, :12].reshape(-1, 3), im[:12, -12:].reshape(-1, 3), im[-12:, :12].reshape(-1, 3), im[-12:, -12:].reshape(-1, 3)])
bg = np.median(cs, axis=0)
d = np.sqrt(((im - bg) ** 2).sum(axis=2))
T0, T1 = 42.0, 120.0
a = np.clip((d - T0) / (T1 - T0), 0, 1)
# 半透明的地方把底色抽掉（c = (p - (1-a)·bg) / a），不然邊緣一圈洋紅
aa = np.maximum(a, 0.08)[..., None]
rgb = np.clip((im - (1 - a[..., None]) * bg) / aa, 0, 255)
# 還是偏洋紅的邊緣像素（紅藍都遠大於綠）：把紅藍壓到接近綠＋一點，避免殘留粉紅邊
edge = (a < 0.999)
spill = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
fix = edge & (spill > 40)
for c in (0, 2):
    ch = rgb[..., c]
    ch[fix] = np.minimum(ch[fix], rgb[..., 1][fix] + 40 + (ch[fix] - rgb[..., 1][fix] - 40) * 0.35)
lab, n = ndimage.label(a > 0.25, structure=np.ones((3, 3)))
sizes = ndimage.sum(np.ones_like(lab), lab, index=range(1, n + 1))
order = np.argsort(sizes)[::-1]
big = sorted([int(i) + 1 for i in order[:len(names)]], key=lambda L: ndimage.center_of_mass(lab == L)[1])
boxes = {L: ndimage.find_objects((lab == L).astype(int))[0] for L in big}
owner = {L: L for L in big}
objs = ndimage.find_objects(lab)
for L in range(1, n + 1):
    if L in owner or sizes[L - 1] < 6:
        continue
    sl = objs[L - 1]
    cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
    def gap(B):
        b = boxes[B]
        dx = max(b[1].start - cx, 0, cx - b[1].stop)
        dy = max(b[0].start - cy, 0, cy - b[0].stop)
        return dx * dx + dy * dy
    owner[L] = min(big, key=gap)
# 半透明的光暈（a 在 0～0.25）沒有被標到：歸給最近的大塊（限主體附近）
dist, near = ndimage.distance_transform_edt(~np.isin(lab, big), return_indices=True)
nearest = lab[near[0], near[1]]
own_map = np.zeros_like(lab)
for L, B in owner.items():
    own_map[lab == L] = B
own_map = np.where((own_map == 0) & (dist <= 36), nearest, own_map)  # 光暈只收主體旁邊 36px 內的，遠處底色不均的雜訊不要
for name, B in zip(names, big):
    al = np.where(own_map == B, a, 0)
    al[al < 0.03] = 0
    ys, xs = np.nonzero(al > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb, al * 255]).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(rgba, 'RGBA').save(f'{out}/{name}.webp', quality=92, method=6)
    print(name, (x1 - x0, y1 - y0), 'x', x0, x1, 'y', y0, y1)
