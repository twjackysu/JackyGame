# 相遇凍結截圖（第 78 輪）：scripts/shot-enc.sh 地圖 tx ty 名稱 [W H 取|助 武器]（tx ty 見 encounters.ts）。要先 npx vite --port 5173。
cd /home/claude/jackygame
ST=$1; TX=$2; TY=$3; N=$4; W=${5:-360}; H=${6:-640}; PK=${7:-助}; WP=${8:-sword}
LS="{\"jg_rt_hint_seen\":\"1\",\"jg_tip_seen\":\"1\",\"jg_rt_$ST\":{\"level\":8},\"jg_rt_mistwood\":{\"level\":8,\"bossKills\":1},\"jg_chapter_$ST\":\"1\"}"
TEL="(()=>{const s=sc(); const p=s.s.units[0]; window.AUTOPICK=()=>(clk('$PK')&&clk('就這麼做'))||clk('繼續'); s.commands=()=>[]; for(const u of s.s.units.slice(1)){ if(Math.hypot(u.x-p.x,u.y-p.y)<4000||Math.hypot(u.x-($TX*100+50),u.y-($TY*100+50))<2500){u.y-=30000; u.mode='idle';} } p.x=$TX*100+50; p.y=$TY*100+150; return [s.encOpen.map(e=>e.id)]})()"
SHOTS=$(python3 -c "
import json; t='''$TEL'''
print(json.dumps([[4,t],[5,t],[5.5],[6.5],[7.5]]))")
LS="$LS" STAGE=$ST SHOTS="$SHOTS" timeout 300 node scripts/shot-newsave.mjs $N $WP $W $H
