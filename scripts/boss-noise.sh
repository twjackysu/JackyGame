# Boss 整場重複文字掃描（第 98 輪，原本每輪在 scratchpad 重寫的 bn.sh）：LS='{…}' BOSS=defId bash scripts/boss-noise.sh 地圖 武器 W H 秒；要先 npx vite --port 5173。第 3 秒傳到 Boss 南方 400＋target，之後每 2 秒補血、Boss 不在交戰就再 target。
sed -e 's|  await pg.waitForTimeout(700);|  i++; continue;|' scripts/shot-newsave.mjs > screenshots/bn-$$.mjs
ST=$1; WP=$2; W=$3; H=$4; SEC=${5:-180}
SHOTS=$(BOSS=$BOSS python3 -c "
import json,os
b=os.environ['BOSS']
first=\"(()=>{const s=sc().s; const B=s.units.find(u=>u.defId==='%s'); const p=s.units[0]; p.x=B.x; p.y=B.y+400; s.potions=20; sc().pending.push({type:'target',id:B.id}); return B.hp})()\"%b
rest=\"(()=>{const s=sc().s; const B=s.units.find(u=>u.defId==='%s'); const p=s.units[0]; p.hp=p.maxHp; s.potions=20; if(B&&B.hp>0&&B.mode!=='combat') sc().pending.push({type:'target',id:B.id}); return B?Math.round(B.hp/B.maxHp*100):-1})()\"%b
print(json.dumps([[3,first]]+[[t,rest] for t in range(5,$SEC+1,2)]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 1200 node screenshots/bn-$$.mjs bn $WP $W $H | python3 -c "
import sys,json,re,collections
c=collections.Counter(); first={}; last=None
for l in sys.stdin:
  if not l.startswith('#'): print(l[:200]); continue
  d=json.loads(l[l.index('{'):]); last=(d.get('ev'),d.get('out'))
  for x in d['log']:
    t=x.split(' ',1)[1]
    if re.search(r'%|秒⏎×|^\d|^光門 \d|^格擋反擊$|^目標|^行囊|^冰霜新星$|^星輝屏障$|^後躍射擊$|^見切射擊$|^\+|^▼|^[^⏎]{1,5}$', t): continue
    c[t]+=1; first.setdefault(t, x.split(' ')[0])
print('last boss%/outcome', last)
for t,n in c.most_common(30): print(n, first[t], t[:70])
"
