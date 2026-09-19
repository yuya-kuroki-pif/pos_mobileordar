import { NextResponse } from 'next/server';

import { getStaffSession } from '@/lib/auth';
import { getKdsItems } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** キッチンディスプレイのポーリング用 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await getKdsItems(session.storeId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 }
    );
  }
}
