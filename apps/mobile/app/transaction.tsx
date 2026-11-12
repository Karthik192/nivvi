import { useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '../src/features/transactions/TransactionForm';
import { routeValue } from '../src/features/preview/params';
import { RecordGate } from '../src/data/Gates';
export default function EntryFormRoute() {
  const params = useLocalSearchParams();
  return (
    <RecordGate id={routeValue(params.id) ?? routeValue(params.originalExpenseId)}>
      <TransactionForm
        key={`${routeValue(params.id) ?? 'new'}:${routeValue(params.type) ?? 'expense'}:${routeValue(params.originalExpenseId) ?? ''}`}
      />
    </RecordGate>
  );
}
