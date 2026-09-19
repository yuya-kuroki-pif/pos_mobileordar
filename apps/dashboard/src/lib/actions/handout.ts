'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface IssueResult {
  ok: boolean;
  error?: string;
  /** 発行した直後の 1 回だけ返す。保存はハッシュのみ */
  password?: string;
}

/** 読みまちがえにくい文字だけで作る */
function makePin(length: number) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * レジ・ハンディのログイン PIN を再発行する（仕様書 §5.21）。
 *
 * 指示書は「マスク表示 + 表示ボタン」だが、PIN はハッシュでしか保存していないため
 * 後から元の値を出すことはできない。そこで「再発行してその場で 1 回だけ見せる」
 * 方式にし、誰がいつ発行したかを account_audit_logs に残す。
 */
export async function reissueShopPinAction(shopId: string): Promise<IssueResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'shop_management')) {
      throw new Error('ログイン情報を再発行する権限がありません。');
    }

    const shop = session.shops.find((s) => s.id === shopId);
    if (!shop) return { ok: false, error: 'この店舗を操作する権限がありません。' };

    const pin = makePin(6);

    if (isDemoMode()) {
      // デモでは保存先が無いので、発行した値を返すだけにする
      db();
    } else {
      const supabase = supabaseAdmin();

      const { error } = await supabase.rpc('set_shop_staff_pin', {
        p_shop_id: shopId,
        p_pin: pin,
      });
      if (error) throw error;

      await supabase.from('account_audit_logs').insert({
        corporation_id: session.corporation.id,
        account_id: session.account.id,
        action: 'reissue_shop_pin',
        target: `${shop.name}（${shop.slug}）`,
      });
    }

    revalidatePath('/handout');
    return { ok: true, password: pin };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '再発行できませんでした' };
  }
}
