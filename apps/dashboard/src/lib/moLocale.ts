/**
 * モバイルオーダーで選べる言語。
 * QR に載せておけば、お客様は最初からその言語で開ける。
 *
 * クライアントコンポーネントからも使うので、server-only は付けない。
 */
export const MO_LOCALES = [
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
] as const;

export type MoLocale = (typeof MO_LOCALES)[number]['value'];
