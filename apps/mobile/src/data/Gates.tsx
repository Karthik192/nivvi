import { type PropsWithChildren } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isPreview, allPages, type RecordDTO } from './runtime';
import { liveStore, loadGoal } from './store';
import { transaction } from './mapping';
import { Page, Resource } from '../features/preview/ui';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
export function RecordGate({
  id,
  goal = false,
  children,
}: PropsWithChildren<{ id?: string; goal?: boolean }>) {
  const owner = liveStore((s) => s.profile?.id);
  const scenario = liveStore((s) => s.scenario);
  const query = useQuery({
    queryKey: ['account', owner, goal ? 'goal-detail' : 'transaction-detail', id],
    enabled: !isPreview && !!owner && !!id,
    queryFn: async () => {
      if (goal) {
        await loadGoal(id!);
        return [];
      }
      const record = await api.request<RecordDTO>(`/transactions/${id}`);
      const parentId = record.type === 'REFUND' ? String(record.originalExpenseId) : record.id;
      const parent =
        parentId !== id ? await api.request<RecordDTO>(`/transactions/${parentId}`) : record;
      const refunds =
        parent.type === 'EXPENSE'
          ? await allPages<RecordDTO>(`/transactions?originalExpenseId=${parentId}`)
          : [];
      const rows = [
        ...new Map([record, parent, ...refunds].map((r) => [r.id, transaction(r)])).values(),
      ];
      if (liveStore.getState().profile?.id === owner) {
        const ids = new Set(rows.map((r) => r.id));
        liveStore.setState({
          transactions: [
            ...rows,
            ...liveStore
              .getState()
              .transactions.filter((r) => !ids.has(r.id) && r.originalExpenseId !== parentId),
          ],
        });
      }
      return rows;
    },
  });
  const present = liveStore((s) =>
    goal ? s.goals.some((r) => r.id === id) : s.transactions.some((r) => r.id === id),
  );
  if (!isPreview && scenario !== 'ready')
    return (
      <Page title="Your account" back>
        <Resource />
      </Page>
    );
  if (!isPreview && id && (query.isPending || (query.isError && !query.data)))
    return (
      <Page title={query.isError ? 'A little pause.' : 'Loading your entry…'} back>
        {query.error && <AppText colour="danger">{query.error.message}</AppText>}
        {query.isError && <Button label="Try again" onPress={() => void query.refetch()} />}
      </Page>
    );
  // Effects publish the projection before mounting an editor with its initial draft.
  if (!isPreview && id && !present) return <Page title="Loading your entry…" back />;
  return children;
}
