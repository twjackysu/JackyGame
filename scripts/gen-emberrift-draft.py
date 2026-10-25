# 燼紅裂谷 48×84 草稿地圖產生器（D-125）。第三張大地圖：玄武岩高地＋熔岩裂縫（石頭格＝岩壁／熔岩，都不能走）。
# 南邊營地往北分成兩條路：西邊「噴口原」（近、要看噴發時機）、東邊「黑曜長廊」（遠、有精英），在「灰燼營地」會合，北邊是 Boss「熔心王座」。
# 用法：python3 scripts/gen-emberrift-draft.py → 印出 ASCII（貼進 src/core/battle/rt/maps/emberrift.ts）
import random, math
W,H=48,84
random.seed(25)
g=[['#' for _ in range(W)] for _ in range(H)]
def disc(cx,cy,r,ch='.'):
    for y in range(int(cy-r-1),int(cy+r+2)):
        for x in range(int(cx-r-1),int(cx+r+2)):
            if 1<=x<W-1 and 1<=y<H-1 and math.hypot(x-cx,y-cy)<=r: g[y][x]=ch
def lerp(a,b,t): return a+(b-a)*t
def road(path,w):
    for i in range(len(path)-1):
        (x0,y0),(x1,y1)=path[i],path[i+1]
        n=int(math.hypot(x1-x0,y1-y0)*2)+1
        for k in range(n+1):
            t=k/n; disc(lerp(x0,x1,t),lerp(y0,y1,t),w+0.6*math.sin((y0+t*(y1-y0))/2.5))
disc(24,77,6.5)                      # 南：裂谷營地
road([(24,74),(22,68),(24,63)],3.2)  # 往北的坡道
disc(24,61,5.5)                      # 岔路口（熔渣坡）
road([(20,58),(13,52),(11,45),(13,38)],3.0)   # 西：噴口原
disc(11,46,6.5)
road([(28,58),(36,54),(39,46),(38,38),(33,33)],2.6)  # 東：黑曜長廊（較窄、較長）
disc(39,47,4.5)
disc(21,34,6.5)                      # 會合：灰燼營地
road([(13,38),(17,35)],2.6)
road([(21,29),(24,23)],3.0)          # 往王座的階梯
disc(24,12,10)                       # 北：熔心王座
for x in range(21,28):
    for y in range(20,24): g[y][x]='.'
# 平滑（同荊棘谷：避免單位卡在斜角）
def nb(x,y): return sum(1 for dx in (-1,0,1) for dy in (-1,0,1) if (dx or dy) and g[y+dy][x+dx]=='.')
for _ in range(2):
    flip=[(x,y) for y in range(1,H-1) for x in range(1,W-1) if g[y][x]=='#' and nb(x,y)>=5]
    for x,y in flip: g[y][x]='.'
    fill=[(x,y) for y in range(1,H-1) for x in range(1,W-1) if g[y][x]=='.' and nb(x,y)<=2]
    for x,y in fill: g[y][x]='#'
for y in range(H):
    g[y][0]=g[y][W-1]='#'
for x in range(W):
    g[0][x]=g[H-1][x]='#'
# 零星岩柱（避開營火、出生點、王座中央）
for _ in range(30):
    x=random.randrange(3,W-3); y=random.randrange(26,72)
    if g[y][x]=='.' and math.hypot(x-24,y-77)>5 and math.hypot(x-21,y-34)>4 and all(g[y+dy][x+dx]=='.' for dx in range(-2,3) for dy in range(-2,3)): g[y][x]='#'
for r in g: print("    '"+''.join(r)+"',")
