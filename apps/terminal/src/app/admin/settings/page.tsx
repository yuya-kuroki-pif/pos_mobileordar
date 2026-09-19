import { requireStore } from '@/lib/auth';

import { SettingsForm } from './SettingsForm';

export const metadata = { title: '店舗設定' };

export default async function SettingsPage() {
  const store = await requireStore();
  return <SettingsForm store={store} />;
}
