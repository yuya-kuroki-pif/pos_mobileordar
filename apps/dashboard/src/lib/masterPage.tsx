import { requireSession } from '@/lib/auth';
import { MasterTableView } from '@/components/MasterTableView';
import { getMasterBoard } from '@/lib/masterQueries';
import { MASTERS } from '@/lib/masters';
import { canEdit } from '@/lib/permissions';

/**
 * 宣言だけで動くマスター画面の入口。
 * ルートごとの page.tsx はこれを呼ぶだけにする。
 */
export async function renderMasterPage(masterKey: string, shopParam?: string) {
  const def = MASTERS[masterKey];
  if (!def) throw new Error(`未定義のマスターです: ${masterKey}`);

  const session = await requireSession();
  const companyId = session.currentCompanyId;
  const companyName = session.companies.find((c) => c.id === companyId)?.name ?? '業態';

  // shop スコープの画面は、業態配下の店舗から 1 つ選ぶ
  const shops = session.shops.filter((shop) => shop.company_id === companyId);
  const currentShop = shops.find((shop) => shop.id === shopParam) ?? shops[0];
  const scopeId = def.scope === 'company' ? companyId : (currentShop?.id ?? '');

  if (!scopeId) {
    return (
      <MasterTableView
        def={def}
        board={{ rows: [], options: {} }}
        scopeId=""
        shops={[]}
        companyName={companyName}
        editable={false}
      />
    );
  }

  const board = await getMasterBoard(masterKey, scopeId, companyId);

  return (
    <MasterTableView
      def={def}
      board={board}
      scopeId={scopeId}
      shops={def.scope === 'shop' ? shops : undefined}
      companyName={companyName}
      editable={canEdit(session.permissions, def.feature)}
    />
  );
}
