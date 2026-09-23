import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getTerminalDeposits } from '@/lib/transactionQueries';

export const dynamic = 'force-dynamic';
export const metadata = { title: '入金履歴一覧' };

const dt = (value: string | null) => (value ? value.slice(0, 16).replace('T', ' ') : '—');

/** 入金履歴一覧（仕様書 §5.24） */
export default async function DepositHistoryPage() {
  const session = await requireSession();
  const deposits = await getTerminalDeposits(session.corporation.id);

  const rows: DataRow[] = deposits.map((deposit) => ({
    key: deposit.id,
    requested_at: dt(deposit.requested_at),
    executed_at: dt(deposit.executed_at),
    bank_account: deposit.bank_account ?? '—',
    cycle_start: deposit.cycle_start ?? '—',
    cycle_end: deposit.cycle_end ?? '—',
    amount: deposit.amount,
    sales: deposit.sales,
    fee: deposit.fee,
    tax: deposit.tax,
    adjustment: deposit.adjustment,
    carryover: deposit.carryover,
    cycle_type: deposit.cycle_type ?? '—',
    status: deposit.status,
    statement_no: deposit.statement_no ?? '—',
  }));

  return (
    <>
      <PageHeader
        title="入金履歴一覧"
        description="決済端末の売上が、いつ・いくら振り込まれたかの一覧です"
        breadcrumb={[
          { label: session.corporation.name },
          { label: '本部機能' },
          { label: 'キャッシュレス決済履歴', href: '/terminalPayment/history' },
          { label: '入金履歴' },
        ]}
      />

      <DataTable
        rows={rows}
        emptyText="入金の履歴がありません"
        columns={[
          { title: '振込申請日', key: 'requested_at', width: 150, fixed: 'left' },
          { title: '振込実行日', key: 'executed_at', width: 150 },
          { title: '入金ステータス', key: 'status', width: 130, format: { type: 'tag' } },
          { title: '口座', key: 'bank_account', width: 200 },
          { title: '起算日', key: 'cycle_start', width: 120 },
          { title: '締め日', key: 'cycle_end', width: 120 },
          { title: '入金額', key: 'amount', width: 140, align: 'right', format: { type: 'money' } },
          { title: '売上', key: 'sales', width: 140, align: 'right', format: { type: 'money' } },
          { title: '手数料', key: 'fee', width: 130, align: 'right', format: { type: 'money' } },
          { title: '消費税', key: 'tax', width: 120, align: 'right', format: { type: 'money' } },
          { title: '調整額', key: 'adjustment', width: 120, align: 'right', format: { type: 'money' } },
          { title: '繰越', key: 'carryover', width: 120, align: 'right', format: { type: 'money' } },
          { title: '入金サイクル', key: 'cycle_type', width: 140 },
          { title: '入金明細書', key: 'statement_no', width: 150 },
        ]}
      />

      <TableNote>
        入金額 = 売上 − 手数料 − 消費税 + 調整額 + 繰越。明細書 PDF の配信は決済会社との接続後に対応します。
      </TableNote>
    </>
  );
}
