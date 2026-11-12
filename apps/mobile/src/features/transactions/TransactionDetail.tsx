import { isPreview } from '../../data/runtime';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Mascot } from '../../components/brand/Mascot';
import { CategoryIcon } from '../preview/CategoryIcon';
import { Page, Section, EmptyState, Confirmation, ErrorText } from '../preview/ui';
import { useAppStore } from '../../data/store';
import { dateLabel, money, refundRemaining } from '../preview/finance';
import { routeValue } from '../preview/params';
import { keepLocalChanges, resolveServerVersion, runSync, hydrateOffline } from '../../data/offline/sync';

export function TransactionDetail() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  const transactions = useAppStore((state) => state.transactions);
  const categories = useAppStore((state) => state.categories);
  const record = transactions.find((item) => item.id === id);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState('');
  const owner = useAppStore((state) => state.profile?.id);
  if (!record)
    return (
      <Page title="Entry unavailable" back>
        <EmptyState
          title="This entry is no longer here."
          detail="Check your history or add a new entry."
          action="Open history"
          onAction={() => router.replace('/transactions')}
        />
      </Page>
    );
  const category = categories.find((item) => item.id === record.categoryId);
  const refunds = transactions.filter((item) => item.originalExpenseId === record.id);
  return (
    <Page
      title={record.merchant || category?.name || 'Your entry'}
      subtitle={`${record.type[0]?.toUpperCase()}${record.type.slice(1)} · ${dateLabel(record.date)}`}
      back
    >
      <Card>
        <CategoryIcon name={category?.icon ?? 'other'} />
        <AppText variant="amount">
          {record.type === 'expense' ? '−' : '+'}
          {money(record.amountPaise)}
        </AppText>
        <AppText colour="muted">
          {category?.name} · {record.paymentMethod}
        </AppText>
        {record.description && <AppText>{record.description}</AppText>}
        <Mascot state="saved" />
        <AppText variant="caption" colour="muted">
          {isPreview ? 'Preview entry · not stored or synced' : record.syncStatus === 'conflict' ? 'Your device version is saved. Review the account version before syncing.' : record.syncStatus === 'pending' ? 'Saved on this device · waiting to sync.' : 'Synced to your account.'}
        </AppText>
      </Card>
      {record.syncStatus === 'conflict' && !isPreview && (
        <Section title="Review this change">
          <AppText>Your saved version is kept on this device. Choose which version to keep.</AppText>
          <Button label={record.remoteConflict && !record.remoteConflict.deletedAt ? 'Use account version' : 'Discard this device copy'} variant="secondary" onPress={async()=>{
            try { if(!owner) throw new Error('Account unavailable.'); await resolveServerVersion(owner,record.id); const cache=await hydrateOffline(owner); useAppStore.setState({transactions:cache.transactions,categories:cache.categories}); setError('Account version restored.'); }
            catch(cause){setError((cause as Error).message);}
          }}/>
          {record.remoteConflict && !record.remoteConflict.deletedAt && typeof record.remoteConflict.version === 'number' && <Button label="Keep my changes" onPress={async()=>{
            try { if(!owner) throw new Error('Account unavailable.'); await keepLocalChanges(owner,record.id); const cache=await hydrateOffline(owner); useAppStore.setState({transactions:cache.transactions,categories:cache.categories}); await runSync(owner); const synced=await hydrateOffline(owner); useAppStore.setState({transactions:synced.transactions,categories:synced.categories}); setError(''); }
            catch(cause){setError((cause as Error).message);}
          }}/>}
          {!!record.remoteConflict?.deletedAt && <AppText>The account entry was deleted. To retain these details, create a new entry after reviewing them.</AppText>}
        </Section>
      )}
      <Button
        label="Edit entry"
        onPress={() => router.push({ pathname: '/transaction', params: { id: record.id } })}
      />
      {record.type === 'expense' && refundRemaining(transactions, record.id) > 0 && (
        <Button
          label="Record a refund"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/transaction',
              params: { type: 'refund', originalExpenseId: record.id },
            })
          }
        />
      )}
      {record.type === 'refund' && record.originalExpenseId && (
        <Button
          label="View original expense"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/transaction-detail',
              params: { id: record.originalExpenseId },
            })
          }
        />
      )}
      {refunds.length > 0 && (
        <Section title="Linked refunds">
          {refunds.map((refund) => (
            <Button
              key={refund.id}
              label={`${money(refund.amountPaise)} · ${dateLabel(refund.date)}`}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/transaction-detail', params: { id: refund.id } })
              }
            />
          ))}
          <AppText colour="muted">
            Remove these refunds before deleting their original expense.
          </AppText>
        </Section>
      )}
      <Section title="Entry details">
        <AppText variant="caption" colour="muted">
          ID: {record.id}
        </AppText>
        <AppText variant="caption" colour="muted">
          Created:{' '}
          {new Date(record.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </AppText>
        <AppText variant="caption" colour="muted">
          Updated:{' '}
          {new Date(record.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </AppText>
      </Section>
      <ErrorText message={error} />
      <Button label="Delete entry" variant="destructive" onPress={() => setRemove(true)} />
      <Confirmation
        visible={remove}
        title="Remove this entry?"
        detail={
          isPreview
            ? 'This removes the sample entry.'
            : 'This deletes the entry from your account. This action cannot be undone here.'
        }
        confirmLabel="Delete entry"
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          setRemove(false);
          try {
            await await useAppStore.getState().deleteTransaction(record.id);
            router.replace('/transactions');
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
    </Page>
  );
}
