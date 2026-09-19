'use client';

import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Space, Table, Tag, Typography, Upload } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  applyMenuCsvAction,
  downloadMenuCsvAction,
  downloadOptionCsvAction,
  previewMenuCsvAction,
  type MenuCsvDiff,
} from '@/lib/actions/menuCsv';

const KIND_TAG: Record<MenuCsvDiff['kind'], { label: string; color?: string }> = {
  create: { label: '新規', color: 'green' },
  update: { label: '更新', color: 'blue' },
  unchanged: { label: '変更なし' },
};

/** メニュー一括編集（仕様書 §5.8）。落として直して戻す */
export function MenuCsvView({
  companyName,
  editable,
}: {
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [diffs, setDiffs] = useState<MenuCsvDiff[] | null>(null);
  const [pending, startTransition] = useTransition();

  function save(csv: string, name: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function download(kind: 'menu' | 'option') {
    startTransition(async () => {
      const result =
        kind === 'menu' ? await downloadMenuCsvAction() : await downloadOptionCsvAction();
      if (!result.ok || !result.csv) {
        message.error(result.error ?? 'ダウンロードできませんでした');
        return;
      }
      save(result.csv, kind === 'menu' ? 'menus.csv' : 'options.csv');
    });
  }

  function preview(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setText(content);
      setFileName(file.name);

      startTransition(async () => {
        const result = await previewMenuCsvAction(content);
        if (!result.ok || !result.diffs) {
          message.error(result.error ?? '読み取れませんでした');
          setDiffs(null);
          return;
        }
        setDiffs(result.diffs);
      });
    };
    reader.readAsText(file, 'utf-8');
  }

  function apply() {
    if (!text) return;
    startTransition(async () => {
      const result = await applyMenuCsvAction(text);
      if (!result.ok) {
        message.error(result.error ?? '反映できませんでした');
        return;
      }
      message.success(`新規 ${result.created ?? 0} 件 / 更新 ${result.updated ?? 0} 件を反映しました`);
      setText(null);
      setDiffs(null);
      setFileName('');
      router.refresh();
    });
  }

  const changed = diffs?.filter((d) => d.kind !== 'unchanged') ?? [];

  return (
    <>
      <PageHeader
        title="メニュー一括編集"
        description="CSV に落として直し、そのまま戻せます"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: '一括編集' }]}
      />

      <Card title="CSV ダウンロード" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<DownloadOutlined />} loading={pending} onClick={() => download('menu')}>
            メニュー
          </Button>
          <Button icon={<DownloadOutlined />} loading={pending} onClick={() => download('option')}>
            オプション
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Excel で開けるよう UTF-8（BOM 付き）で出します。menuId の列は消さないでください。
        </Typography.Paragraph>
      </Card>

      <Card title="CSV アップロード">
        <Upload.Dragger
          accept=".csv"
          maxCount={1}
          disabled={!editable}
          showUploadList={false}
          beforeUpload={(file) => {
            preview(file as unknown as File);
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">CSV をここへドラッグするか、クリックして選びます</p>
          <p className="ant-upload-hint">
            アップロードしただけでは反映されません。内容を確認してから確定します。
          </p>
        </Upload.Dragger>

        {fileName && (
          <Typography.Paragraph style={{ marginTop: 12 }}>
            読み込んだファイル: <Typography.Text code>{fileName}</Typography.Text>
          </Typography.Paragraph>
        )}
      </Card>

      {diffs && (
        <Card title="アップロード内容の確認" style={{ marginTop: 16 }}>
          <Alert
            type={changed.length > 0 ? 'info' : 'success'}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              changed.length > 0
                ? `新規 ${diffs.filter((d) => d.kind === 'create').length} 件 / 更新 ${diffs.filter((d) => d.kind === 'update').length} 件`
                : '変更はありません'
            }
            description={
              changed.length > 0
                ? 'この内容で反映します。削除はこの画面では行いません。'
                : 'CSV の内容といまの登録内容が一致しています。'
            }
          />

          <Table<MenuCsvDiff>
            rowKey={(row) => row.menuId || row.name}
            dataSource={diffs}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            columns={[
              {
                title: '',
                dataIndex: 'kind',
                width: 90,
                render: (value: MenuCsvDiff['kind']) => (
                  <Tag color={KIND_TAG[value].color}>{KIND_TAG[value].label}</Tag>
                ),
              },
              { title: 'メニュー名', dataIndex: 'name', width: 200 },
              {
                title: '変更内容',
                key: 'changes',
                render: (_, row) =>
                  row.changes.length === 0 ? (
                    <span style={{ color: '#bfbfbf' }}>—</span>
                  ) : (
                    <Space direction="vertical" size={2}>
                      {row.changes.map((change) => (
                        <span key={change.column} style={{ fontSize: 12 }}>
                          <Typography.Text code>{change.column}</Typography.Text>{' '}
                          <Typography.Text delete type="secondary">
                            {change.before || '（空）'}
                          </Typography.Text>{' '}
                          → <Typography.Text strong>{change.after || '（空）'}</Typography.Text>
                        </span>
                      ))}
                    </Space>
                  ),
              },
            ]}
          />

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setDiffs(null);
                  setText(null);
                  setFileName('');
                }}
              >
                キャンセル
              </Button>
              <Button
                type="primary"
                loading={pending}
                disabled={!editable || changed.length === 0}
                onClick={apply}
              >
                この内容で反映する
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </>
  );
}
