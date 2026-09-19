import { NextResponse } from 'next/server';

import { getStaffSession } from '@/lib/auth';
import { getSession, getSessionItems, getSessionTotal } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** 伝票画面のポーリング用。明細・合計・卓の状態をまとめて返す */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaffSession();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const session = await getSession(id);
    // 他店舗の伝票を覗けないようにする
    if (!session || session.store_id !== staff.storeId) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const [items, total] = await Promise.all([getSessionItems(id), getSessionTotal(id)]);
    return NextResponse.json({ session, items, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 }
    );
  }
}
