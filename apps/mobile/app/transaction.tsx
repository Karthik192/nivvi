import { useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '../src/features/transactions/TransactionForm';
import { routeValue } from '../src/features/preview/params';
export default function EntryFormRoute() {
  const params = useLocalSearchParams();
  return (
    <TransactionForm
      key={`${routeValue(params.id) ?? 'new'}:${routeValue(params.type) ?? 'expense'}:${routeValue(params.originalExpenseId) ?? ''}`}
    />
  );
}
