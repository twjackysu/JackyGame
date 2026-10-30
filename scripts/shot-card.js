// 燼牌自動打（第 62 輪）：先載入 shot-panel.js，再 eval 這個檔；cardLoop(秒)＝輪到你就把中間那張牌點兩下打出，沒牌就放棄；看到「…贏了」就停。
window.cardLoop = (maxSec) => { const log=[]; const t0=gt; let shots=0;
  const all=()=>{const o=[];const w=(l)=>{for(const x of l){if(x.list)w(x.list);else o.push(x);}};w(sc().menu.list);return o;};
  while(gt-t0<maxSec){ ff(0.5); if(!sc().menu) {log.push('nomenu');break;}
    const objs=all(); const txt=objs.filter(o=>o.type==='Text'&&o.visible).map(o=>o.text);
    if(txt.some(t=>/贏了$|^平手/.test(t)) || txt.some(t=>/點一下繼續/.test(t))) { log.push('END '+gt.toFixed(1)+' '+txt.filter(t=>t.length>2).slice(0,12).join('|')); break; }
    const pb=objs.find(o=>o.type==='Text'&&o.text==='放棄這一局'); if(pb&&pb.input&&pb.input.enabled){ const hand=objs.filter(o=>o.type==='Rectangle'&&o.input&&o.input.enabled&&Math.round(o.width)===100&&Math.round(o.height)===144);
      if(hand.length){ const h=hand[Math.floor(hand.length/2)]; for(let k=0;k<2;k++){h.emit('pointerdown',{x:0,y:0},0,0,{stopPropagation(){}}); h.emit('pointerup',{x:0,y:0},0,0,{stopPropagation(){}});} log.push(gt.toFixed(1)+' play'); }
      else { mt('放棄這一局'); log.push(gt.toFixed(1)+' pass'); } }
  } return log.slice(-14).join(' / '); };
'ok'
