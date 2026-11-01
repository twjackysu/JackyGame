# Boss 自然醒來＋凍結截圖（第 85 輪）：LV=等級 scripts/shot-meet.sh 地圖 名稱 [W H]；從 Boss 南方 15 公尺走過去，醒來後每段 ff 再凍結一幀截圖（看一眼鏡頭 D-219）。要先 npx vite --port 5173。
ST=${1:-starfall}; N=${2:-g49m}; W=${3:-360}; H=${4:-640}; LV=${LV:-14}
LS="{\"jg_rt_hint_seen\":\"1\",\"jg_tip_seen\":\"1\",\"jg_rt_mistwood\":{\"level\":$LV,\"bossKills\":1},\"jg_rt_$ST\":{\"level\":$LV,\"bossKills\":0},\"jg_chapter_$ST\":\"1\",\"jg_memories\":[\"x\"]}"
K1="(()=>{const s=sc(); const B=s.s.units.find(u=>u.tier==='boss'&&!u.dead); const p=s.s.units[0]; const z=s.s.bossZone||{}; p.x=B.x; p.y=B.y+1500; s.commands=()=>[{type:'moveTo',x:B.x,y:B.y}]; let i=0; for(;i<400&&B.mode!=='combat';i++) ff(0.1); window.meetAt=gt; return [B.defId, i, Math.round((p.y-B.y)/100*10)/10]})()"
D="(()=>{__game.loop.sleep(); T+=16; off+=16; __game.step(T,16); const s=sc(); const B=s.s.units.find(u=>u.tier==='boss'); return [Math.round(s.sy(B.y)), Math.round(s.sy(s.s.units[0].y))]})()"
SHOTS=$(python3 -c "
import json; a='''$K1'''; d='''$D'''
print(json.dumps([[3,a]]+[[0,'__game.loop.wake(); ff(%s); '%t + d] for t in [0.05,0.4,0.5,0.8,0.8,0.8]]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 600 node scripts/shot-newsave.mjs $N sword $W $H | grep -o '"ev":[^}]*' 
