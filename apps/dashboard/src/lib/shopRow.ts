import 'server-only';

import type { Shop } from './types';

/**
 * shops の 1 行を画面向けに整える。
 *
 * 操作用パスワードのハッシュはクライアントコンポーネントへ渡る可能性があるので、
 * ここで必ず落とし、「設定済みかどうか」だけを残す。
 */
export function toShop(row: Record<string, unknown>): Shop {
  const {
    drawer_open_password_hash: drawerHash,
    void_password_hash: voidHash,
    table_clear_password_hash: tableHash,
    staff_pin_hash: _staffPinHash,
    ...rest
  } = row;

  return {
    ...(rest as unknown as Shop),
    has_drawer_open_password: Boolean(drawerHash),
    has_void_password: Boolean(voidHash),
    has_table_clear_password: Boolean(tableHash),
  };
}
