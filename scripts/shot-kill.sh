# 討伐那一刻凍結截圖（第 78 輪）：scripts/shot-kill.sh 地圖 名稱 [W H 武器 取|還]；STEPS=遊戲秒數陣列（負數＝那一秒點「繼續冒險」）。要先 npx vite --port 5173。
cd /home/claude/jackygame
ST=$1; N=$2; W=${3:-360}; H=${4:-640}; WP=${5:-sword}; PK=${6:-取}
LS="{\"jg_rt_mistwood\":{\"level\":16,\"bossKills\":1},\"jg_rt_hint_seen\":\"1\",\"jg_tip_seen\":\"1\",\"jg_rt_$ST\":{\"level\":12,\"bossKills\":0},\"jg_chapter_$ST\":\"1\",\"jg_memories\":[\"x\"]}"
K1="(()=>{const s=sc(); window.AUTOPICK=()=>(clk('$PK')&&clk('就這麼做'))||clk('略過')||clk('繼續'); const B=s.s.units.find(u=>u.tier==='boss'&&!u.dead); const p=s.s.units[0]; p.x=B.x; p.y=B.y+420; B.hp=B.maxHp*0.06; s.s.potions=20; s.pending.push({type:'target',id:B.id}); return B.defId})()"
K2="(()=>{const s=sc(); const B=s.s.units.find(u=>u.tier==='boss'); for(let i=0;i<300&&!B.dead;i++){ff(0.1); s.s.units[0].hp=s.s.units[0].maxHp; if(B.mode!=='combat') s.pending.push({type:'target',id:B.id});} s.commands=()=>[]; return [B.dead, gt]})()"
SHOTS=$(python3 -c "
import json; a='''$K1'''; b='''$K2'''
print(json.dumps([[3,a],[4,b]]+[([x] if x>0 else [-x,'clk(\"繼續冒險\")']) for x in ${STEPS:-[6,8,10,12,14,16,18,20,22]}]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 600 node scripts/shot-newsave.mjs $N $WP $W $H
