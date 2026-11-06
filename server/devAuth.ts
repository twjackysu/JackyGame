// 開發用登入（AUTH_MODE=dev，D-305）：token「dev:<名字>」→ 帳號 dev_<名字>。只給本機開發與整合測試；
// 對外一定要用 AUTH_MODE=jwt（server/jwtAuth.ts）；jwt 模式缺設定時 main.ts 拒絕啟動。
import { ApiError } from '../src/net/protocol';
import type { Auth } from '../src/server/auth';

export class DevAuth implements Auth {
  async resolve(token: string | undefined): Promise<string> {
    const m = typeof token === 'string' ? /^dev:([a-z0-9_]{1,24})$/.exec(token) : null;
    if (!m) throw new ApiError('unauthorized', 'bad token');
    return `dev_${m[1]}`;
  }
}
