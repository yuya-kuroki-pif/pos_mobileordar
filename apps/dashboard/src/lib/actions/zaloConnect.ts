'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { ZaloLoginMode } from '../types';

/**
 * Zalo ログイン連携の設定（案A）。
 *
 * app secret とアクセストークンは環境変数に置くので、ここでは扱わない。
 * 画面に出すのは公開値（app id / OA id）と運用の設定だけ。
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ZaloConnectInput {
  app_id: string;
  oa_id: string;
  login_mode: ZaloLoginMode;
  follow_coupon_id: string | null;
  headline: string;
}

export async function saveZaloConnectAction(input: ZaloConnectInput): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'crm')) {
      return { ok: false, error: 'この設定を変更する権限がありません。' };
    }

    const payload = {
      app_id: input.app_id.trim() || null,
      oa_id: input.oa_id.trim() || null,
      login_mode: input.login_mode,
      follow_coupon_id: input.follow_coupon_id,
      headline: input.headline.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (isDemoMode()) {
      const state = db();
      state.zaloConnectSettings = {
        company_id: session.currentCompanyId,
        ...payload,
      };
    } else {
      const { error } = await supabaseAdmin()
        .from('zalo_connect_settings')
        .upsert({ company_id: session.currentCompanyId, ...payload }, { onConflict: 'company_id' });
      if (error) throw error;
    }

    revalidatePath('/zaloConnect');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '保存できませんでした' };
  }
}
