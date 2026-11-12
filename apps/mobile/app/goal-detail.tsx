import { useLocalSearchParams } from 'expo-router';
import { RecordGate } from '../src/data/Gates';
import { GoalDetailScreen } from '../src/features/planning/GoalDetailScreen';
import { routeValue } from '../src/features/preview/params';
export default function Route() {
  const params = useLocalSearchParams();
  return (
    <RecordGate goal id={routeValue(params.id)}>
      <GoalDetailScreen />
    </RecordGate>
  );
}
