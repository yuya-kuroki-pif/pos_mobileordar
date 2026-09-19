import type { ThemeConfig } from 'antd';

/**
 * 仕様書 §3.2 のカラートークン。
 *
 * 規約（§14）により、見た目の調整は ConfigProvider の token / components で行い、
 * CSS の上書きは最小限にとどめる。
 */
export const HEADER_BG = '#282828';
export const HEADER_TAB_ACTIVE_BG = '#3d3d3d';
export const LAYOUT_BG = '#f5f5f5';

/** KPI カードの増減表示 */
export const TREND_COLOR = {
  up: '#1890ff',
  down: '#f5222d',
  keep: '#8c8c8c',
} as const;

/** チャートの系列色。積み上げ棒は 新規=青 / バイラル=オレンジ / リピーター=緑 */
export const CHART_COLORS = {
  primary: '#1890ff',
  secondary: '#faad14',
  tertiary: '#52c41a',
  quaternary: '#13c2c2',
} as const;

/** 商品分析の ABC ランク */
export const ABC_COLORS = {
  A: { bg: '#fff0f6', text: '#c41d7f' },
  B: { bg: '#f6ffed', text: '#389e0d' },
  C: { bg: '#fafafa', text: '#8c8c8c' },
} as const;

export const FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  '"Noto Sans JP"',
  '"Hiragino Sans"',
  '"Yu Gothic"',
  'Meiryo',
  'sans-serif',
].join(', ');

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorError: '#ff4d4f',
    colorWarning: '#faad14',
    colorTextBase: '#000000',
    colorBorderSecondary: '#f0f0f0',
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    borderRadius: 8,
  },
  components: {
    Layout: {
      headerBg: HEADER_BG,
      headerHeight: 64,
      headerPadding: '0 16px',
      bodyBg: LAYOUT_BG,
      siderBg: '#ffffff',
    },
    Menu: {
      itemBorderRadius: 6,
    },
    Table: {
      headerBg: '#fafafa',
      cellFontSize: 13,
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
};
