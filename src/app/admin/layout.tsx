import { StaffNav } from '@/components/StaffNav';
import { requireStore } from '@/lib/auth';

import { AdminNav } from './AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await requireStore();

  return (
    <div className="min-h-screen bg-charcoal-50">
      <StaffNav storeName={store.name} current="admin" />
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
