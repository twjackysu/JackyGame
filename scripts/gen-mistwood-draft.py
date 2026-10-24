# 霧語森林 48×96 草稿地圖產生器（design/22）。輸出 ASCII 與重生點表到 /tmp/claude-0/mw/mw.json。
# 用法：python3 scripts/gen-mistwood-draft.py
import json, random, math
W,H=48,96
random.seed(7)
g=[['.' for _ in range(W)] for _ in range(H)]
def rect(x0,y0,x1,y1,ch='#'):
    for y in range(max(0,y0),min(H,y1+1)):
        for x in range(max(0,x0),min(W,x1+1)): g[y][x]=ch
def blob(cx,cy,r):
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            if 0<=x<W and 0<=y<H and math.hypot(x-cx,y-cy)<=r+0.3: g[y][x]='#'
# 外圍樹林帶：左右邊緣 2～4 格寬、會起伏
for y in range(H):
    l=2+int(1.5+1.5*math.sin(y/5)); r=2+int(1.5+1.5*math.cos(y/6))
    rect(0,y,l-1,y); rect(W-r,y,W-1,y)
# 南入口：下方收窄成林道
rect(0,94,19,95); rect(29,94,47,95)
# 森林入口與分岔之間的林帶（中間留兩個口：左 x 8-12、右 x 34-39）
rect(0,72,7,73); rect(13,72,33,73); rect(40,72,47,73)
# 中央分隔林（狼群巢穴／森林深處之間）y 46-71
for y in range(46,72):
    w=2+int(1+math.sin(y/3))
    rect(23-w,y,24+w,y)
# 狼群巢穴（西）周圍石陣
for (x,y) in [(9,66),(16,60),(6,56),(14,52)]: blob(x,y,1)
# 森林深處（東）石頭掩體（射手躲）
for (x,y) in [(33,64),(39,60),(35,55)]: blob(x,y,1)
# 精英區下緣林帶（y 44-45），左右各留口
rect(0,44,9,45); rect(15,44,32,45); rect(38,44,47,45)
# 精英區中間零星石
for (x,y) in [(18,36),(30,38),(24,30)]: blob(x,y,1)
# 狼王巢穴入口：y 22-23 林牆，中間開 4 格
rect(0,22,21,23); rect(26,22,47,23)
# 巢穴內圈：圓形空地 r=9 at (24,11)，外面填樹
for y in range(0,22):
    for x in range(W):
        if math.hypot(x-24,(y-11)*1.0)>10.5: g[y][x]='#'
# 零星灌木（避開路線）
for _ in range(60):
    x=random.randrange(3,W-3); y=random.randrange(24,92)
    if g[y][x]=='.': g[y][x]='#'
rows=[''.join(r) for r in g]
camps=[{"id":"south","x":24,"y":89},{"id":"deep","x":36,"y":49}]
for c in camps:
    for y in range(c['y']-4,c['y']+5):
        for x in range(c['x']-4,c['x']+5):
            if math.hypot(x-c['x'],y-c['y'])<=4: g[y][x]='.'
# 清空重生點與通道
spawns=[
 ("entry","wolf",24,79,2,3,30,None),
 ("den_a","wolf",11,62,2,4,30,None),
 ("den_b","wolf",16,56,2,4,30,None),
 ("deep_wolves","wolf",38,66,2,3,30,None),
 ("deep_shooters","thorn_shooter",37,58,2,2,45,None),
 ("elite","alpha_wolf",24,36,1,1,180,"elite"),
 ("elite_pack","wolf",21,33,2,3,30,None),
]
for s in spawns:
    for y in range(s[3]-s[4]-1,s[3]+s[4]+2):
        for x in range(s[2]-s[4]-1,s[2]+s[4]+2):
            if 0<=x<W and 0<=y<H and math.hypot(x-s[2],y-s[3])<=s[4]+1: g[y][x]='.'
for x in range(22,27):
    for y in range(20,26): g[y][x]='.'
rows=[''.join(r) for r in g]
import os; os.makedirs('/tmp/claude-0/mw', exist_ok=True)
json.dump({"rows":rows,"camps":camps,"spawns":spawns,"player":[24,92]},open('/tmp/claude-0/mw/mw.json','w'))
print('\n'.join(rows))
