// 登入（design/24 §1 第 4 點）：本機版只有一個帳號，token 是固定字串；線上版把這個介面換成真的驗證（26-security）。
import { ApiError } from '../net/protocol';

export interface Auth {
  /** token → accountId；不合法就丟 unauthorized */
  resolve(token: string | undefined): Promise<string>;
}

export const LOCAL_TOKEN = 'local';
export const LOCAL_ACCOUNT = 'acc_local';

export class LocalAuth implements Auth {
  async resolve(token: string | undefined): Promise<string> {
    if (token !== undefined && token !== LOCAL_TOKEN) throw new ApiError('unauthorized', 'bad token');
    return LOCAL_ACCOUNT;
  }
}
