'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

/**
 * クチコミへの返信（仕様書 §7.2）。
 *
 * Google ビジネスプロフィール API への接続はまだなので、いまは返信文を
 * こちらに保存するところまで。接続できたら、ここから API に投げる。
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function saveReviewReplyAction(
  reviewId: string,
  reply: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'attract_all')) {
      return { ok: false, error: 'クチコミに返信する権限がありません。' };
    }

    const text = reply.trim();
    const patch = {
      reply_text: text || null,
      replied_at: text ? new Date().toISOString() : null,
    };

    if (isDemoMode()) {
      const review = db().googleReviews.find((r) => r.id === reviewId);
      if (!review) return { ok: false, error: 'クチコミが見つかりません。' };
      // 自分が見られる店舗のものか確かめる
      if (!session.shops.some((shop) => shop.id === review.shop_id)) {
        return { ok: false, error: 'この店舗のクチコミは編集できません。' };
      }
      Object.assign(review, patch);
    } else {
      const shopIds = session.shops.map((shop) => shop.id);
      const { error } = await supabaseAdmin()
        .from('google_reviews')
        .update(patch)
        .eq('id', reviewId)
        .in('shop_id', shopIds);
      if (error) throw error;
    }

    revalidatePath('/attract/review');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '返信を保存できませんでした' };
  }
}
