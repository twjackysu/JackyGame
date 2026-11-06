// 多角色（F1，D-302）的客戶端流程。過渡期：遊戲還是讀寫舊 key，所以換角色＝
// 先把目前角色的舊 key 同步上去（migrate.sync）→ 選新角色 → 拿新角色的舊 key 快照（migrate.pull）→ 清掉「角色的」舊 key、寫入新的。
// 裝置 key（操作設定、教學提示、開場動畫，DEVICE_KEY）不動。全部排在 legacyOp 的同一條佇列後面，不會跟面板動作交錯。
import type { CharacterView, WeaponView } from '../net/views';
import { DEVICE_KEY } from '../net/legacyKeys';
import { bootServer } from './boot';
import { captureLegacy, legacySerial } from './legacyOps';

export interface RosterInfo {
  activeId: string;
  characters: CharacterView[];
}

export async function loadRoster(): Promise<RosterInfo | null> {
  try {
    const { client } = await bootServer();
    // 先把目前的舊 key 同步上去，列表上的等級、金幣才是最新的
    await legacySerial(() => client.call('migrate.sync', { snapshot: captureLegacy() }));
    const [acc, characters] = await Promise.all([client.call('account.get', {}), client.call('character.list', {})]);
    const sorted = characters.slice().sort((a, b) => a.slot - b.slot);
    return { activeId: acc.activeCharacterId ?? sorted[0]?.id ?? '', characters: sorted };
  } catch (e) {
    console.warn('[roster]', e);
    return null;
  }
}

/** 舊 key 換成這份快照（角色的 key 全清，裝置 key 留著） */
export function applyLegacy(ls: Pick<Storage, 'key' | 'getItem' | 'setItem' | 'removeItem' | 'length'>, snapshot: Record<string, string>): void {
  const drop: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith('jg_') && !DEVICE_KEY.test(k)) drop.push(k);
  }
  for (const k of drop) ls.removeItem(k);
  for (const [k, v] of Object.entries(snapshot)) if (k.startsWith('jg_') && !DEVICE_KEY.test(k)) ls.setItem(k, v);
}

/** 換成這個角色；成功回 true（呼叫的畫面要重開，記憶體裡的狀態是舊角色的） */
export async function switchCharacter(id: string): Promise<boolean> {
  try {
    const { client } = await bootServer();
    return await legacySerial(async () => {
      await client.call('migrate.sync', { snapshot: captureLegacy() });
      await client.call('character.select', { id });
      const { snapshot } = await client.call('migrate.pull', {});
      applyLegacy(localStorage, snapshot);
      return true;
    });
  } catch (e) {
    console.warn('[roster] switch', e);
    return false;
  }
}

export async function createCharacter(name: string, weapon: WeaponView, slot?: number): Promise<CharacterView | null> {
  try {
    const { client } = await bootServer();
    return await legacySerial(() => client.call('character.create', { name, weapon, ...(slot === undefined ? {} : { slot }) }));
  } catch (e) {
    console.warn('[roster] create', e);
    return null;
  }
}

export async function deleteCharacter(id: string): Promise<string | null> {
  try {
    const { client } = await bootServer();
    await legacySerial(() => client.call('character.delete', { id }));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
