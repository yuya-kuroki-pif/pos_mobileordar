import { NextResponse } from 'next/server';

import { getStaffSession } from '@/lib/auth';
import { getFloorMap } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** POS のフロアマップ用。クライアントから数秒おきに叩かれる */
export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const tables = await getFloorMap(session.storeId);
    return NextResponse.json(tables);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 }
    );
  }
}
