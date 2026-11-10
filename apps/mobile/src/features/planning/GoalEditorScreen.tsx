import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { amountInput } from '../preview/finance';
import type { Goal } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { EmptyState, ErrorText, Page, Resource } from '../preview/ui';
import { useUnsaved } from '../preview/useUnsaved';
import { goalErrors, type FieldErrors } from './forms';

export function GoalEditorScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' && params.id.trim() ? params.id : undefined;
  const goal = usePreviewStore((state) => state.goals.find((item) => item.id === id));
  const invalid = params.id !== undefined && (!id || !goal);
  return (
    <Page
      title={params.id !== undefined ? 'Edit your goal' : 'Something to look forward to'}
      subtitle="Give your next little adventure a name."
      back
    >
      <Resource>
        {invalid ? (
          <EmptyState
            title="Goal unavailable"
            detail="This goal may have been removed. Your other goals are still available."
            action="View goals"
            onAction={() => router.replace('/(tabs)/goals')}
          />
        ) : (
          <GoalForm key={id ?? 'new'} goal={goal} />
        )}
      </Resource>
    </Page>
  );
}

function GoalForm({ goal }: { goal?: Goal }) {
  const saveGoal = usePreviewStore((state) => state.saveGoal);
  const [name, setName] = useState(goal?.name ?? '');
  const [amount, setAmount] = useState(goal ? amountInput(goal.targetPaise) : '');
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState(goal?.id);
  const submitting = useRef(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dateRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dirty =
    !saved &&
    (name !== (goal?.name ?? '') ||
      amount !== (goal ? amountInput(goal.targetPaise) : '') ||
      date !== (goal?.targetDate ?? ''));
  const unsaved = useUnsaved(dirty);
  const edit = (field: string) => {
    submitting.current = false;
    setSaved(false);
    setError('');
    setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const save = () => {
    if (submitting.current) return;
    submitting.current = true;
    const next = goalErrors(name, amount, date.trim());
    setErrors(next);
    setError('');
    const first = (['name', 'amount', 'date'] as const).find((field) => next[field]);
    if (first) {
      const fields = { name: nameRef, amount: amountRef, date: dateRef };
      const labels = { name: 'Goal name', amount: 'Target amount', date: 'Target date' };
      fields[first].current?.focus();
      AccessibilityInfo.announceForAccessibility(`${labels[first]}: ${next[first]}`);
      submitting.current = false;
      return;
    }
    try {
      const id = saveGoal(name, amount, date.trim(), savedId);
      setSaved(true);
      setSavedId(id);
      unsaved.allowNavigation();
      router.replace({ pathname: '/goal-detail', params: { id } });
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      submitting.current = false;
    }
  };
  return (
    <Card>
      <Input
        ref={nameRef}
        label="Goal name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          edit('name');
        }}
        error={errors.name}
        placeholder="e.g. A rainy-day fund"
        autoCapitalize="sentences"
      />
      <Input
        ref={amountRef}
        label="Target amount (₹)"
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          edit('amount');
        }}
        error={errors.amount}
        keyboardType="decimal-pad"
        placeholder="e.g. 50000"
      />
      <Input
        ref={dateRef}
        label="Target date · optional"
        value={date}
        onChangeText={(value) => {
          setDate(value);
          edit('date');
        }}
        error={errors.date}
        placeholder="YYYY-MM-DD"
        hint="Today or a future date. Leave empty for no deadline."
        autoCapitalize="none"
      />
      <AppText colour="muted">
        Contributions stay attached when you edit your goal. These are manually tracked amounts.
      </AppText>
      <ErrorText message={error} />
      <Button label={goal ? 'Save goal changes' : 'Create goal'} onPress={save} />
      {unsaved.dialog}
    </Card>
  );
}
