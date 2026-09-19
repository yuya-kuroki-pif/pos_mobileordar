'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  deletePaymentMethodAction,
  savePaymentMethodAction,
} from '@/lib/actions/payment';
import { PAYMENT_KINDS, type PaymentKind, type PaymentMethod } from '@/lib/types';

const KIND_LABEL = new Map(PAYMENT_KINDS.map((k) => [k.value, k.label]));

/** 支払方法（仕様書 §5.10 / /onSitePaymentDetailType） */
export function PaymentMethodTable({
  methods,
  editable,
}: {
  methods: PaymentMethod[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function openModal(row: PaymentMethod | null) {
    setEditing(row);
    setOpen(true);
    form.setFieldsValue({
      name: row?.name ?? '',
      kind: row?.kind ?? ('credit' as PaymentKind),
      display_order: row?.display_order ?? (methods.length + 1) * 10,
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await savePaymentMethodAction({ id: editing?.id ?? '', ...values });
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
      const result = await deletePaymentMethodAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  return (
    <>
      <Card
        styles={{ body: { padding: 0 } }}
        title="支払方法"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => openModal(null)}
          >
            新規作成
          </Button>
        }
      >
        <Table<PaymentMethod>
          rowKey="id"
          dataSource={methods}
          size="middle"
          pagination={false}
          columns={[
            {
              title: '支払方法',
              dataIndex: 'name',
              render: (value: string, row) => (
                <Space size={4}>
                  {value}
                  {row.is_system && <Tag>既定</Tag>}
                </Space>
              ),
            },
            {
              title: '支払種別',
              dataIndex: 'kind',
              width: 180,
              render: (value: PaymentKind) => <Tag color="blue">{KIND_LABEL.get(value)}</Tag>,
            },
            { title: '表示順', dataIndex: 'display_order', width: 100, align: 'right' },
            {
              title: '',
              key: 'actions',
              width: 100,
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
                    title="この支払方法を削除しますか？"
                    onConfirm={() => remove(row.id)}
                    disabled={!editable || row.is_system}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      // 「現金」「オンライン決済」はシステム既定なので消せない
                      disabled={!editable || row.is_system}
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
        title={editing ? '支払方法を編集' : '支払方法を新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="支払方法名"
            rules={[{ required: true, message: '支払方法名を入力してください' }]}
          >
            <Input placeholder="例: 交通系IC" />
          </Form.Item>

          <Form.Item name="kind" label="支払種別" rules={[{ required: true }]}>
            <Select options={PAYMENT_KINDS} />
          </Form.Item>

          <Form.Item name="display_order" label="表示順" extra="小さいほど先頭">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
