import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Mascot } from '../../components/brand/Mascot';
import { CategoryIcon } from '../preview/CategoryIcon';
import { Page, Section, EmptyState, Confirmation, ErrorText } from '../preview/ui';
import { usePreviewStore } from '../preview/store';
import { dateLabel, money, refundRemaining } from '../preview/finance';
import { routeValue } from '../preview/params';

export function TransactionDetail() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  const transactions = usePreviewStore((state) => state.transactions);
  const categories = usePreviewStore((state) => state.categories);
  const record = transactions.find((item) => item.id === id);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState('');
  if (!record)
    return (
      <Page title="Entry unavailable" back>
        <EmptyState
          title="This entry is no longer here."
          detail="Check your history or add a new preview entry."
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
          Preview entry · not stored or synced
        </AppText>
      </Card>
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
        detail="This removes the entry from your session preview. No real financial record is affected."
        confirmLabel="Delete entry"
        onCancel={() => setRemove(false)}
        onConfirm={() => {
          setRemove(false);
          try {
            usePreviewStore.getState().deleteTransaction(record.id);
            router.replace('/transactions');
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
    </Page>
  );
}
