# 燼牌重複文字掃描（第 99 輪）：LS='{…}' bash scripts/card-noise.sh 地圖 W H 秒；要先 npx vite --port 5173。開燼牌面板→練習一局→每 0.5 秒 getData('auto')() 幫你出一手，結束就再開一局；印每句出現在幾段。對手＝那張地圖的在地對手。
ST=$1; W=$2; H=$3; SEC=${4:-150}
A='(()=>{const m=sc().menu; if(!m) return "nomenu"; if(m.getData("over")()) {m.getData("start")(false); return "restart";} return m.getData("auto")()?"play":"wait"})()'
F='(()=>{sc().commands=()=>[]; window.AUTOPICK=null; sc().openCards(); sc().menu.getData("start")(false); return "start"})()'
SHOTS=$(python3 -c "import json,sys; print(json.dumps([[4,sys.argv[1]]]+[[t/2,sys.argv[2]] for t in range(10,$SEC*2)]))" "$F" "$A")
sed -e 's|  await pg.waitForTimeout(700);|  i++; continue;|' scripts/shot-newsave.mjs > screenshots/cn-$$.mjs
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 1500 node screenshots/cn-$$.mjs cn sword $W $H | python3 -c "
import sys,json,re,collections
c=collections.Counter(); first={}; evs=collections.Counter()
for l in sys.stdin:
  if not l.startswith('#'): print(l[:200]); continue
  d=json.loads(l[l.index('{'):]); evs[d.get('ev')]+=1
  for x in d['log']:
    t=x.split(' ',1)[1]
    if re.search(r'^\d+$|^[^⏎]{1,4}$', t): continue
    c[t]+=1; first.setdefault(t, x.split(' ')[0])
print(evs)
for t,n in c.most_common(40): print(n, first[t], t[:80])
"
