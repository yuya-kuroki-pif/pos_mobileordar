'use client';

import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Form, Input, List, Modal, Popconfirm, Select, Space, Table, Tag, Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  deleteCustomQuestionAction,
  exportAnswersCsvAction,
  saveCustomQuestionAction,
} from '@/lib/actions/questionnaire';
import { downloadCsv } from '@/lib/downloadCsv';
import {
  MAX_CUSTOM_QUESTIONS,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type QuestionnaireQuestion,
} from '@/lib/types';

const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((value) => ({
  value,
  label: QUESTION_TYPE_LABELS[value],
}));

interface FormValues {
  text: string;
  type: QuestionType;
  options: string;
}

/** カスタムアンケート（仕様書 §5.31） */
export function QuestionnaireView({
  companyName,
  questionnaires,
  currentId,
  questions,
  shops,
  editable,
}: {
  companyName: string;
  questionnaires: { id: string; name: string; kind: string }[];
  currentId?: string;
  questions: QuestionnaireQuestion[];
  shops: { id: string; name: string }[];
  editable: boolean;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<QuestionnaireQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const defaults = questions.filter((q) => !q.is_custom);
  const customs = questions.filter((q) => q.is_custom);

  function openModal(question: QuestionnaireQuestion | null) {
    setEditing(question);
    form.setFieldsValue({
      text: question?.text ?? '',
      type: question?.type ?? 'score',
      options: (question?.options ?? []).join('\n'),
    });
    setOpen(true);
  }

  function submit() {
    if (!currentId) return;
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveCustomQuestionAction({
          id: editing?.id ?? '',
          questionnaire_id: currentId,
          text: values.text,
          type: values.type,
          options: (values.options ?? '').split('\n'),
        });
        if (!result.ok) {
          message.error(result.error ?? '設問を保存できませんでした');
          return;
        }
        message.success('設問を保存しました。');
        setOpen(false);
        router.refresh();
      });
    });
  }

  function remove(question: QuestionnaireQuestion) {
    startTransition(async () => {
      const result = await deleteCustomQuestionAction(question.id);
      if (!result.ok) {
        message.error(result.error ?? '設問を削除できませんでした');
        return;
      }
      message.success('設問を削除しました。');
      router.refresh();
    });
  }

  function exportCsv() {
    startTransition(async () => {
      const result = await exportAnswersCsvAction(shops.map((s) => s.id));
      if (!result.ok || !result.csv || !result.name) {
        message.error(result.error ?? 'CSV を作れませんでした');
        return;
      }
      downloadCsv(result.name, result.csv);
    });
  }

  return (
    <>
      <PageHeader
        title="カスタムアンケート"
        description="お客様に聞く内容を業態ごとに決めます。既定の設問はそのままに、独自の設問を足せます。"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'カスタムアンケート' }]}
        extra={
          <Space>
            <Select
              value={currentId}
              style={{ width: 280 }}
              onChange={(value) => router.push(`/companyQuestionnaireExport?q=${value}`)}
              options={questionnaires.map((row) => ({ value: row.id, label: row.name }))}
            />
            <Button icon={<DownloadOutlined />} onClick={exportCsv} loading={pending}>
              回答をCSV出力
            </Button>
          </Space>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card
          title={`カスタム設問（${customs.length} / ${MAX_CUSTOM_QUESTIONS}）`}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal(null)}
              disabled={!editable || !currentId || customs.length >= MAX_CUSTOM_QUESTIONS}
            >
              設問を追加
            </Button>
          }
        >
          {customs.length === 0 ? (
            <Typography.Text type="secondary">
              カスタム設問はまだありません。既定の設問だけがお客様に表示されます。
            </Typography.Text>
          ) : (
            <List
              dataSource={customs}
              renderItem={(question) => (
                <List.Item
                  actions={
                    editable
                      ? [
                          <Button key="edit" size="small" onClick={() => openModal(question)}>
                            編集
                          </Button>,
                          <Popconfirm
                            key="delete"
                            title="この設問を削除しますか？"
                            description="すでに集まった回答は残ります。"
                            onConfirm={() => remove(question)}
                            okText="削除"
                            cancelText="やめる"
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    title={question.text}
                    description={
                      <Space size={4} wrap>
                        <Tag color="blue">{QUESTION_TYPE_LABELS[question.type]}</Tag>
                        {question.options.map((option) => (
                          <Tag key={option}>{option}</Tag>
                        ))}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card title={`既定の設問（${defaults.length} 問）`}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="既定の設問は編集できません"
            description="他店との比較に使うため、全店共通の内容にしています。"
          />
          <Table
            rowKey="id"
            size="small"
            dataSource={defaults}
            pagination={false}
            columns={[
              { title: '設問', dataIndex: 'text', key: 'text' },
              {
                title: '形式',
                dataIndex: 'type',
                key: 'type',
                width: 140,
                render: (type: QuestionType) => <Tag>{QUESTION_TYPE_LABELS[type]}</Tag>,
              },
              {
                title: '選択肢',
                dataIndex: 'options',
                key: 'options',
                width: 320,
                render: (options: string[]) =>
                  options.length === 0 ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    <Space size={4} wrap>
                      {options.map((option) => (
                        <Tag key={option}>{option}</Tag>
                      ))}
                    </Space>
                  ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={editing ? '設問を編集' : '設問を追加'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={pending}
        okText="保存"
        cancelText="キャンセル"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="text"
            label="設問"
            rules={[{ required: true, message: '設問を入力してください' }]}
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="例: 本日の料理で一番よかったものは？"
            />
          </Form.Item>
          <Form.Item name="type" label="回答の形式">
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.type !== next.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'choice' || getFieldValue('type') === 'multi_choice' ? (
                <Form.Item name="options" label="選択肢（1 行に 1 つ）">
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    placeholder={'焼き鳥\n刺身\nサラダ'}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
