// 面板截圖小工具（第 62 輪）：在 shot-newsave 的 SHOTS 裡 fetch("/scripts/shot-panel.js").then(r=>r.text()).then(t=>{eval(t); ...})。mt(前綴, n)＝點 sc().menu 裡的文字按鈕；mt2(文字)＝點文字所在的格子。
window.AUTOPICK=null;
window.mt = (pre, n=0) => { const out=[]; const walk=(l)=>{for(const o of l){ if(o.list) walk(o.list); else if(o.type==='Text'&&o.visible&&o.text.startsWith(pre)) out.push(o);} }; walk(sc().menu?sc().menu.list:[]); const t=out[n]; if(!t) return 'none '+pre; t.emit('pointerdown',{x:0,y:0},0,0,{stopPropagation(){}}); t.emit('pointerup',{x:0,y:0},0,0,{stopPropagation(){}}); return 'ok '+pre; };
'ready'
window.mt2 = (pre) => { const m=sc().menu; let t=null; const walk=(l)=>{for(const o of l){ if(o.list) walk(o.list); else if(!t&&o.type==='Text'&&o.visible&&o.text.includes(pre)) t=o;} }; walk(m.list); if(!t) return 'none '+pre; const c=t.parentContainer; const r=c.list.find(o=>o.type==='Rectangle'&&o.input&&o.listenerCount('pointerdown')&&Math.abs(o.y-t.y)<o.height/2&&Math.abs(o.x-t.x)<o.width/2+200&&o.width<700); if(!r) return 'norect'; r.emit('pointerdown',{x:0,y:0},0,0,{stopPropagation(){}}); return 'ok2 '+pre; };
'ready'
