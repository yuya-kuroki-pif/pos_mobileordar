'use client';

import type { MoTheme } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * モバイルオーダーのライブプレビュー（仕様書 §5.11）。
 * 端末アプリそのものではなく、配色の確認用に形だけ似せた張りぼて。
 */
export function MoPreview({
  theme,
  screen,
  menus,
}: {
  theme: MoTheme;
  screen: 'menu' | 'checkin';
  menus: { id: string; name: string; price: number }[];
}) {
  const dark = theme === 'dark';
  const bg = dark ? '#1f1f1f' : '#ffffff';
  const fg = dark ? '#f5f5f5' : '#262626';
  const sub = dark ? '#8c8c8c' : '#8c8c8c';
  const line = dark ? '#303030' : '#f0f0f0';
  const chipBg = dark ? '#303030' : '#f5f5f5';

  return (
    <div
      style={{
        width: 320,
        height: 560,
        margin: '0 auto',
        border: '10px solid #282828',
        borderRadius: 28,
        overflow: 'hidden',
        background: bg,
        color: fg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {screen === 'checkin' ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>ご来店ありがとうございます</div>
          <div style={{ fontSize: 12, color: sub }}>人数を選んでご注文を始めてください</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: chipBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: '10px 24px',
              borderRadius: 999,
              background: '#1677ff',
              color: '#fff',
              fontSize: 14,
            }}
          >
            注文をはじめる
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              padding: '12px 8px',
              borderBottom: `1px solid ${line}`,
              fontSize: 10,
              color: sub,
            }}
          >
            {['履歴', '呼出', '会計', '推しエール', '検索'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '10px 12px' }}>
            {['すべて', 'ドリンク', 'フード'].map((chip, index) => (
              <span
                key={chip}
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  background: index === 0 ? '#1677ff' : chipBg,
                  color: index === 0 ? '#fff' : fg,
                }}
              >
                {chip}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: sub }}>残り 88 分</span>
          </div>

          <div style={{ padding: '0 12px 8px', fontSize: 12, fontWeight: 600 }}>
            当店のおすすめ
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px', overflow: 'hidden' }}>
            {menus.slice(0, 3).map((menu) => (
              <div key={menu.id} style={{ width: 92, flexShrink: 0 }}>
                <div style={{ height: 60, borderRadius: 8, background: chipBg }} />
                <div style={{ fontSize: 10, marginTop: 4 }}>{menu.name}</div>
                <div style={{ fontSize: 10, color: sub }}>¥{yen.format(menu.price)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flex: 1, borderTop: `1px solid ${line}` }}>
            <div
              style={{
                width: 72,
                borderRight: `1px solid ${line}`,
                fontSize: 10,
                padding: '8px 0',
              }}
            >
              {['串焼き', '炉端焼き', '一品料理', 'ドリンク'].map((cat, index) => (
                <div
                  key={cat}
                  style={{
                    padding: '8px 6px',
                    background: index === 0 ? chipBg : 'transparent',
                  }}
                >
                  {cat}
                </div>
              ))}
            </div>

            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: 8,
              }}
            >
              {menus.slice(0, 4).map((menu) => (
                <div key={menu.id}>
                  <div style={{ height: 52, borderRadius: 6, background: chipBg }} />
                  <div style={{ fontSize: 10, marginTop: 4 }}>{menu.name}</div>
                  <div style={{ fontSize: 10, color: sub }}>¥{yen.format(menu.price)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
