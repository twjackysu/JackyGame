// 模擬玩家名冊（24 §5）：固定種子、名字、武器偏好、程度（tier）、多久上線一次。
// 全部由 hashSeed 算出來，沒有存檔也能重建同一份名冊；名字是原創組合字。
import { hashSeed, mulberry32 } from '../../core/rng';
import { buyPrice } from '../../core/meta/shop';
import type { RtGear } from '../../core/battle/rt/gear';
import type { WeaponView } from '../../net/views';

export interface SimPlayer {
  /** 帳號 id（sim_ 開頭；真人帳號永遠不會是這個前綴，見 auth.ts） */
  accountId: string;
  name: string;
  weapon: WeaponView;
  seed: number;
  /** 起始物品等級 1～8：有人剛入坑、有人是老手 */
  tier: number;
  /** 兩次行動的間隔（毫秒，40～150 分鐘） */
  intervalMs: number;
  /** 開局金幣 */
  startCoin: number;
  /** 喜歡殺價的程度 0～1（越高買得越便宜、賣得越便宜） */
  thrift: number;
}

export const SIM_ACCOUNT_PREFIX = 'sim_';
export const SIM_COUNT = 30;

const HEAD = ['霧', '燼', '星', '荊', '月', '風', '雪', '焰', '岩', '潮', '夜', '晨', '雷', '苔', '琥'];
const TAIL = ['行者', '獵手', '劍客', '弓手', '術士', '旅人', '小隊長', '守望者', '漂泊者', '鍛匠', '拾荒者', '流星'];
const WEAPONS: WeaponView[] = ['sword', 'bow', 'staff'];

export function simRoster(count = SIM_COUNT): SimPlayer[] {
  const used = new Set<string>();
  const out: SimPlayer[] = [];
  for (let i = 0; out.length < count && i < count * 20; i++) {
    const seed = hashSeed(`sim-player:${i}`);
    const R = mulberry32(seed);
    let name = `${HEAD[Math.floor(R() * HEAD.length)]!}${TAIL[Math.floor(R() * TAIL.length)]!}`;
    if (used.has(name)) name = `${name}${(i % 9) + 1}`;
    if (used.has(name)) continue;
    used.add(name);
    out.push({
      accountId: `${SIM_ACCOUNT_PREFIX}${String(out.length + 1).padStart(2, '0')}`,
      name,
      weapon: WEAPONS[Math.floor(R() * WEAPONS.length)]!,
      seed,
      tier: 1 + Math.floor(R() * 8),
      intervalMs: Math.round((40 + R() * 110) * 60_000),
      startCoin: 300 + Math.floor(R() * 1200),
      thrift: R(),
    });
  }
  return out;
}

export const isSimAccount = (id: string): boolean => id.startsWith(SIM_ACCOUNT_PREFIX);

/** 模擬玩家面對面賣出的開價：行商買價 ×（0.45～0.85，越會殺價開越低；跟它在拍賣所的定價同一個區間，不含隨機） */
export function simAsk(sim: Pick<SimPlayer, 'thrift'>, g: RtGear): number {
  return Math.max(1, Math.round(buyPrice(g) * (0.45 + 0.4 * (1 - sim.thrift))));
}
