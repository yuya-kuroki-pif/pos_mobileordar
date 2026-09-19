import { NextResponse } from 'next/server';

import { getOpenSessionForTable, getSessionItems, getSessionTotal, getTableByToken } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * モバイルオーダーの注文履歴ポーリング用。
 * 認可は qr_token の所持のみ（卓の QR を読めた人 = その席の客）。
 * 返すのはその卓の現在の伝票だけなので、他卓の情報は漏れない。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const table = await getTableByToken(token);
    if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const session = await getOpenSessionForTable(table.id);
    if (!session) {
      // 会計が済むとセッションが閉じる。クライアントはこれを見て終了画面に切り替える
      return NextResponse.json({ session: null, items: [], total: null });
    }

    const [items, total] = await Promise.all([
      getSessionItems(session.id),
      getSessionTotal(session.id),
    ]);

    return NextResponse.json({ session, items, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 }
    );
  }
}
