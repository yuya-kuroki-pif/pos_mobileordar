import { LoginForm } from './LoginForm';

export const metadata = { title: 'ログイン' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-charcoal-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">スタッフログイン</h1>
          <p className="mt-2 text-sm text-charcoal-300">
            店舗コードと PIN を入力してください
          </p>
        </div>
        <LoginForm next={next ?? '/pos'} />
      </div>
    </main>
  );
}
