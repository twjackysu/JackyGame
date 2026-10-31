# 走進地區的大字凍結截圖（第 73 輪）：scripts/shot-zone.sh 地圖 x y 名稱 [W H]；要先 npx vite --port 5173。老玩家存檔，12 秒傳送、12.5 秒凍結。
cd /home/claude/jackygame
ST=$1; X=$2; Y=$3; N=$4; W=${5:-360}; H=${6:-640}
LS='{"jg_rt_hint_seen":"1","jg_tip_seen":"1","jg_rt_mistwood":{"level":16,"bossKills":2},"jg_rt_thornvale":{"bossKills":1},"jg_rt_emberrift":{"bossKills":1},"jg_rt_starfall":{"bossKills":1},"jg_chapter_mistwood":"1","jg_chapter_thornvale":"1","jg_chapter_emberrift":"1","jg_chapter_starfall":"1","jg_choices":{"mistwood":"spare","thornvale":"spare","emberrift":"spare","starfall":"spare"}}'
SHOTS="[[12,\"const p=sc().s.units[0]; p.x=$X; p.y=$Y; sc().s.moveGoal=null; sc().commands=()=>[]; 1\"],[12.5,\"sc().tweens.pauseAll(); sc().time.paused=true; JSON.stringify(sc().zoneTexts.map(z=>[z.text,z.alpha.toFixed(2),z.y,z.depth]))\"],[13.0,\"JSON.stringify(sc().zoneTexts.map(z=>[z.text,z.alpha.toFixed(2),z.y]))\"]]" LS="$LS" STAGE=$ST timeout 300 node scripts/shot-newsave.mjs $N sword $W $H
