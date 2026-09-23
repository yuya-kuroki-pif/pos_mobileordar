import { Space } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { GENDER_LABELS, type CustomerGender } from '@/lib/types';

import { GenderBars, type GenderRow } from './GenderBars';

export const dynamic = 'force-dynamic';
export const metadata = { title: '性別・年代分析' };

const GENDERS: CustomerGender[] = ['male', 'female', 'other', 'unknown'];
const AGES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
/** 性別・年代分析（仕様書 §6.9） */
export default async function DemographicsPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const answers = await getQuestionnaireAnswers(shops.map((s) => s.id));

  // 店舗ごとの性別構成
  const byShop: GenderRow[] = shops.map((shop) => {
    const rows = answers.filter((a) => a.shop_id === shop.id);
    const counts = Object.fromEntries(
      GENDERS.map((gender) => [gender, rows.filter((a) => a.gender === gender).length])
    ) as Record<CustomerGender, number>;
    return { shop_id: shop.id, shop_name: shop.name, total: rows.length, counts };
  });

  // 年代構成（全店舗）
  const ageRows: DataRow[] = AGES.map((age) => {
    const rows = answers.filter((a) => a.age !== null && Math.floor(a.age / 10) * 10 === age);
    return {
      key: String(age),
      age: `${age}代`,
      count: rows.length,
      share: answers.length === 0 ? 0 : Math.round((rows.length / answers.length) * 1000) / 10,
    };
  }).filter((row) => (row.count as number) > 0);

  // 性別 × 年代のクロス表
  const crossRows: DataRow[] = AGES.map((age) => {
    const rows = answers.filter((a) => a.age !== null && Math.floor(a.age / 10) * 10 === age);
    const row: DataRow = { key: `cross-${age}`, age: `${age}代`, total: rows.length };
    for (const gender of GENDERS) {
      row[gender] = rows.filter((a) => a.gender === gender).length;
    }
    return row;
  }).filter((row) => (row.total as number) > 0);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="性別・年代分析"
        description="アンケートに答えたお客様の性別と年代の内訳です"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '性別・年代分析' }]}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <GenderBars rows={byShop} />

        <DataTable
          title="年代構成（全店舗）"
          rows={ageRows}
          emptyText="回答がありません"
          columns={[
            { title: '年代', key: 'age', width: 140 },
            { title: '回答数', key: 'count', width: 120, align: 'right', format: { type: 'number' } },
            { title: '構成比', key: 'share', width: 120, align: 'right', format: { type: 'percent', digits: 1 } },
          ]}
        />

        <DataTable
          title="性別 × 年代"
          rows={crossRows}
          emptyText="回答がありません"
          columns={[
            { title: '年代', key: 'age', width: 120, fixed: 'left' },
            ...GENDERS.map((gender) => ({
              title: GENDER_LABELS[gender],
              key: gender,
              width: 120,
              align: 'right' as const,
              format: { type: 'number' as const },
            })),
            { title: '合計', key: 'total', width: 120, align: 'right', format: { type: 'number' } },
          ]}
        />
      </Space>

      <TableNote>
        数字はアンケートに答えたお客様のぶんだけです。来店したお客様全体の構成とは差があります。
      </TableNote>
    </>
  );
}
