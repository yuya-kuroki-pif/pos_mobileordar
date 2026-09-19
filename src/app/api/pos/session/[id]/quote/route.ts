import { NextResponse } from 'next/server';

import { getStaffSession } from '@/lib/auth';
import { getSession, getSessionTotal } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * 会計画面の金額見積り。
 *
 * 税率別の按分や割引の端数処理を画面側で再実装すると本体とずれるため、
 * 分割の条件を渡して計算結果だけを受け取る。
 *
 * クエリ:
 *   discount   割引額（円）
 *   itemIds    明細指定の分割。カンマ区切り
 *   splitCount 人数割りの分割数
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaffSession();
  if (!staff) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const session = await getSession(id);
    if (!session || session.store_id !== staff.storeId) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const discount = Math.max(0, Number(url.searchParams.get('discount') ?? 0) || 0);
    const rawItems = url.searchParams.get('itemIds');
    const itemIds = rawItems ? rawItems.split(',').filter(Boolean) : null;
    const splitCount = Math.max(1, Number(url.searchParams.get('splitCount') ?? 1) || 1);

    const total = await getSessionTotal(id, discount, true, itemIds);

    // 人数割りの 1 人あたりの金額。端数は 1 人目が負担する
    const share = Math.floor(total.total / splitCount);
    const firstShare = share + (total.total - share * splitCount);

    return NextResponse.json({ total, splitCount, share, firstShare });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 }
    );
  }
}
