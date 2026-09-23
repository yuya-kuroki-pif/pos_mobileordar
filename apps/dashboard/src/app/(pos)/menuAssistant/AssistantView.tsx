'use client';

import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Flex, Input, List, Space, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { applyPlanAction, type ApplyLine } from '@/lib/actions/applyPlan';
import { askAssistantAction } from '@/lib/actions/assistant';
import { describeOp, type AgentMessage, type PlannedOp } from '@/lib/agent/types';

const EXAMPLES = [
  'ドリンクカテゴリに「生ビール」を 580 円で追加して',
  'ハイボールの値段を 450 円に変えて',
  '「辛さ」のオプションを作って。普通・中辛・大辛、全部無料で',
  '本店の唐揚げを売切にして',
  '今あるカテゴリを教えて',
];

export function AssistantView({
  companyName,
  editable,
  configured,
}: {
  companyName: string;
  editable: boolean;
  configured: boolean;
}) {
  const [history, setHistory] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<PlannedOp[]>([]);
  const [thinking, setThinking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyLine[] | null>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || thinking) return;

    setThinking(true);
    setError(null);
    setApplied(null);
    // 送った文はすぐ画面に出す。返事待ちの間も会話として見えるように
    setHistory((prev) => [...prev, { role: 'user', text }]);
    setInput('');

    const result = await askAssistantAction(history, text);
    setThinking(false);

    if (!result.ok) {
      setError(result.error ?? '応答を取得できませんでした。');
      // 送れなかった文は履歴から戻す。次の送信で会話がねじれないように
      setHistory(history);
      return;
    }
    setHistory(result.history ?? []);
    setPlan(result.plan ?? []);
  }

  async function apply() {
    setApplying(true);
    setError(null);
    const result = await applyPlanAction(plan);
    setApplying(false);

    if (result.lines) {
      setApplied(result.lines);
      // 成功した行は計画から外す。失敗したものだけ残して直せるようにする
      setPlan(plan.filter((_, index) => !result.lines?.[index]?.ok));
    } else {
      setError(result.error ?? '実行に失敗しました。');
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <PageHeader
        title="メニューアシスタント"
        description="言葉で指示すると、メニューやカテゴリの変更内容を組み立てます。実際に反映されるのは、内容を確認して「実行」を押したときだけです。"
        tags={[companyName]}
      />

      {!configured && (
        <Alert
          type="warning"
          showIcon
          message="AI の接続先が未設定です"
          description="ANTHROPIC_API_KEY を .env.local に設定すると、この画面が使えるようになります。"
        />
      )}

      {!editable && (
        <Alert
          type="info"
          showIcon
          message="閲覧のみの権限です"
          description="変更内容の確認まではできますが、実行はできません。"
        />
      )}

      <Flex gap={16} align="start" wrap>
        <Card
          title="会話"
          style={{ flex: '1 1 460px', minWidth: 360 }}
          styles={{ body: { minHeight: 360, display: 'flex', flexDirection: 'column' } }}
        >
          {history.length === 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">たとえばこんな指示ができます。</Typography.Text>
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  size="small"
                  onClick={() => void send(example)}
                  disabled={!configured || thinking}
                  style={{ textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
                >
                  {example}
                </Button>
              ))}
            </Space>
          ) : (
            <List
              dataSource={history}
              split={false}
              renderItem={(message) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                        style={{ background: message.role === 'user' ? '#1677ff' : '#52c41a' }}
                      />
                    }
                    description={
                      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                        {message.text}
                      </Typography.Paragraph>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {thinking && (
            <Flex gap={8} align="center" style={{ marginTop: 12 }}>
              <Spin size="small" />
              <Typography.Text type="secondary">今のマスターを確認しています…</Typography.Text>
            </Flex>
          )}

          {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}

          <Space.Compact style={{ width: '100%', marginTop: 'auto', paddingTop: 16 }}>
            <Input.TextArea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="例: フードカテゴリに「だし巻き玉子」を 680 円で追加して"
              autoSize={{ minRows: 2, maxRows: 5 }}
              disabled={!configured || thinking}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => void send(input)}
              loading={thinking}
              disabled={!configured || !input.trim()}
            >
              送信
            </Button>
          </Space.Compact>
        </Card>

        <Card
          title="変更の計画"
          style={{ flex: '1 1 380px', minWidth: 320 }}
          extra={plan.length > 0 ? <Tag color="orange">{plan.length} 件</Tag> : null}
        >
          {plan.length === 0 ? (
            <Typography.Text type="secondary">
              まだ変更内容はありません。指示を送ると、ここに「何をどう変えるか」が並びます。
            </Typography.Text>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <List
                size="small"
                bordered
                dataSource={plan}
                renderItem={(op) => <List.Item>{describeOp(op)}</List.Item>}
              />
              <Alert
                type="info"
                showIcon
                message="内容を確かめてから実行してください"
                description="実行するとマスターに反映されます。取り消したいときは、各マスター画面から直してください。"
              />
              <Flex gap={8}>
                <Button
                  type="primary"
                  onClick={() => void apply()}
                  loading={applying}
                  disabled={!editable}
                >
                  実行する
                </Button>
                <Button onClick={() => setPlan([])} disabled={applying}>
                  破棄する
                </Button>
              </Flex>
            </Space>
          )}

          {applied && (
            <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 16 }}>
              <Typography.Text strong>実行結果</Typography.Text>
              {applied.map((line, index) => (
                <Alert
                  key={index}
                  type={line.ok ? 'success' : 'error'}
                  showIcon
                  message={line.description}
                  description={line.error}
                />
              ))}
            </Space>
          )}
        </Card>
      </Flex>
    </Space>
  );
}
