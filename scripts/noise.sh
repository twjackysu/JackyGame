# 重複文字掃描（第 96 輪）：LS='{…}' [VIA=gate] bash scripts/noise.sh 地圖 武器 W H 秒；要先 npx vite --port 5173。每 2 秒一段、只統計不截圖，列出每句出現在幾段（跨段的同一句算 2）。
mkdir -p screenshots; sed -e 's|  await pg.waitForTimeout(700);|  if (!js) { i++; continue; } await pg.waitForTimeout(700);|' scripts/shot-newsave.mjs > screenshots/noise.mjs
ST=$1; WP=$2; W=$3; H=$4; SEC=${5:-180}
SHOTS=$(python3 -c "import json; print(json.dumps([[t] for t in range(2,$SEC+1,2)]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 900 node screenshots/noise.mjs noise $WP $W $H | python3 -c "
import sys,json,re,collections
c=collections.Counter(); first={}
for l in sys.stdin:
  if not l.startswith('#'): print(l[:200]); continue
  d=json.loads(l[l.index('{'):])
  for x in d['log']:
    t=x.split(' ',1)[1]
    if re.search(r'%|秒⏎×|^\d|^光門 \d|^格擋反擊$|^目標|^行囊|^冰霜新星$|^星輝屏障$|^後躍射擊$|^見切射擊$|^\+|^▼|^[^⏎]{1,5}$', t): continue
    c[t]+=1; first.setdefault(t, x.split(' ')[0])
for t,n in c.most_common(25): print(n, first[t], t[:60])
"
