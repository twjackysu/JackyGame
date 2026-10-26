# 星隕高原 48×88 草稿地圖產生器（D-138）。第四張大地圖（通關後的挑戰地圖）：夜空下的高原，石頭格＝晶簇／斷崖（都不能走）。
# 南邊營地往北是一大片「墜星原」（星星會砸下來的空地），往北分成兩條路：西邊「晶簇林」（窄、彎）、東邊「碎星迴廊」（寬、有精英），
# 在「觀星營地」會合，北邊是 Boss「隕星坑」。
# 用法：python3 scripts/gen-starfall-draft.py → 印出 ASCII（貼進 src/core/battle/rt/maps/starfall.ts）
import random, math
W,H=48,88
random.seed(38)
g=[['#' for _ in range(W)] for _ in range(H)]
def disc(cx,cy,r,ch='.'):
    for y in range(int(cy-r-1),int(cy+r+2)):
        for x in range(int(cx-r-1),int(cx+r+2)):
            if 1<=x<W-1 and 1<=y<H-1 and math.hypot(x-cx,(y-cy)*1.05)<=r: g[y][x]=ch
def lerp(a,b,t): return a+(b-a)*t
def road(path,w):
    for i in range(len(path)-1):
        (x0,y0),(x1,y1)=path[i],path[i+1]
        n=int(math.hypot(x1-x0,y1-y0)*2)+1
        for k in range(n+1):
            t=k/n; disc(lerp(x0,x1,t),lerp(y0,y1,t),w+0.5*math.sin((x0+t*(x1-x0))/2.2+(y0+t*(y1-y0))/3))
disc(24,81,6)                        # 南：高原營地
road([(24,77),(24,70)],3.0)
disc(24,62,10)                       # 墜星原（大空地）
road([(17,55),(11,49),(13,42),(9,36),(15,31)],2.4)   # 西：晶簇林（窄、彎）
road([(31,55),(37,48),(36,40),(31,33)],3.0)          # 東：碎星迴廊
disc(37,45,4.5)
disc(23,30,6)                        # 會合：觀星營地
road([(23,25),(24,22)],3.0)
disc(24,12,10)                       # 北：隕星坑
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
# 零星晶柱：墜星原多幾根（可以躲），避開營火、出生點、坑中央
for _ in range(60):
    x=random.randrange(3,W-3); y=random.randrange(24,74)
    if g[y][x]=='.' and math.hypot(x-24,y-81)>5 and math.hypot(x-23,y-30)>4 and all(g[y+dy][x+dx]=='.' for dx in range(-2,3) for dy in range(-2,3)): g[y][x]='#'
for r in g: print("    '"+''.join(r)+"',")
