// 本機傳輸（D-277）：同一個程式裡把請求交給 GameServer，但一定經過 JSON 字串，
// 可以模擬延遲與掉包（請求丟了或回應丟了），讓「本機能動、上線壞掉」的問題在本機就先壞。
import { TransportTimeout, type Transport } from './Transport';

export interface LocalTransportOptions {
  /** 單程延遲（毫秒） */
  latencyMs?: number;
  /** 掉包率 0～100（請求或回應各自可能掉） */
  dropPct?: number;
  /** 掉包用的亂數（測試傳固定種子的版本） */
  random?: () => number;
}

export class LocalTransport implements Transport {
  constructor(
    private readonly handle: (json: string) => Promise<string>,
    private readonly opts: LocalTransportOptions = {},
  ) {}

  private wait(ms: number): Promise<void> {
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  }
  private dropped(): boolean {
    const p = this.opts.dropPct ?? 0;
    return p > 0 && (this.opts.random ?? Math.random)() * 100 < p;
  }

  async send(json: string, timeoutMs: number): Promise<string> {
    const lat = this.opts.latencyMs ?? 0;
    const lostReq = this.dropped();
    const lostRes = this.dropped();
    const work = (async () => {
      await this.wait(lat);
      if (lostReq) return null;
      const res = await this.handle(String(json));
      await this.wait(lat);
      return lostRes ? null : String(res);
    })();
    const out = await Promise.race([work, this.wait(timeoutMs).then(() => null)]);
    if (out === null) throw new TransportTimeout();
    return out;
  }
}
