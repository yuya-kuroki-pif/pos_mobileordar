'use client';

import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Col, DatePicker, Flex, Form, Input, InputNumber, Radio, Row,
  Select, Space, Switch, Tag, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ImageUpload } from '@/components/ImageUpload';
import { PageHeader } from '@/components/PageHeader';
import { PhonePreview } from '@/components/PhonePreview';
import {
  countDeliveryTargetsAction,
  saveDeliveryAction,
  sendTestMessageAction,
  type DeliveryContentInput,
  type DeliveryFilter,
} from '@/lib/actions/messageDelivery';
import {
  CHANNEL_LABELS,
  type DeliveryStatus,
  type DeliveryTarget,
  type MessageDelivery,
  type MessagingAccount,
  type MessagingChannel,
} from '@/lib/types';

const CONTENT_KINDS: { value: DeliveryContentInput['kind']; label: string }[] = [
  { value: 'text', label: 'テキスト' },
  { value: 'image', label: '画像' },
  { value: 'coupon', label: 'クーポン' },
  { value: 'questionnaire', label: 'アンケート' },
];

const emptyContent = (): DeliveryContentInput => ({
  kind: 'text',
  body: '',
  image_url: null,
  link_url: null,
  notify_text: '',
});

/** メッセージ配信の編集（仕様書 §5.29） */
export function DeliveryEditView({
  companyName,
  delivery,
  accounts,
  shops,
  editable,
  messagingReady: messagingReadyMap,
}: {
  companyName: string;
  delivery: MessageDelivery | null;
  accounts: MessagingAccount[];
  shops: { id: string; name: string }[];
  editable: boolean;
  /** チャネルごとのアクセストークンが入っているか */
  messagingReady: Record<MessagingChannel, boolean>;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  const [channel, setChannel] = useState<MessagingChannel>(delivery?.channel ?? 'line');
  const [accountId, setAccountId] = useState<string | null>(delivery?.messaging_account_id ?? null);
  const [znsTemplate, setZnsTemplate] = useState(delivery?.zns_template_id ?? '');
  const [name, setName] = useState(delivery?.name ?? '');
  const [maxCount, setMaxCount] = useState<number | null>(delivery?.max_count ?? null);
  const [targetType, setTargetType] = useState<DeliveryTarget>(delivery?.target_type ?? 'all');
  const [filter, setFilter] = useState<DeliveryFilter>((delivery?.filter as DeliveryFilter) ?? {});
  const [scheduledAt, setScheduledAt] = useState<dayjs.Dayjs | null>(
    delivery?.scheduled_at ? dayjs(delivery.scheduled_at) : null
  );
  const [repeatDaily, setRepeatDaily] = useState(delivery?.repeat_daily ?? false);
  const [contents, setContents] = useState<DeliveryContentInput[]>([emptyContent()]);
  const [targetCount, setTargetCount] = useState<number | null>(delivery?.target_count ?? null);
  const [testRecipient, setTestRecipient] = useState('');

  const channelAccounts = accounts.filter((account) => account.channel === channel);
  const messagingReady = messagingReadyMap[channel];

  function setFilterValue(key: keyof DeliveryFilter, value: unknown) {
    setFilter((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined || value === '' || value === 'all') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function refreshCount() {
    startTransition(async () => {
      const result = await countDeliveryTargetsAction(targetType, filter);
      if (!result.ok) {
        message.error(result.error ?? '対象者数を数えられませんでした');
        return;
      }
      setTargetCount(result.count ?? 0);
    });
  }

  function save(status: DeliveryStatus) {
    startTransition(async () => {
      const result = await saveDeliveryAction({
        id: delivery?.id ?? '',
        channel,
        messaging_account_id: accountId,
        zns_template_id: channel === 'zalo' ? znsTemplate : null,
        name,
        status,
        target_type: targetType,
        filter,
        max_count: maxCount,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        repeat_daily: repeatDaily,
        contents,
      });
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success(status === 'draft' ? '下書きとして保存しました' : '配信を予約しました');
      router.push('/messageDelivery');
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestMessageAction(
        channel,
        testRecipient,
        contents,
        channel === 'zalo' ? znsTemplate : null
      );
      if (!result.ok) {
        message.error(result.error ?? '試し送りできませんでした');
        return;
      }
      message.success('送りました。端末で見え方を確かめてください。');
    });
  }

  function updateContent(index: number, patch: Partial<DeliveryContentInput>) {
    setContents((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <>
      <PageHeader
        title={delivery ? 'メッセージ配信の編集' : 'メッセージ配信の新規作成'}
        backTo="/messageDelivery"
        breadcrumb={[
          { label: companyName },
          { label: 'CRM' },
          { label: 'メッセージ配信', href: '/messageDelivery' },
          { label: delivery ? delivery.name : '新規作成' },
        ]}
        tags={[CHANNEL_LABELS[channel]]}
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="配信の予約までを行います"
        description="LINE / Zalo への実際の送信は、配信サービスとの接続が済んでから動きます。それまでは予約された状態のまま送られません。"
      />

      <Flex gap={16} align="start" wrap>
        <Space direction="vertical" size={16} style={{ flex: '1 1 520px', minWidth: 360 }}>
          <Card title="メッセージ情報">
            <Form layout="vertical">
              <Form.Item label="チャネル" required>
                <Radio.Group
                  optionType="button"
                  value={channel}
                  disabled={!editable}
                  onChange={(event) => {
                    setChannel(event.target.value as MessagingChannel);
                    setAccountId(null);
                  }}
                  options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>

              <Form.Item label="配信アカウント">
                <Select
                  value={accountId}
                  onChange={setAccountId}
                  disabled={!editable}
                  placeholder={
                    channelAccounts.length === 0
                      ? `${CHANNEL_LABELS[channel]} のアカウントが未登録です`
                      : '選んでください'
                  }
                  options={channelAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.name}（今月 ${account.monthly_quota.toLocaleString()} 通まで）`,
                  }))}
                />
              </Form.Item>

              {channel === 'zalo' && (
                <Form.Item
                  label="ZNS テンプレート ID"
                  extra="Zalo は事前に承認されたテンプレートでしか送れません"
                  required
                >
                  <Input
                    value={znsTemplate}
                    onChange={(event) => setZnsTemplate(event.target.value)}
                    placeholder="例: ZNS-238110"
                    disabled={!editable}
                  />
                </Form.Item>
              )}

              <Form.Item label="配信管理名" required extra="お客様には出ません">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例: 週末クーポン配信"
                  disabled={!editable}
                />
              </Form.Item>

              <Form.Item label="配信数上限数" extra="空欄なら上限なし">
                <InputNumber
                  value={maxCount}
                  onChange={(value) => setMaxCount(value)}
                  min={1}
                  style={{ width: '100%' }}
                  disabled={!editable}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card
            title="配信対象"
            extra={
              <Space>
                {targetCount !== null && <Tag color="blue">{targetCount.toLocaleString()} 人</Tag>}
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={refreshCount}
                  loading={pending}
                >
                  対象者数を更新
                </Button>
              </Space>
            }
          >
            <Radio.Group
              optionType="button"
              value={targetType}
              disabled={!editable}
              onChange={(event) => setTargetType(event.target.value as DeliveryTarget)}
              options={[
                { value: 'all', label: 'すべてのお客様' },
                { value: 'filtered', label: '条件絞り込み' },
                { value: 'line_ids', label: 'ID アップロード' },
              ]}
              style={{ marginBottom: 16 }}
            />

            {targetType === 'filtered' && (
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={12}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    来店回数
                  </Typography.Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      placeholder="以上"
                      min={0}
                      value={filter.visitCountFrom ?? null}
                      onChange={(value) => setFilterValue('visitCountFrom', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                    <InputNumber
                      placeholder="以下"
                      min={0}
                      value={filter.visitCountTo ?? null}
                      onChange={(value) => setFilterValue('visitCountTo', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                  </Space.Compact>
                </Col>

                <Col xs={24} sm={12}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    来店からの日数
                  </Typography.Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      placeholder="以上"
                      min={0}
                      value={filter.daysSinceVisitFrom ?? null}
                      onChange={(value) => setFilterValue('daysSinceVisitFrom', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                    <InputNumber
                      placeholder="以内"
                      min={0}
                      value={filter.daysSinceVisitTo ?? null}
                      onChange={(value) => setFilterValue('daysSinceVisitTo', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                  </Space.Compact>
                </Col>

                <Col xs={24} sm={12}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    性別
                  </Typography.Text>
                  <Select
                    value={filter.gender ?? 'all'}
                    onChange={(value) => setFilterValue('gender', value)}
                    disabled={!editable}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'all', label: 'すべて' },
                      { value: 'male', label: '男性' },
                      { value: 'female', label: '女性' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={12}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    年齢
                  </Typography.Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      placeholder="歳から"
                      min={0}
                      value={filter.ageFrom ?? null}
                      onChange={(value) => setFilterValue('ageFrom', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                    <InputNumber
                      placeholder="歳まで"
                      min={0}
                      value={filter.ageTo ?? null}
                      onChange={(value) => setFilterValue('ageTo', value)}
                      disabled={!editable}
                      style={{ width: '50%' }}
                    />
                  </Space.Compact>
                </Col>

                <Col xs={24}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    来店した店舗
                  </Typography.Text>
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="絞り込まない"
                    value={filter.shopIds ?? []}
                    onChange={(value) => setFilterValue('shopIds', value.length > 0 ? value : null)}
                    disabled={!editable}
                    style={{ width: '100%' }}
                    options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
                  />
                </Col>

                <Col xs={24}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    直近この日数以内にメッセージを受け取った人を除く
                  </Typography.Text>
                  <InputNumber
                    min={0}
                    value={filter.excludeRecentDays ?? null}
                    onChange={(value) => setFilterValue('excludeRecentDays', value)}
                    disabled={!editable}
                    style={{ width: '100%' }}
                    addonAfter="日"
                  />
                </Col>
              </Row>
            )}

            {targetType === 'line_ids' && (
              <Alert
                type="info"
                showIcon
                message="ID のアップロードは未対応です"
                description="CSV での ID 指定は、配信サービスとの接続と合わせて対応します。"
              />
            )}
          </Card>

          <Card title="配信日時">
            <Form layout="vertical">
              <Form.Item label="配信する日時">
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY/MM/DD HH:mm"
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  disabled={!editable}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item label="毎日繰り返す">
                <Switch
                  checked={repeatDaily}
                  onChange={setRepeatDaily}
                  disabled={!editable}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card
            title="メッセージ"
            extra={
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setContents([...contents, emptyContent()])}
                disabled={!editable || contents.length >= 5}
              >
                追加する
              </Button>
            }
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {contents.map((content, index) => (
                <Card
                  key={index}
                  size="small"
                  title={`メッセージ ${index + 1}`}
                  extra={
                    contents.length > 1 && (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={!editable}
                        onClick={() => setContents(contents.filter((_, i) => i !== index))}
                      />
                    )
                  }
                >
                  <Radio.Group
                    optionType="button"
                    size="small"
                    value={content.kind}
                    disabled={!editable}
                    onChange={(event) =>
                      updateContent(index, { kind: event.target.value })
                    }
                    options={CONTENT_KINDS}
                    style={{ marginBottom: 12 }}
                  />

                  {content.kind === 'image' ? (
                    <ImageUpload
                      value={content.image_url}
                      onChange={(url) => updateContent(index, { image_url: url })}
                      folder="delivery"
                      width={160}
                      height={160}
                      hint="正方形の画像にしてください"
                      disabled={!editable}
                    />
                  ) : (
                    <Input.TextArea
                      value={content.body}
                      onChange={(event) => updateContent(index, { body: event.target.value })}
                      autoSize={{ minRows: 3, maxRows: 8 }}
                      placeholder={
                        content.kind === 'coupon'
                          ? 'クーポンに添えるひとこと'
                          : content.kind === 'questionnaire'
                            ? 'アンケートのお願い文'
                            : '本文'
                      }
                      disabled={!editable}
                    />
                  )}

                  <Input
                    value={content.link_url ?? ''}
                    onChange={(event) => updateContent(index, { link_url: event.target.value })}
                    placeholder="遷移先 URL（任意）"
                    disabled={!editable}
                    style={{ marginTop: 8 }}
                  />
                  <Input
                    value={content.notify_text}
                    onChange={(event) => updateContent(index, { notify_text: event.target.value })}
                    placeholder="通知テキスト"
                    maxLength={100}
                    showCount
                    disabled={!editable}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              ))}
            </Space>
          </Card>

          <Card title="試し送り">
            {messagingReady ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  一斉配信の前に、自分の ID へ 1 通だけ送って見え方を確かめられます。
                </Typography.Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={testRecipient}
                    onChange={(event) => setTestRecipient(event.target.value)}
                    placeholder={channel === 'line' ? 'LINE のユーザー ID' : 'Zalo の電話番号'}
                    disabled={!editable}
                  />
                  <Button onClick={sendTest} loading={pending} disabled={!editable}>
                    送ってみる
                  </Button>
                </Space.Compact>
              </Space>
            ) : (
              <Alert
                type="info"
                showIcon
                message={`${CHANNEL_LABELS[channel]} のアクセストークンが未設定です`}
                description={
                  channel === 'line'
                    ? 'LINE_CHANNEL_ACCESS_TOKEN を .env.local に設定すると、試し送りができます。'
                    : 'ZALO_OA_ACCESS_TOKEN を .env.local に設定すると、試し送りができます。'
                }
              />
            )}
          </Card>

          <Flex gap={8} justify="flex-end">
            <Button onClick={() => router.push('/messageDelivery')}>キャンセル</Button>
            <Button onClick={() => save('draft')} loading={pending} disabled={!editable}>
              下書き保存
            </Button>
            <Button
              type="primary"
              onClick={() => save('reserved')}
              loading={pending}
              disabled={!editable}
            >
              配信を予約
            </Button>
          </Flex>
        </Space>

        <PhonePreview title={`${CHANNEL_LABELS[channel]} のトーク画面`} sticky>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {contents.map((content, index) => (
              <div
                key={index}
                style={{
                  background: '#f0f0f0',
                  borderRadius: 12,
                  padding: content.kind === 'image' ? 0 : '8px 10px',
                  overflow: 'hidden',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {content.kind === 'image' ? (
                  content.image_url ? (
                    // ストレージの URL と data URL の両方が来るので next/image は使わない
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={content.image_url}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        aspectRatio: '1 / 1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#bfbfbf',
                      }}
                    >
                      画像なし
                    </div>
                  )
                ) : content.kind === 'coupon' ? (
                  <>
                    {content.body || 'クーポンをお送りします'}
                    <div
                      style={{
                        marginTop: 6,
                        background: '#fff',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    >
                      クーポンを見る
                    </div>
                  </>
                ) : content.kind === 'questionnaire' ? (
                  <>
                    {content.body || 'アンケートのお願い'}
                    <div
                      style={{
                        marginTop: 6,
                        background: '#fff',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    >
                      アンケートに答える
                    </div>
                  </>
                ) : (
                  content.body || '本文がここに出ます'
                )}
              </div>
            ))}
          </Space>
        </PhonePreview>
      </Flex>
    </>
  );
}
