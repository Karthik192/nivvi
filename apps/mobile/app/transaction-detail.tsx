import { useLocalSearchParams } from 'expo-router';
import { RecordGate } from '../src/data/Gates';
import { TransactionDetail } from '../src/features/transactions/TransactionDetail';
import { routeValue } from '../src/features/preview/params';
export default function Route() {
  const params = useLocalSearchParams();
  return (
    <RecordGate id={routeValue(params.id)}>
      <TransactionDetail />
    </RecordGate>
  );
}
