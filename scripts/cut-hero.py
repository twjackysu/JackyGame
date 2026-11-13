#!/usr/bin/env python3
"""把主角立繪的兩隻靴子切出來（第 193 輪）：走路時身體上下、靴子各自邁步，不再是整張圖一起彈。
用法：python3 scripts/cut-hero.py [--preview 檔名]
讀 public/art/hero_{sword,bow,staff}.webp（原圖不動），寫
  public/art/hero_<武器>_body.webp（同尺寸，靴子挖掉）
  public/art/hero_<武器>_foot_{l,r}.webp（裁到靴子的外框）
  src/game/fx/heroParts.gen.ts（每隻靴子在原圖的位置與轉軸）
做法：膝蓋線以下、偏棕色（r 明顯大於 b）的像素＝靴子；開運算去掉大衣金邊的細條；各取最大的一塊。
大衣下襬蓋住靴子的地方留在身體上（靴子畫在身體後面）。"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# top＝靴口大約的 y；split＝左右靴的分界 x；xmax＝右靴右邊界（擋掉法杖尾端）
CFG = {
    'sword': dict(top=452, split=290, xmin=170, xmax=409),
    'bow': dict(top=462, split=270, xmin=170, xmax=400),
    'staff': dict(top=452, split=250, xmin=150, xmax=400),
}
out = {}
prev = []
for w, c in CFG.items():
    im = Image.open(f'public/art/hero_{w}.webp').convert('RGBA')
    a = np.asarray(im).astype(np.int32)
    H, W = a.shape[:2]
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    yy, xx = np.mgrid[0:H, 0:W]
    region = (yy >= c['top']) & (xx >= c['xmin']) & (xx < c['xmax']) & (al > 40)
    brown = region & (r - b >= 14) & (r >= g) & (np.maximum(r, g) < 215) & ~((r > 150) & (g > 120))  # 最後一項擋金邊
    core = ndi.binary_opening(brown, iterations=4)
    core = ndi.binary_dilation(core, iterations=7) & region & ((r - b >= 4) | (np.maximum(np.maximum(r, g), b) < 70))  # 帶回深色描邊
    core = ndi.binary_fill_holes(core)
    feet = {}
    for side, sel in (('l', xx < c['split']), ('r', xx >= c['split'])):
        lab, n = ndi.label(core & sel)
        if n == 0: raise SystemExit(f'{w} {side}: 找不到靴子')
        sizes = ndi.sum(core & sel, lab, range(1, n + 1))
        m = lab == (1 + int(np.argmax(sizes)))
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        piece = a.copy(); piece[~m] = 0
        Image.fromarray(piece[y0:y1, x0:x1].astype(np.uint8), 'RGBA').save(f'public/art/hero_{w}_foot_{side}.webp', quality=92, method=6)
        # 轉軸＝靴口中間（最上面 12 列的平均 x）
        topx = xs[ys < y0 + 12]
        feet[side] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), px=int(round(topx.mean())), py=int(y0 + 6))
        a[m & True] = a[m]  # no-op，下面一起挖
        feet[side]['mask'] = m
    cut = feet['l']['mask'] | feet['r']['mask']
    # 挖掉：外擴 2px 吃掉半透明的邊，但不吃大衣（偏藍或很亮的金邊）
    halo = ndi.binary_dilation(cut, iterations=2) & ((al < 200) | (r - b >= 4))
    body = a.copy(); body[cut | (halo & region)] = 0
    Image.fromarray(body.astype(np.uint8), 'RGBA').save(f'public/art/hero_{w}_body.webp', quality=92, method=6)
    out[w] = dict(w=W, h=H, feet={s: {k: v for k, v in f.items() if k != 'mask'} for s, f in feet.items()})
    if '--preview' in sys.argv:
        pv = Image.new('RGBA', (W * 2 + 20, H), (40, 120, 70, 255))
        pv.alpha_composite(Image.fromarray(body.astype(np.uint8), 'RGBA'), (0, 0))
        fo = np.zeros_like(a); fo[cut] = a[cut]
        pv.alpha_composite(Image.fromarray(fo.astype(np.uint8), 'RGBA'), (W + 20, 0))
        prev.append(pv)
ts = '// 由 scripts/cut-hero.py 產生，不要手改。x/y/w/h＝靴子在原圖的外框；px/py＝轉軸（靴口中間，原圖座標）。\n'
ts += 'export interface FootPart { x: number; y: number; w: number; h: number; px: number; py: number }\n'
ts += 'export const HERO_PARTS: Record<string, { w: number; h: number; feet: { l: FootPart; r: FootPart } }> = ' + json.dumps(out, indent=2).replace('"', "'") + ';\n'
open('src/game/fx/heroParts.gen.ts', 'w').write(ts)
if prev:
    s = Image.new('RGBA', (sum(p.width for p in prev), max(p.height for p in prev)), (40, 120, 70, 255)); x = 0
    for p in prev: s.alpha_composite(p, (x, 0)); x += p.width
    s.crop((0, 330, s.width, s.height)).convert('RGB').save(sys.argv[sys.argv.index('--preview') + 1], quality=90)
print(json.dumps(out))
