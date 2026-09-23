'use server';

import { randomUUID } from 'node:crypto';

import { requireSession } from '../auth';
import { isDemoMode, supabaseAdmin } from '../supabase';

/**
 * 画像のアップロード（仕様書 §5.3 / §5.30）。
 *
 * 本番は Supabase Storage の public-images バケットへ置き、公開 URL を返す。
 * デモモードはストレージが無いので、小さい画像に限って data URL のまま返す。
 * どちらでも「画像の場所を表す文字列」を返すので、呼び出し側は区別しなくてよい。
 */

const MAX_BYTES = 5 * 1024 * 1024;
/** デモで data URL にして持てる上限。大きいと画面が重くなる */
const DEMO_MAX_BYTES = 400 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface UploadResult {
  ok: boolean;
  error?: string;
  url?: string;
}

export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  try {
    await requireSession();

    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, error: '画像が選ばれていません。' };
    if (!ALLOWED.includes(file.type)) {
      return { ok: false, error: 'PNG / JPEG / WebP / GIF のいずれかにしてください。' };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: '画像は 5MB までにしてください。' };
    }

    const folder = String(formData.get('folder') ?? 'misc').replace(/[^a-zA-Z0-9_-]/g, '');
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isDemoMode()) {
      if (file.size > DEMO_MAX_BYTES) {
        return {
          ok: false,
          error:
            'デモモードでは 400KB までの画像だけ扱えます。Supabase に接続すると 5MB まで置けます。',
        };
      }
      return { ok: true, url: `data:${file.type};base64,${buffer.toString('base64')}` };
    }

    const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
    const path = `${folder || 'misc'}/${randomUUID()}.${extension}`;

    const storage = supabaseAdmin().storage.from('public-images');
    const { error } = await storage.upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    return { ok: true, url: storage.getPublicUrl(path).data.publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '画像をアップロードできませんでした' };
  }
}
