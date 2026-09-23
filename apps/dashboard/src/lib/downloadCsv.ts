/** ブラウザで CSV を保存させる。サーバーで組み立てた文字列をそのまま渡す */
export function downloadCsv(name: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** 配列から CSV 文字列を組み立てる。先頭の BOM は Excel 用 */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '\ufeff' + [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
}
