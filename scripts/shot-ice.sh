#!/bin/sh
# 拍「被冰住的怪」的同一瞬間對照（第 199 輪）：-x 那張是舊的橢圓泡泡。先 `npx vite --port 5173`。
# 用法：sh scripts/shot-ice.sh tag [W H]；環境變數 STAGE（預設 emberrift）、LEVEL、DIST（怪離主角至少多遠）、MINLEFT／MAXLEFT（冰凍還剩幾 tick）、NIGHT=1、LOWFX=1
# 會印出 PAGE [[x,y,defId]]＝那隻怪在畫面上的位置（乘 DSF 才是圖上的像素）
UNTIL='(()=>{const S=sc();const s=S.s;const p=s.units[0];const f=s.units.filter(u=>u.side==="enemy"&&!u.dead&&u.statuses.some(q=>q.id==="freeze"&&q.until-s.tick>'${MINLEFT:-25}'&&q.until-s.tick<'${MAXLEFT:-60}')&&Math.hypot(u.x-p.x,u.y-p.y)>'${DIST:-160}'&&(S.flashUntil.get(u.id)??0)<S.time.now-200);if(s.tick>200&&f.length>='${MIN:-1}'){console.log("[["+JSON.stringify([Math.round(S.sx(f[0].x)),Math.round(S.sy(f[0].y)),f[0].defId,f.length]));return true}return false})()' PAIR='sc().iceCase=false; draw=true; __game.step(T,0); 1' LEVEL=${LEVEL:-14} DSF=${DSF:-3} timeout 280 node scripts/play.mjs ${WEAPON:-staff} ${STAGE:-emberrift} $1 ${N:-1} 150 $2 $3
