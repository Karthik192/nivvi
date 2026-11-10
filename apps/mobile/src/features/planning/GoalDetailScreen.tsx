import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Keyboard, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Mascot } from '../../components/brand/Mascot';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { dateLabel, goalSaved, money, parseAmount, progressPercent } from '../preview/finance';
import type { Goal } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { Confirmation, EmptyState, ErrorText, Meter, Page, Resource, Section } from '../preview/ui';
import { useUnsaved } from '../preview/useUnsaved';

export function GoalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const goal = usePreviewStore((state) => state.goals.find((item) => item.id === id));
  return (
    <Page title={goal?.name ?? 'Your goal'} subtitle="Small steps, at your pace." back>
      <Resource>
        {goal ? (
          <GoalDetail key={goal.id} goal={goal} />
        ) : (
          <EmptyState
            title="Goal unavailable"
            detail="Choose an existing goal or create a new one to begin."
            action="View goals"
            onAction={() => router.replace('/(tabs)/goals')}
          />
        )}
      </Resource>
    </Page>
  );
}

function GoalDetail({ goal }: { goal: Goal }) {
  const { contribute, removeContribution, deleteGoal } = usePreviewStore();
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const submitting = useRef(false);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    // Release only once the cleared draft has rendered; same-frame presses stay blocked.
    if (!amount) submitting.current = false;
  }, [amount]);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState<
    { kind: 'goal' } | { kind: 'contribution'; id: string } | null
  >(null);
  const unsaved = useUnsaved(Boolean(amount));
  const saved = goalSaved(goal);
  const reached = saved >= goal.targetPaise;
  const percent = progressPercent(saved, goal.targetPaise);
  const add = () => {
    if (submitting.current) return;
    submitting.current = true;
    setAmountError('');
    try {
      parseAmount(amount);
      contribute(goal.id, amount);
      setAmount('');
      setAdded(true);
      Keyboard.dismiss();
    } catch (caught) {
      const message = (caught as Error).message;
      setAmountError(message);
      amountRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(`Contribution amount: ${message}`);
      submitting.current = false;
    }
  };
  const remove = () => {
    try {
      if (pending?.kind === 'goal') {
        deleteGoal(goal.id);
        unsaved.allowNavigation();
        router.replace('/(tabs)/goals');
      } else if (pending) removeContribution(goal.id, pending.id);
      setPending(null);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(null);
    }
  };
  return (
    <View style={{ gap: 24 }}>
      <Card>
        {reached && <Mascot state="goal" />}
        <AppText variant="title">{money(saved)}</AppText>
        <Meter
          label="Goal progress"
          value={saved}
          limit={goal.targetPaise}
          detail={`${money(saved)} of ${money(goal.targetPaise)} · ${Math.round(percent)}%`}
        />
        <AppText colour={reached ? 'positive' : 'ink'}>
          {reached
            ? 'You reached your goal. A little, further.'
            : `${money(goal.targetPaise - saved)} to go`}
        </AppText>
        <AppText colour="muted">
          {goal.targetDate
            ? `Target date: ${dateLabel(goal.targetDate)}`
            : 'No deadline. Build at your own pace.'}
        </AppText>
        <Button
          label="Edit goal"
          variant="secondary"
          onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
        />
      </Card>
      <Card>
        <AppText variant="heading">Milestones</AppText>
        {[25, 50, 75, 100].map((milestone) => (
          <AppText key={milestone} colour={percent >= milestone ? 'positive' : 'muted'}>
            {milestone}% · {money(Math.ceil((goal.targetPaise * milestone) / 100))} ·{' '}
            {percent >= milestone ? 'Reached' : 'Ahead'}
          </AppText>
        ))}
      </Card>
      <Card>
        <AppText variant="heading">Add a contribution</AppText>
        <AppText colour="muted">
          Track money you’ve set aside. This does not change your expenses or income, or move money.
        </AppText>
        <Input
          ref={amountRef}
          label="Contribution amount (₹)"
          keyboardType="decimal-pad"
          value={amount}
          error={amountError}
          onChangeText={(value) => {
            submitting.current = false;
            setAmount(value);
            setAmountError('');
            setAdded(false);
          }}
          placeholder="e.g. 1000"
        />
        <Button label="Add contribution" onPress={add} />
        {added && (
          <AppText colour="positive" accessibilityLiveRegion="polite">
            {reached
              ? 'You reached your goal. A little, further.'
              : 'Contribution added to your preview goal.'}{' '}
            No money was moved.
          </AppText>
        )}
      </Card>
      <Section title="Contribution history">
        {goal.contributions.length ? (
          [...goal.contributions].reverse().map((item) => (
            <Card key={item.id}>
              <AppText variant="heading">{money(item.amountPaise)}</AppText>
              <AppText colour="muted">{dateLabel(item.date)}</AppText>
              <Button
                label={`Remove ${money(item.amountPaise)} contribution from ${dateLabel(item.date)}`}
                variant="quiet"
                onPress={() => setPending({ kind: 'contribution', id: item.id })}
              />
            </Card>
          ))
        ) : (
          <EmptyState
            title="Your first step is waiting"
            detail="Add a contribution above when you’ve set some money aside."
          />
        )}
      </Section>
      <ErrorText message={error} />
      <Button
        label="Delete goal"
        variant="destructive"
        onPress={() => setPending({ kind: 'goal' })}
      />
      <Confirmation
        visible={pending !== null}
        title={pending?.kind === 'goal' ? 'Delete this goal?' : 'Remove this contribution?'}
        detail={
          pending?.kind === 'goal'
            ? `This removes “${goal.name}” and all ${goal.contributions.length} contributions from this session. Your transaction ledger is unaffected.`
            : 'This contribution will be removed from the goal total. Your transaction ledger is unaffected.'
        }
        confirmLabel={pending?.kind === 'goal' ? 'Delete goal' : 'Remove contribution'}
        onCancel={() => setPending(null)}
        onConfirm={remove}
      />
      {unsaved.dialog}
    </View>
  );
}
