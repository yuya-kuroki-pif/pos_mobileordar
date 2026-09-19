'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { deleteMasterAction, saveMasterAction } from '@/lib/actions/master';
import type { MasterBoard, MasterRow } from '@/lib/masterQueries';
import type { MasterDef, MasterField } from '@/lib/masters';
import type { Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * 宣言だけで動く、単純なマスター画面（仕様書 §5.15〜§5.17 など）。
 * 列と入力欄は `lib/masters.ts` の定義から組み立てる。
 */
export function MasterTableView({
  def,
  board,
  scopeId,
  shops,
  companyName,
  editable,
}: {
  def: MasterDef;
  board: MasterBoard;
  scopeId: string;
  /** shop スコープのときだけ渡す。店舗セレクタに使う */
  shops?: Shop[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function optionsOf(field: MasterField) {
    return field.optionsFrom ? (board.options[field.optionsFrom] ?? []) : (field.choices ?? []);
  }

  function labelOf(field: MasterField, value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const found = optionsOf(field).find((o) => o.value === value);
    return found?.label ?? String(value);
  }

  function openModal(row: MasterRow | null) {
    setEditingId(row?.id ?? null);
    setOpen(true);

    const values: Record<string, unknown> = {};
    for (const field of def.fields) {
      values[field.key] = row ? row[field.key] : (field.defaultValue ?? undefined);
    }
    form.setFieldsValue(values);
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveMasterAction(def.key, scopeId, editingId ?? '', values);
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
        message.success('保存しました');
        setOpen(false);
        router.refresh();
      });
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteMasterAction(def.key, scopeId, id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  const columns = def.fields
    .filter((field) => !field.formOnly)
    .map((field) => ({
      title: field.label,
      dataIndex: field.key,
      width: field.width,
      align: (field.type === 'number' || field.type === 'money' ? 'right' : undefined) as
        | 'right'
        | undefined,
      render: (value: unknown) => {
        if (field.type === 'switch') {
          return value ? <Tag color="blue">する</Tag> : <Tag>しない</Tag>;
        }
        if (field.type === 'money') {
          return <span className="tabular">¥{yen.format(Number(value ?? 0))}</span>;
        }
        if (field.type === 'select' || field.type === 'enum') {
          return labelOf(field, value) ?? <span style={{ color: '#bfbfbf' }}>未設定</span>;
        }
        if (value === null || value === undefined || value === '') {
          return <span style={{ color: '#bfbfbf' }}>—</span>;
        }
        return String(value);
      },
    }));

  return (
    <>
      <PageHeader
        title={def.title}
        description={def.description}
        breadcrumb={[{ label: companyName }, ...def.breadcrumb.map((label) => ({ label }))]}
        extra={
          <Space>
            {shops && shops.length > 0 && (
              <Select
                value={scopeId}
                style={{ width: 240 }}
                onChange={(value) => router.push(`?shop=${value}`)}
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
        <Table<MasterRow>
          rowKey="id"
          dataSource={board.rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            ...columns,
            {
              title: '',
              key: 'actions',
              width: 100,
              fixed: 'right',
              render: (_: unknown, row: MasterRow) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!editable}
                    onClick={() => openModal(row)}
                  />
                  <Popconfirm
                    title={`この${def.title}を削除しますか？`}
                    onConfirm={() => remove(row.id)}
                    disabled={!editable}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={!editable}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editingId ? `${def.title}を編集` : `${def.title}を新規作成`}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        width={520}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          {def.fields.map((field) => (
            <Form.Item
              key={field.key}
              name={field.key}
              label={field.label}
              extra={field.extra}
              valuePropName={field.type === 'switch' ? 'checked' : undefined}
              rules={
                field.required ? [{ required: true, message: `${field.label}を入力してください` }] : undefined
              }
            >
              {field.type === 'switch' ? (
                <Switch />
              ) : field.type === 'number' || field.type === 'money' ? (
                <InputNumber
                  min={0}
                  prefix={field.type === 'money' ? '¥' : undefined}
                  style={{ width: '100%' }}
                />
              ) : field.type === 'select' || field.type === 'enum' ? (
                <Select
                  allowClear
                  placeholder="未設定"
                  options={optionsOf(field).filter((o) => o.value !== editingId)}
                />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
}
