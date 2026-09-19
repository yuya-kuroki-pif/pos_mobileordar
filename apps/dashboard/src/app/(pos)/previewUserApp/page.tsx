import { Alert, Card, Space, Typography } from 'antd';
import Image from 'next/image';

import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { qrDataUrl } from '@/lib/tableQueries';

import { ShopPicker } from './ShopPicker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アプリ表示確認' };

/** アプリ表示確認（仕様書 §5.20）。注文できないプレビューモードで開く */
export default async function PreviewUserAppPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const base = process.env.NEXT_PUBLIC_MO_BASE_URL ?? 'http://localhost:3001';
  const url = currentShop ? `${base}/?shopId=${currentShop.id}&preview=1` : '';
  const image = url ? await qrDataUrl(url) : '';

  return (
    <>
      <PageHeader
        title="アプリ表示確認"
        description="お客様に見えるモバイルオーダーの画面を、注文できない状態で確認できます"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: 'アプリ表示確認' }]}
        extra={<ShopPicker shops={shops} shopId={currentShop?.id} />}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="プレビューモードでは注文できません"
        description="実際の卓に紐付かないため、カートに入れても注文は通りません。表示の確認にだけ使ってください。"
      />

      <Card>
        {currentShop ? (
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Image src={image} alt="プレビュー用 QR コード" width={240} height={240} unoptimized />
            <Typography.Text copyable={{ text: url }} type="secondary">
              {url}
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">この業態には店舗がありません。</Typography.Text>
        )}
      </Card>
    </>
  );
}
