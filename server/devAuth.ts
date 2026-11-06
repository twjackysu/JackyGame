// 開發用登入（AUTH_MODE=dev，D-305）：token「dev:<名字>」→ 帳號 dev_<名字>。只給本機開發與整合測試；
// 線上一定要換成驗 JWT 的 Auth（26-security：驗簽章、iss、aud、exp），main.ts 在非 dev 模式沒有 JWT 設定時拒絕啟動。
import { ApiError } from '../src/net/protocol';
import type { Auth } from '../src/server/auth';

export class DevAuth implements Auth {
  async resolve(token: string | undefined): Promise<string> {
    const m = typeof token === 'string' ? /^dev:([a-z0-9_]{1,24})$/.exec(token) : null;
    if (!m) throw new ApiError('unauthorized', 'bad token');
    return `dev_${m[1]}`;
  }
}
