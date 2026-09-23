'use client';

import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Flex, Form, Input, InputNumber, Modal, Radio, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { ImageUpload } from '@/components/ImageUpload';
import { PageHeader } from '@/components/PageHeader';
import { PhonePreview } from '@/components/PhonePreview';
import { saveCouponAction } from '@/lib/actions/crm';
import { COUPON_KIND_LABELS, type Coupon, type CouponKind } from '@/lib/types';

/** クーポン（仕様書 §5.30） */
export function CouponListView({
  coupons,
  companyName,
  editable,
}: {
  coupons: Coupon[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hideExpired, setHideExpired] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // プレビューを動かすため、入力中の値を持っておく
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    if (!hideExpired) return coupons;
    const today = dayjs();
    return coupons.filter((c) => !c.ends_at || dayjs(c.ends_at).isAfter(today));
  }, [coupons, hideExpired]);

  function openModal(row: Coupon | null) {
    setEditingId(row?.id ?? null);
    setOpen(true);
    setImageUrl(row?.image_url ?? null);
    setDraft({
      display_name: row?.display_name ?? '',
      content: row?.content ?? '',
      terms: row?.terms ?? '',
      valid_days: String(row?.valid_days ?? ''),
    });
    form.setFieldsValue({
      kind: row?.kind ?? ('benefit' as CouponKind),
      name: row?.name ?? '',
      display_name: row?.display_name ?? '',
      content: row?.content ?? '',
      description: row?.description ?? '',
      terms: row?.terms ?? '',
      valid_days: row?.valid_days ?? null,
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveCouponAction({
          id: editingId ?? '',
          kind: values.kind,
          name: values.name,
          display_name: values.display_name ?? '',
          content: values.content ?? '',
          description: values.description ?? '',
          terms: values.terms ?? '',
          image_url: imageUrl,
          starts_at: null,
          ends_at: null,
          valid_days: values.valid_days ?? null,
        });
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

  return (
    <>
      <PageHeader
        title="クーポン"
        description="LINE やモバイルオーダーで配るクーポン"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'クーポン' }]}
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
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="景品表示法にご注意ください"
        description="「必ず」「もれなく」などの表現や、実際より良く見せる書き方は避けてください。割引率の上限にも決まりがあります。"
      />

      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Checkbox checked={hideExpired} onChange={(e) => setHideExpired(e.target.checked)}>
            期限切れのクーポンを非表示にする
          </Checkbox>
        </div>

        <Table<Coupon>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: '管理名',
              dataIndex: 'name',
              width: 200,
              fixed: 'left',
              render: (value: string, row) => (
                <a onClick={() => openModal(row)}>{value}</a>
              ),
            },
            {
              title: '種類',
              dataIndex: 'kind',
              width: 150,
              render: (value: CouponKind) => <Tag color="blue">{COUPON_KIND_LABELS[value]}</Tag>,
            },
            { title: '表示名', dataIndex: 'display_name', width: 200 },
            { title: 'クーポン内容', dataIndex: 'content' },
            {
              title: 'クーポン期間',
              key: 'period',
              width: 220,
              render: (_, row) =>
                row.starts_at || row.ends_at ? (
                  <span className="tabular">
                    {row.starts_at ? dayjs(row.starts_at).format('YYYY/MM/DD') : '—'} 〜{' '}
                    {row.ends_at ? dayjs(row.ends_at).format('YYYY/MM/DD') : '無期限'}
                  </span>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>指定なし</span>
                ),
            },
            {
              title: '使用可能日数',
              dataIndex: 'valid_days',
              width: 130,
              align: 'right',
              render: (value: number | null) =>
                value ? (
                  <span className="tabular">{value} 日</span>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>指定なし</span>
                ),
            },
            {
              title: '',
              key: 'actions',
              width: 70,
              fixed: 'right',
              render: (_, row) => (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!editable}
                  onClick={() => openModal(row)}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        width={860}
        title={editingId ? 'クーポンを編集' : 'クーポンを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Flex gap={24} align="start" wrap>
        <Form
          form={form}
          layout="vertical"
          style={{ flex: '1 1 380px', minWidth: 320 }}
          onValuesChange={(_, all) =>
            setDraft({
              display_name: all.display_name ?? '',
              content: all.content ?? '',
              terms: all.terms ?? '',
              valid_days: String(all.valid_days ?? ''),
            })
          }
        >
          <Form.Item name="kind" label="クーポンの種類">
            <Radio.Group
              options={(Object.keys(COUPON_KIND_LABELS) as CouponKind[]).map((kind) => ({
                value: kind,
                label: COUPON_KIND_LABELS[kind],
              }))}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="クーポン管理名"
            extra="お客様には出ません。社内で分かる名前にします"
            rules={[{ required: true, message: 'クーポン管理名を入力してください' }]}
          >
            <Input placeholder="例: 初回来店ドリンク1杯" />
          </Form.Item>

          <Form.Item name="display_name" label="クーポン表示名" extra="お客様の画面に出ます">
            <Input placeholder="例: ドリンク1杯サービス" />
          </Form.Item>

          <Form.Item name="content" label="クーポン内容">
            <Input placeholder="例: お好きなドリンクを1杯サービスします" />
          </Form.Item>

          <Form.Item name="description" label="説明文">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="terms" label="利用規約">
            <Input.TextArea rows={2} placeholder="例: 他のクーポンとの併用はできません。" />
          </Form.Item>

          <Form.Item
            name="valid_days"
            label="配布日からの使用可能日数"
            extra="空欄なら期限なし"
          >
            <InputNumber min={1} suffix="日" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="画像">
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              folder="coupon"
              width={216}
              height={144}
              hint="推奨 600×400（3:2）。5MB まで"
              disabled={!editable}
            />
          </Form.Item>
        </Form>

        <PhonePreview title="お客様の画面" sticky>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {imageUrl ? (
              // ストレージの URL と data URL の両方が来るので next/image は使わない
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3 / 2',
                  background: '#f5f5f5',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bfbfbf',
                  fontSize: 12,
                }}
              >
                画像なし
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {draft.display_name || 'クーポン表示名'}
            </div>
            <div style={{ fontSize: 12, color: '#595959' }}>
              {draft.content || 'クーポン内容がここに出ます'}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {draft.valid_days ? `配布から ${draft.valid_days} 日間有効` : '期限なし'}
            </div>
            {draft.terms && (
              <div style={{ fontSize: 10, color: '#8c8c8c', whiteSpace: 'pre-wrap' }}>
                {draft.terms}
              </div>
            )}
            <div
              style={{
                marginTop: 8,
                background: '#1677ff',
                color: '#fff',
                textAlign: 'center',
                borderRadius: 6,
                padding: '8px 0',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              クーポンを使う
            </div>
          </Space>
        </PhonePreview>
        </Flex>
      </Modal>
    </>
  );
}
