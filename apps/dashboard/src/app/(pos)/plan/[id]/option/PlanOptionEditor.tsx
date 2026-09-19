'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Flex,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { savePlanOptionsAction } from '@/lib/actions/plan';
import type { PlanChoice, PlanOption, PlanOptionInput } from '@/lib/types';

/** 保存時にサーバー側で作り直すので、新規行の id は画面内の一時キー */
function tempId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function newChoice(planOptionId: string, order: number): PlanChoice {
  return {
    id: tempId(),
    plan_option_id: planOptionId,
    name: '',
    price: 0,
    is_default: false,
    max_count: null,
    display_order: order,
  };
}

/**
 * オプションタブ（仕様書 §5.4）。
 * プランの価格は選択肢が持つ。飲み放題なら「人数」を個数入力にして、
 * 選択肢「大人 2,500 円 / 小人 2,000 円」を並べる。
 */
export function PlanOptionEditor({
  planId,
  options: initial,
  editable,
}: {
  planId: string;
  options: PlanOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [options, setOptions] = useState<PlanOption[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patchOption(id: string, change: Partial<PlanOption>) {
    setOptions((current) => current.map((o) => (o.id === id ? { ...o, ...change } : o)));
  }

  function patchChoice(optionId: string, choiceId: string, change: Partial<PlanChoice>) {
    setOptions((current) =>
      current.map((o) =>
        o.id === optionId
          ? { ...o, choices: o.choices.map((c) => (c.id === choiceId ? { ...c, ...change } : c)) }
          : o
      )
    );
  }

  function addOption() {
    const id = tempId();
    setOptions((current) => [
      ...current,
      {
        id,
        plan_id: planId,
        name: '',
        input_type: 'count',
        min_kinds: 1,
        max_kinds: 1,
        display_order: (current.length + 1) * 10,
        choices: [newChoice(id, 10)],
      },
    ]);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePlanOptionsAction(planId, options);
      if (!result.ok) {
        setError(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        プランの価格は選択肢が持ちます。「人数」を個数入力にすると、選択した人数ぶんの金額が計上されます。
      </Typography.Paragraph>

      {options.length === 0 && (
        <Card>
          <Empty description="オプションがありません" />
        </Card>
      )}

      {options.map((option, index) => (
        <Card
          key={option.id}
          size="small"
          title={`オプション ${index + 1}`}
          style={{ marginBottom: 16 }}
          extra={
            <Popconfirm
              title="このオプションを削除しますか？"
              onConfirm={() => setOptions((c) => c.filter((o) => o.id !== option.id))}
              disabled={!editable}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!editable} />
            </Popconfirm>
          }
        >
          <Row gutter={16}>
            <Col xs={24} sm={10}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                オプション名
              </Typography.Text>
              <Input
                value={option.name}
                disabled={!editable}
                placeholder="例: 人数"
                onChange={(e) => patchOption(option.id, { name: e.target.value })}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                入力方法
              </Typography.Text>
              <Select<PlanOptionInput>
                value={option.input_type}
                disabled={!editable}
                style={{ width: '100%' }}
                onChange={(value) => patchOption(option.id, { input_type: value })}
                options={[
                  { value: 'count', label: '個数入力' },
                  { value: 'select', label: '選択' },
                ]}
              />
            </Col>
            <Col xs={12} sm={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最小選択数
              </Typography.Text>
              <InputNumber
                min={0}
                value={option.min_kinds}
                disabled={!editable}
                style={{ width: '100%' }}
                onChange={(value) => patchOption(option.id, { min_kinds: value ?? 0 })}
              />
            </Col>
            <Col xs={12} sm={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最大選択数
              </Typography.Text>
              <InputNumber
                min={1}
                value={option.max_kinds}
                disabled={!editable}
                style={{ width: '100%' }}
                onChange={(value) => patchOption(option.id, { max_kinds: value ?? 1 })}
              />
            </Col>
          </Row>

          <Typography.Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
            選択肢
          </Typography.Text>

          {option.choices.map((choice) => (
            <Flex key={choice.id} gap={8} align="center" wrap style={{ marginBottom: 8 }}>
              <Input
                value={choice.name}
                disabled={!editable}
                placeholder="例: 大人"
                style={{ width: 200 }}
                onChange={(e) => patchChoice(option.id, choice.id, { name: e.target.value })}
              />
              <InputNumber
                prefix="¥"
                min={0}
                value={choice.price}
                disabled={!editable}
                style={{ width: 140 }}
                onChange={(value) => patchChoice(option.id, choice.id, { price: value ?? 0 })}
              />
              <InputNumber
                min={1}
                value={choice.max_count ?? undefined}
                disabled={!editable || option.input_type !== 'count'}
                placeholder="上限なし"
                style={{ width: 120 }}
                onChange={(value) =>
                  patchChoice(option.id, choice.id, { max_count: value ?? null })
                }
              />
              <Checkbox
                checked={choice.is_default}
                disabled={!editable}
                onChange={(e) =>
                  patchChoice(option.id, choice.id, { is_default: e.target.checked })
                }
              >
                既定
              </Checkbox>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={!editable || option.choices.length <= 1}
                onClick={() =>
                  patchOption(option.id, {
                    choices: option.choices.filter((c) => c.id !== choice.id),
                  })
                }
              />
            </Flex>
          ))}

          <Button
            size="small"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() =>
              patchOption(option.id, {
                choices: [
                  ...option.choices,
                  newChoice(option.id, (option.choices.length + 1) * 10),
                ],
              })
            }
          >
            選択肢を追加
          </Button>
        </Card>
      ))}

      <Button icon={<PlusOutlined />} disabled={!editable} onClick={addOption}>
        オプションを追加
      </Button>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#f5f5f5',
          padding: '16px 0',
          marginTop: 16,
          textAlign: 'right',
        }}
      >
        <Space>
          <Button onClick={() => router.push('/plan')}>キャンセル</Button>
          <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
            更 新
          </Button>
        </Space>
      </div>
    </div>
  );
}
