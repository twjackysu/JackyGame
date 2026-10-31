# Boss 第一次見面凍結截圖（第 73 輪）：scripts/shot-bossmeet.sh 地圖 等級 名稱 [武器] [秒] [W H]；要先 npx vite --port 5173。
cd /home/claude/jackygame
ST=$1; LV=$2; N=$3; WP=${4:-sword}; T=${5:-5.5}; W=${6:-360}; H=${7:-640}
LS="{\"jg_rt_hint_seen\":\"1\",\"jg_tip_seen\":\"1\",\"jg_rt_mistwood\":{\"level\":$LV,\"bossKills\":0},\"jg_chapter_$ST\":\"1\"}"
B="const B=sc().s.units.find(u=>u.tier==='boss'&&!u.dead); const p=sc().s.units[0];"
SHOTS=$(python3 -c "
import json,sys
B='''$B'''
print(json.dumps([[3,B+\"p.x=B.x; p.y=B.y+420; sc().commands=()=>{const b=sc().s.units.find(u=>u.tier==='boss'&&!u.dead); return b?[{type:'target',id:b.id}]:[]}; [B.defId]\"],[$T,\"sc().tweens.pauseAll(); sc().time.paused=true; 1\"]]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 300 node scripts/shot-newsave.mjs $N $WP $W $H
