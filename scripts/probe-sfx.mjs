// 音效的客觀檢查（第 165 輪）：先 `npx vite --port 5173`，再 `node scripts/probe-sfx.mjs`。把 AudioContext 換成 OfflineAudioContext 算出波形，印每個音效的峰值／長度／RMS（有沒有聲音、會不會破音、比 hitHeavy 大還小）；好不好聽還是要人聽。
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// 「impact:種類:大小」＝敵人招式落下（第 169 輪）；NAMES=a,b 只看指定的
const names = process.env.NAMES ? process.env.NAMES.split(',') : ['blessOffer', 'blessPick', 'thunder', 'bloom', 'shadow', 'pulse', 'slash', 'burst', 'tick', 'hitHeavy', 'hit', 'warn', 'dodged', 'uniqueGet', 'impact:claw:1', 'impact:bite:1', 'impact:sweep:1', 'impact:quake:1', 'impact:slam:1', 'impact:bite:0.75', 'impact:bite:0.5', 'impact:claw:0.5'];
for (const n of names) {
  const pg2 = await b.newPage();
  await pg2.goto('http://localhost:5173/?debug', { waitUntil: 'domcontentloaded', timeout: 90000 });
  const r = await pg2.evaluate(async (n) => {
    const off = new OfflineAudioContext(1, 48000 * 2, 48000);
    window.AudioContext = function () { return new Proxy(off, { get(t, k) { if (k === 'state') return 'running'; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }); };
    const { SFX } = await import('/src/audio/sfx.ts?probe=' + n.replace(/[^a-z0-9]/gi, '_'));
    if (n.startsWith('impact:')) { const [, k, z] = n.split(':'); SFX.enemyImpact(k, +z); } else if (SFX[n]) SFX[n](n === 'warn'); else SFX.blessProc(n);
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, last = 0, sq = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 0.003) last = i; sq += d[i] * d[i]; }
    return { peak: +peak.toFixed(3), sec: +(last / 48000).toFixed(2), rms: +Math.sqrt(sq / Math.max(1, last)).toFixed(3) };
  }, n);
  console.log(n, JSON.stringify(r));
  await pg2.close();
}
await b.close();
