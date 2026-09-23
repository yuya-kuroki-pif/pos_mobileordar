'use server';

import { revalidatePath } from 'next/cache';

import { markConnectSkipped } from '@/lib/guestSession';

/** 「このまま注文する」。その食事の間だけ連携画面を出さないようにする */
export async function skipZaloConnect(token: string): Promise<void> {
  await markConnectSkipped(token);
  revalidatePath(`/order/${token}`);
}
