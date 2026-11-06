// 傳輸層介面（鐵律 2：只傳字串）。本機用 LocalTransport，上線換 WsTransport／HttpTransport。
export interface Transport {
  /** 送出一則 JSON 字串請求，拿到 JSON 字串回應；掉包時 reject（由 GameClient 重送） */
  send(json: string, timeoutMs: number): Promise<string>;
}

export class TransportTimeout extends Error {
  constructor() {
    super('timeout');
  }
}
