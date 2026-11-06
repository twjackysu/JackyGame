// HTTP 傳輸（V6，D-305）：POST <url>（server/http.ts 的 /api），body 就是協定 JSON 字串。
// 逾時或連不上丟 TransportTimeout（GameClient 用同一個 requestId 重送，伺服器冪等）；HTTP 錯誤碼（413／429…）也當掉包處理。
import { TransportTimeout, type Transport } from './Transport';

export class HttpTransport implements Transport {
  constructor(private readonly url: string) {}

  async send(json: string, timeoutMs: number): Promise<string> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, signal: ctl.signal });
      if (!res.ok) throw new TransportTimeout();
      return await res.text();
    } catch {
      throw new TransportTimeout();
    } finally {
      clearTimeout(t);
    }
  }
}
