'use client';

import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Input, InputNumber, Modal, Space, Table } from 'antd';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveCompanyAction } from '@/lib/actions/companySettings';
import type { Company } from '@/lib/types';

/** 業態一覧（仕様書 §5.9） */
export function CompanyListView({
  companies,
  corporationName,
  shopCounts,
  editable,
}: {
  companies: Company[];
  corporationName: string;
  shopCounts: Record<string, number>;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState<{ id: string; name: string; order: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return companies.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  }, [companies, keyword]);

  function submit() {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveCompanyAction(draft.id, draft.name, draft.order);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="業態"
        description="法人の下にぶら下がる業態。メニューマスターと支払方法は業態ごとに持ちます"
        breadcrumb={[{ label: corporationName }, { label: '業態管理' }, { label: '業態一覧' }]}
        extra={
          <Space>
            <Button disabled>表示順編集</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!editable}
              onClick={() => setDraft({ id: '', name: '', order: (companies.length + 1) * 10 })}
            >
              新規作成
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="業態名"
            allowClear
            style={{ maxWidth: 240 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <Table<Company>
          rowKey="id"
          dataSource={rows}
          size="middle"
          pagination={false}
          columns={[
            { title: '業態名', dataIndex: 'name' },
            { title: '法人名', key: 'corp', width: 220, render: () => corporationName },
            {
              title: '店舗数',
              key: 'shops',
              width: 100,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">{shopCounts[row.id] ?? 0}</span>
              ),
            },
            { title: '表示順', dataIndex: 'display_order', width: 100, align: 'right' },
            {
              title: '',
              key: 'actions',
              width: 70,
              render: (_, row) => (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!editable}
                  onClick={() =>
                    setDraft({ id: row.id, name: row.name, order: row.display_order })
                  }
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={draft !== null}
        title={draft?.id ? '業態を編集' : '業態を新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setDraft(null)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={draft?.name ?? ''}
            placeholder="例: 炭火焼き"
            onChange={(e) => setDraft((c) => (c ? { ...c, name: e.target.value } : c))}
            onPressEnter={submit}
          />
          <InputNumber
            value={draft?.order ?? 0}
            addonBefore="表示順"
            style={{ width: '100%' }}
            onChange={(value) => setDraft((c) => (c ? { ...c, order: value ?? 0 } : c))}
          />
        </Space>
      </Modal>
    </>
  );
}
