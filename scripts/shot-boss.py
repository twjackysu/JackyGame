# Boss 第二階段截圖（第 65 輪）：python3 scripts/shot-boss.py 名稱 地圖 武器 W H fury|night ['SHOTS JSON']；要先 npx vite --port 5173
import json,os,subprocess,sys
name,stage,weapon,W,H,mode=sys.argv[1:7]
extra=json.loads(sys.argv[7]) if len(sys.argv)>7 else None
ch={m:'spare' for m in ['mistwood','thornvale','emberrift','starfall']}
ls={"jg_rt_hint_seen":"1","jg_tip_seen":"1","jg_choices":ch}
base={"level":16,"bossKills":3,"furyKills":1}
if stage=='mistwood': ls["jg_rt_mistwood"]={**base,mode:True}
else: ls["jg_rt_mistwood"]=base; ls["jg_rt_"+stage]={"bossKills":3,"furyKills":1,mode:True}
B="const B=sc().s.units.find(u=>u.tier==='boss'&&!u.dead); const p=sc().s.units[0]; p.hp=p.maxHp;"
shots=extra or [[3,B+"p.x=B.x; p.y=B.y+300; sc().commands=()=>{const b=sc().s.units.find(u=>u.tier==='boss'&&!u.dead); return b?[{type:'target',id:b.id}]:[]}; [B.defId,!!B.fury,Math.round(B.x),Math.round(B.y)]"],[9,B+"B.hp=B.maxHp*0.52;1"],[12,B+"[Math.round(B.hp/B.maxHp*100),Math.round(p.y)]"],[15,B+"1"]]
env=dict(os.environ,LS=json.dumps(ls),STAGE=stage,SHOTS=json.dumps(shots))
subprocess.run(["timeout","400","node","scripts/shot-newsave.mjs",name,weapon,W,H],env=env,cwd="/home/claude/jackygame")
