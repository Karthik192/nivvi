import { useLocalSearchParams } from 'expo-router';
import { RecordGate } from '../src/data/Gates';
import { GoalEditorScreen } from '../src/features/planning/GoalEditorScreen';
import { routeValue } from '../src/features/preview/params';
export default function Route() {
  const params = useLocalSearchParams();
  return (
    <RecordGate goal id={routeValue(params.id)}>
      <GoalEditorScreen />
    </RecordGate>
  );
}
