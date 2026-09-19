'use client';

import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Checkbox,
  Flex,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { TimeMinInput } from '@/components/TimeMinInput';
import {
  deleteOrderableTimeAction,
  saveOrderableTimeAction,
  setShopOrderableTimeAction,
} from '@/lib/actions/orderableTime';
import type { OrderableTimeBoard } from '@/lib/orderableTimeQueries';
import { minToLabel } from '@/lib/time';
import { DAY_LABELS, type OrderableTime, type Shop } from '@/lib/types';

/** 編集中の 1 曜日ぶん。enabled が false なら「表示しない」 */
type DayDraft = { enabled: boolean; start: number; end: number };

function emptyDays(): DayDraft[] {
  return DAY_LABELS.map(() => ({ enabled: false, start: 9 * 60, end: 22 * 60 }));
}

/** アプリ表示時間設定（仕様書 §5.14） */
export function OrderableTimeView({
  board,
  shops,
  shopId,
  companyName,
  editable,
}: {
  board: OrderableTimeBoard;
  shops: Shop[];
  shopId?: string;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [days, setDays] = useState<DayDraft[]>(emptyDays);
  const [open, setOpen] = useState(false);
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [pending, startTransition] = useTransition();

  const assigned = new Set(
    board.shopLinks.filter((l) => l.shop_id === shopId).map((l) => l.orderable_time_id)
  );

  const rows = board.times.filter((time) => !onlyAssigned || assigned.has(time.id));

  function openModal(time: OrderableTime | null) {
    setEditingId(time?.id ?? null);
    setName(time?.name ?? '');

    const next = emptyDays();
    if (time) {
      for (const slot of board.slots.filter((s) => s.orderable_time_id === time.id)) {
        next[slot.day_of_week] = { enabled: true, start: slot.start_min, end: slot.end_min };
      }
    }
    setDays(next);
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const result = await saveOrderableTimeAction({
        id: editingId ?? '',
        name,
        slots: days
          .map((day, index) => ({ day, index }))
          .filter(({ day }) => day.enabled)
          .map(({ day, index }) => ({
            day_of_week: index,
            start_min: day.start,
            end_min: day.end,
          })),
      });
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteOrderableTimeAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function toggleAssign(timeId: string, value: boolean) {
    if (!shopId) return;
    startTransition(async () => {
      const result = await setShopOrderableTimeAction(shopId, timeId, value);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  function slotSummary(timeId: string) {
    const slots = board.slots.filter((s) => s.orderable_time_id === timeId);
    if (slots.length === 0) return null;

    return slots
      .slice()
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map(
        (slot) =>
          `${DAY_LABELS[slot.day_of_week]}: ${minToLabel(slot.start_min)} ~ ${minToLabel(slot.end_min)}`
      );
  }

  return (
    <>
      <PageHeader
        title="アプリ表示時間設定"
        description="曜日ごとに、モバイルオーダーで注文を受け付ける時間帯を決めます"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: 'アプリ表示時間設定' }]}
        extra={
          <Space>
            {shops.length > 0 && (
              <Select
                value={shopId}
                style={{ width: 220 }}
                onChange={(value) => router.push(`/orderableTime/shop?shop=${value}`)}
                options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
              />
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!editable}
              onClick={() => openModal(null)}
            >
              新規作成
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Checkbox checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)}>
            設定済みのみ表示
          </Checkbox>
        </div>

        <Table<OrderableTime>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '名前', dataIndex: 'name', width: 180, fixed: 'left' },
            {
              title: 'アプリ表示時間ID',
              dataIndex: 'id',
              width: 240,
              render: (value: string) => (
                <Typography.Text
                  copyable={{ text: value, icon: <CopyOutlined /> }}
                  style={{ fontSize: 12 }}
                  type="secondary"
                >
                  {value}
                </Typography.Text>
              ),
            },
            {
              title: 'アプリ表示時間',
              key: 'slots',
              render: (_, row) => {
                const summary = slotSummary(row.id);
                if (!summary) return <Tag>表示しない</Tag>;
                return (
                  <Space direction="vertical" size={0}>
                    {summary.map((line) => (
                      <span key={line} style={{ fontSize: 12 }}>
                        {line}
                      </span>
                    ))}
                  </Space>
                );
              },
            },
            {
              title: 'この店舗で使う',
              key: 'assigned',
              width: 140,
              render: (_, row) => (
                <Switch
                  checked={assigned.has(row.id)}
                  disabled={!editable || !shopId}
                  onChange={(checked) => toggleAssign(row.id, checked)}
                />
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 100,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!editable}
                    onClick={() => openModal(row)}
                  />
                  <Popconfirm
                    title="この設定を削除しますか？"
                    onConfirm={() => remove(row.id)}
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

      <Modal
        open={open}
        width={560}
        title={editingId ? 'アプリ表示時間を編集' : 'アプリ表示時間を新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Input
          value={name}
          placeholder="例: ディナー営業"
          style={{ marginBottom: 16 }}
          onChange={(e) => setName(e.target.value)}
        />

        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          チェックを外した曜日は、その日はモバイルオーダーに出ません。
          24 時を超える場合は 28:00 のように書きます。
        </Typography.Paragraph>

        {DAY_LABELS.map((label, index) => (
          <Flex key={label} gap={8} align="center" style={{ marginBottom: 8 }}>
            <Checkbox
              checked={days[index].enabled}
              style={{ width: 100 }}
              onChange={(e) =>
                setDays((current) =>
                  current.map((d, i) => (i === index ? { ...d, enabled: e.target.checked } : d))
                )
              }
            >
              {label}
            </Checkbox>
            <div style={{ width: 110 }}>
              <TimeMinInput
                value={days[index].start}
                disabled={!days[index].enabled}
                onChange={(value) =>
                  setDays((current) =>
                    current.map((d, i) => (i === index ? { ...d, start: value ?? 0 } : d))
                  )
                }
              />
            </div>
            <span style={{ color: '#8c8c8c' }}>〜</span>
            <div style={{ width: 110 }}>
              <TimeMinInput
                value={days[index].end}
                disabled={!days[index].enabled}
                placeholder="28:00"
                onChange={(value) =>
                  setDays((current) =>
                    current.map((d, i) => (i === index ? { ...d, end: value ?? 0 } : d))
                  )
                }
              />
            </div>
          </Flex>
        ))}
      </Modal>
    </>
  );
}
