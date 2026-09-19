'use client';

import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  deleteAreaAction,
  deleteTableAction,
  saveAreaAction,
  saveTableAction,
} from '@/lib/actions/table';
import { MO_LOCALES, type MoLocale } from '@/lib/moLocale';
import type { TableBoard } from '@/lib/tableQueries';
import type { Area, RestaurantTable, Shop } from '@/lib/types';

type QrMap = Record<string, Record<string, { url: string; image: string }>>;

/**
 * テーブル（仕様書 §5.19）。
 * エリアごとにテーブルを並べ、卓ごとにモバイルオーダーの QR を出す。
 */
export function TableView({
  shops,
  shopId,
  companyName,
  board,
  qrByTable,
  editable,
}: {
  shops: Shop[];
  shopId?: string;
  companyName: string;
  board: TableBoard;
  qrByTable: QrMap;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [tableForm] = Form.useForm();
  const [areaDraft, setAreaDraft] = useState<{ id: string; name: string; order: number } | null>(null);
  const [tableModal, setTableModal] = useState<{ open: boolean; id: string } | null>(null);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [qrLocale, setQrLocale] = useState<MoLocale>('ja');
  const [pending, startTransition] = useTransition();

  function saveArea() {
    if (!areaDraft || !shopId) return;
    startTransition(async () => {
      const result = await saveAreaAction(shopId, areaDraft.id, areaDraft.name, areaDraft.order);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      setAreaDraft(null);
      router.refresh();
    });
  }

  function removeArea(id: string) {
    if (!shopId) return;
    startTransition(async () => {
      const result = await deleteAreaAction(shopId, id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function openTableModal(row: RestaurantTable | null, areaId?: string) {
    setTableModal({ open: true, id: row?.id ?? '' });
    tableForm.setFieldsValue({
      name: row?.name ?? '',
      area_id: row?.area_id ?? areaId ?? undefined,
      seats: row?.seats ?? 4,
      sort_order: row?.sort_order ?? (board.tables.length + 1) * 10,
      is_active: row?.is_active ?? true,
    });
  }

  function saveTable() {
    if (!shopId) return;
    tableForm.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveTableAction(shopId, {
          id: tableModal?.id ?? '',
          name: values.name,
          area_id: values.area_id ?? null,
          seats: values.seats ?? null,
          sort_order: values.sort_order ?? 0,
          is_active: values.is_active ?? true,
        });
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
        message.success('保存しました');
        setTableModal(null);
        router.refresh();
      });
    });
  }

  function removeTable(id: string) {
    if (!shopId) return;
    startTransition(async () => {
      const result = await deleteTableAction(shopId, id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  /** エリア未設定の卓もまとめて出す */
  const groups: { area: Area | null; tables: RestaurantTable[] }[] = [
    ...board.areas.map((area) => ({
      area,
      tables: board.tables.filter((t) => t.area_id === area.id),
    })),
    { area: null, tables: board.tables.filter((t) => !t.area_id) },
  ].filter((group) => group.area !== null || group.tables.length > 0);

  function downloadQrList() {
    // 卓名と URL の一覧を CSV で落とす。印刷用の台紙は運用側で組む
    const rows = [
      ['エリア', 'テーブル名', ...MO_LOCALES.map((l) => `MO 起動 URL（${l.label}）`)].join(','),
    ];
    for (const group of groups) {
      for (const table of group.tables) {
        rows.push(
          [
            group.area?.name ?? '未設定',
            table.name,
            ...MO_LOCALES.map((l) => qrByTable[table.id]?.[l.value]?.url ?? ''),
          ].join(',')
        );
      }
    }

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'table-qr.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="テーブル"
        description="エリアと卓の構成。卓ごとにモバイルオーダーの QR を発行します"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: 'テーブル' }]}
        extra={
          <Space wrap>
            {shops.length > 0 && (
              <Select
                value={shopId}
                style={{ width: 220 }}
                onChange={(value) => router.push(`/table?shop=${value}`)}
                options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
              />
            )}
            <Button
              icon={<PlusOutlined />}
              disabled={!editable}
              onClick={() => setAreaDraft({ id: '', name: '', order: (board.areas.length + 1) * 10 })}
            >
              エリア新規作成
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!editable || board.areas.length === 0}
              onClick={() => openTableModal(null)}
            >
              テーブル新規作成
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={board.tables.length === 0}
              onClick={downloadQrList}
            >
              QRコードダウンロード
            </Button>
          </Space>
        }
      />

      {groups.length === 0 && (
        <Card>
          <Empty description="エリアがありません" />
        </Card>
      )}

      {groups.map((group) => (
        <Card
          key={group.area?.id ?? 'none'}
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 0 } }}
          title={
            <Space>
              <Typography.Text strong>{group.area?.name ?? 'エリア未設定'}</Typography.Text>
              <Tag>{group.tables.length} 卓</Tag>
            </Space>
          }
          extra={
            group.area && (
              <Space>
                <Button
                  size="small"
                  disabled={!editable}
                  onClick={() => openTableModal(null, group.area!.id)}
                >
                  卓を追加
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!editable}
                  onClick={() =>
                    setAreaDraft({
                      id: group.area!.id,
                      name: group.area!.name,
                      order: group.area!.display_order,
                    })
                  }
                />
                <Popconfirm
                  title="このエリアを削除しますか？"
                  description="配下の卓はエリア未設定に戻ります。"
                  onConfirm={() => removeArea(group.area!.id)}
                  disabled={!editable}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!editable} />
                </Popconfirm>
              </Space>
            )
          }
        >
          <Table<RestaurantTable>
            rowKey="id"
            dataSource={group.tables}
            size="small"
            pagination={false}
            showHeader={false}
            locale={{ emptyText: '卓がありません' }}
            columns={[
              {
                title: 'テーブル名',
                dataIndex: 'name',
                render: (value: string, row) => (
                  <Space size={4}>
                    {value}
                    {!row.is_active && <Tag>停止中</Tag>}
                  </Space>
                ),
              },
              {
                title: '座席数',
                dataIndex: 'seats',
                width: 100,
                align: 'right',
                render: (value: number | null) =>
                  value ? <span className="tabular">{value} 席</span> : '—',
              },
              {
                title: '',
                key: 'actions',
                width: 140,
                align: 'right',
                render: (_, row) => (
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<QrcodeOutlined />}
                      onClick={() => setQrTable(row)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      disabled={!editable}
                      onClick={() => openTableModal(row)}
                    />
                    <Popconfirm
                      title="この卓を削除しますか？"
                      onConfirm={() => removeTable(row.id)}
                      disabled={!editable}
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!editable} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ))}

      <Modal
        open={areaDraft !== null}
        title={areaDraft?.id ? 'エリアを編集' : 'エリアを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={saveArea}
        onCancel={() => setAreaDraft(null)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={areaDraft?.name ?? ''}
            placeholder="例: 1F カウンター"
            onChange={(e) => setAreaDraft((c) => (c ? { ...c, name: e.target.value } : c))}
            onPressEnter={saveArea}
          />
          <InputNumber
            value={areaDraft?.order ?? 0}
            addonBefore="表示順"
            style={{ width: '100%' }}
            onChange={(value) => setAreaDraft((c) => (c ? { ...c, order: value ?? 0 } : c))}
          />
        </Space>
      </Modal>

      <Modal
        open={Boolean(tableModal?.open)}
        title={tableModal?.id ? 'テーブルを編集' : 'テーブルを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={saveTable}
        onCancel={() => setTableModal(null)}
      >
        <Form form={tableForm} layout="vertical">
          <Form.Item
            name="name"
            label="テーブル名"
            rules={[{ required: true, message: 'テーブル名を入力してください' }]}
          >
            <Input placeholder="例: テーブル1" />
          </Form.Item>

          <Form.Item name="area_id" label="エリア">
            <Select
              allowClear
              placeholder="未設定"
              options={board.areas.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>

          <Form.Item name="seats" label="座席数" extra="この卓に座れる人数の上限">
            <InputNumber min={1} suffix="席" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="sort_order" label="表示順">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="is_active" label="利用する" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={qrTable !== null}
        title={`${qrTable?.name ?? ''} の QR コード`}
        footer={null}
        onCancel={() => setQrTable(null)}
      >
        {qrTable && qrByTable[qrTable.id]?.[qrLocale] && (
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Segmented
              value={qrLocale}
              onChange={(value) => setQrLocale(value as MoLocale)}
              options={MO_LOCALES.map((l) => ({ value: l.value, label: l.label }))}
            />
            <Image
              src={qrByTable[qrTable.id][qrLocale].image}
              alt={`${qrTable.name} の QR コード`}
              width={240}
              height={240}
              unoptimized
            />
            <Typography.Text
              copyable={{ text: qrByTable[qrTable.id][qrLocale].url }}
              type="secondary"
            >
              {qrByTable[qrTable.id][qrLocale].url}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              この QR から開くと、最初からその言語で表示されます。お客様は画面上でも切り替えられます。
            </Typography.Text>
          </Space>
        )}
      </Modal>
    </>
  );
}
