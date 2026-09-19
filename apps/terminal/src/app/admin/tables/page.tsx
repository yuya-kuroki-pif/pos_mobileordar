import QRCode from 'qrcode';

import { requireStore } from '@/lib/auth';
import { getTables } from '@/lib/queries';

import { TableManager } from './TableManager';

export const metadata = { title: '卓・QR 管理' };

export default async function TablesAdminPage() {
  const store = await requireStore();
  const tables = await getTables(store.id);

  // QR は URL さえ決まれば作れるので、サーバー側で PNG の data URL にしておく。
  // クライアントに QR ライブラリを送らずに済み、印刷もそのまま通る。
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const withQr = await Promise.all(
    tables.map(async (table) => {
      const url = `${baseUrl}/order/${table.qr_token}`;
      return {
        table,
        url,
        qr: await QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: 'M' }),
      };
    })
  );

  return <TableManager tables={withQr} storeName={store.name} />;
}
