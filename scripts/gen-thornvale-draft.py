# 荊棘谷 48×80 草稿地圖產生器（D-114）。和霧語森林不同：整片荊棘、只挖出一條蜿蜒山谷＋幾塊空地。
# 用法：python3 scripts/gen-thornvale-draft.py → 印出 ASCII（貼進 src/core/battle/rt/maps/thornvale.ts）
import random, math
W,H=48,80
random.seed(11)
g=[['#' for _ in range(W)] for _ in range(H)]
def disc(cx,cy,r,ch='.'):
    for y in range(int(cy-r-1),int(cy+r+2)):
        for x in range(int(cx-r-1),int(cx+r+2)):
            if 1<=x<W-1 and 1<=y<H-1 and math.hypot(x-cx,y-cy)<=r: g[y][x]=ch
# 山谷主線（南→北的 S 形），沿線挖寬 3～4 的圓
path=[(24,76),(20,70),(14,64),(16,57),(26,53),(36,49),(37,42),(30,36),(20,32),(16,27),(22,22),(24,18)]
def lerp(a,b,t): return a+(b-a)*t
for i in range(len(path)-1):
    (x0,y0),(x1,y1)=path[i],path[i+1]
    n=int(math.hypot(x1-x0,y1-y0)*2)+1
    for k in range(n+1):
        t=k/n; disc(lerp(x0,x1,t),lerp(y0,y1,t),3.2+0.8*math.sin((y0+t*(y1-y0))/3))
# 空地：南營地、荊棘坡、毒沼（東）、母樹空地（西）、谷中營地、棘刺迴廊、女王庭園
disc(24,74,6.5)        # 南營地
disc(14,62,6)          # 荊棘坡
disc(37,47,6.5)        # 谷中營地＋毒沼
disc(8,50,4.5)         # 母樹空地（西側小路通過去）
for k in range(12): disc(lerp(14,9,k/11),lerp(57,50,k/11),1.6)
disc(25,34,7)          # 棘刺迴廊
disc(24,11,9.5)        # 女王庭園
for x in range(22,27):
    for y in range(19,23): g[y][x]='.'
# 平滑一次：把挖剩的尖角、單格凸起磨掉（避免單位在斜角卡住）
def nb(x,y): return sum(1 for dx in (-1,0,1) for dy in (-1,0,1) if (dx or dy) and g[y+dy][x+dx]=='.')
for _ in range(2):
    flip=[(x,y) for y in range(1,H-1) for x in range(1,W-1) if g[y][x]=='#' and nb(x,y)>=5]
    for x,y in flip: g[y][x]='.'
    fill=[(x,y) for y in range(1,H-1) for x in range(1,W-1) if g[y][x]=='.' and nb(x,y)<=2]
    for x,y in fill: g[y][x]='#'
# 外框保持荊棘
for y in range(H):
    g[y][0]=g[y][W-1]='#'
for x in range(W):
    g[0][x]=g[H-1][x]='#'
# 零星荊棘叢（避開營火與出生點）
for _ in range(40):
    x=random.randrange(3,W-3); y=random.randrange(24,72)
    if g[y][x]=='.' and math.hypot(x-24,y-74)>5 and math.hypot(x-37,y-47)>4 and math.hypot(x-8,y-50)>3 and all(g[y+dy][x+dx]=='.' for dx in range(-2,3) for dy in range(-2,3)): g[y][x]='#'
for r in g: print("    '"+''.join(r)+"',")
