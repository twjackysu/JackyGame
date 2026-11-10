// 音效的客觀檢查（第 165 輪）：先 `npx vite --port 5173`，再 `node scripts/probe-sfx.mjs`。把 AudioContext 換成 OfflineAudioContext 算出波形，印每個音效的峰值／長度／RMS（有沒有聲音、會不會破音、比 hitHeavy 大還小）；好不好聽還是要人聽。
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const names = ['blessOffer', 'blessPick', 'thunder', 'bloom', 'shadow', 'pulse', 'slash', 'burst', 'tick', 'hitHeavy', 'uniqueGet'];
for (const n of names) {
  const pg2 = await b.newPage();
  await pg2.goto('http://localhost:5173/?debug', { waitUntil: 'domcontentloaded', timeout: 90000 });
  const r = await pg2.evaluate(async (n) => {
    const off = new OfflineAudioContext(1, 48000 * 2, 48000);
    window.AudioContext = function () { return new Proxy(off, { get(t, k) { if (k === 'state') return 'running'; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }); };
    const { SFX } = await import('/src/audio/sfx.ts?probe=' + n);
    if (SFX[n]) SFX[n](); else SFX.blessProc(n);
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
