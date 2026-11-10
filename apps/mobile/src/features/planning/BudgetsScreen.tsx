import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, View, type TextInput } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Mascot } from '../../components/brand/Mascot';
import {
  amountInput,
  categorySpending,
  currentMonth,
  money,
  monthName,
  totals,
} from '../preview/finance';
import { usePreviewStore } from '../preview/store';
import {
  Chip,
  Confirmation,
  EmptyState,
  ErrorText,
  Meter,
  MonthPicker,
  Page,
  Resource,
  Row,
  Section,
} from '../preview/ui';
import { budgetDraft, type FieldErrors } from './forms';
import { useUnsaved } from '../preview/useUnsaved';

export function BudgetsScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState('');
  const unsaved = useUnsaved(dirty);
  const changeMonth = (next: string) => {
    if (dirty) setPending(next);
    else setMonth(next);
  };
  return (
    <Page title="A plan for your month" subtitle="Give your spending a little direction." back>
      <MonthPicker month={month} onChange={changeMonth} />
      <Resource>
        <MonthBudget key={month} month={month} onDirty={setDirty} onMonth={changeMonth} />
      </Resource>
      <Confirmation
        visible={Boolean(pending)}
        title="Leave this budget draft?"
        detail="Your unsaved edits for this month will be discarded."
        confirmLabel="Discard edits"
        onCancel={() => setPending('')}
        onConfirm={() => {
          setDirty(false);
          setMonth(pending);
          setPending('');
        }}
      />
      {unsaved.dialog}
    </Page>
  );
}

function MonthBudget({
  month,
  onDirty,
  onMonth,
}: {
  month: string;
  onDirty: (dirty: boolean) => void;
  onMonth: (month: string) => void;
}) {
  const { budgets, categories, transactions, saveBudget } = usePreviewStore();
  const budget = budgets[month];
  const [monthly, setMonthly] = useState(() => (budget ? amountInput(budget.limitPaise) : ''));
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(budget?.categoryLimits ?? {}).map(([id, amount]) => [id, amountInput(amount)]),
    ),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const monthlyRef = useRef<ComponentRef<typeof TextInput>>(null);
  const categoryRefs = useRef<Record<string, ComponentRef<typeof TextInput> | null>>({});
  const spent = totals(transactions, month).expenses;
  const edit = (field: string) => {
    submitting.current = false;
    onDirty(true);
    setSaved(false);
    setError('');
    setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const available = categories.filter(
    (category) => category.kind === 'expense' && (!category.archived || category.id in limits),
  );
  const history = Object.values(budgets)
    .filter((item) => item.month < month)
    .sort((a, b) => b.month.localeCompare(a.month));
  const save = () => {
    if (submitting.current) return;
    submitting.current = true;
    const result = budgetDraft(month, monthly, limits);
    setErrors(result.errors);
    setError('');
    const firstCategory = available.find((category) => result.errors[category.id]);
    if (result.errors.monthly || firstCategory) {
      if (result.errors.monthly) {
        monthlyRef.current?.focus();
        AccessibilityInfo.announceForAccessibility(`Monthly limit: ${result.errors.monthly}`);
      } else if (firstCategory) {
        categoryRefs.current[firstCategory.id]?.focus();
        AccessibilityInfo.announceForAccessibility(
          `${firstCategory.name} limit: ${result.errors[firstCategory.id]}`,
        );
      }
      submitting.current = false;
      return;
    }
    // Unknown categories can disappear while a draft is open; never submit an invalid draft.
    if (Object.keys(result.errors).length) {
      const message = Object.values(result.errors).join(' ');
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      submitting.current = false;
      return;
    }
    try {
      saveBudget(result.budget);
      onDirty(false);
      setSaved(true);
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      submitting.current = false;
    }
  };
  return (
    <View style={{ gap: 24 }}>
      {budget ? (
        <Card>
          <AppText variant="heading">Your monthly picture</AppText>
          <Meter
            label="Net spending"
            value={spent}
            limit={budget.limitPaise}
            detail={`${money(spent)} of ${money(budget.limitPaise)}`}
          />
          <AppText colour={spent > budget.limitPaise ? 'warning' : 'ink'}>
            {spent > budget.limitPaise
              ? `${money(spent - budget.limitPaise)} over your plan`
              : `${money(budget.limitPaise - spent)} left in your plan`}
          </AppText>
          {spent >= budget.limitPaise * 0.8 && (
            <>
              <Mascot state="attentive" />
              <AppText>
                {spent >= budget.limitPaise
                  ? 'You have reached your planned limit. Review it when you’re ready.'
                  : 'You’re nearing your planned limit. A good moment to check in.'}
              </AppText>
            </>
          )}
          <AppText variant="caption" colour="muted">
            Spending includes expenses minus refunds for this month. This is a spending plan, not a
            bank balance.
          </AppText>
          {Object.entries(budget.categoryLimits).map(([id, limit]) => (
            <Meter
              key={id}
              label={categories.find((item) => item.id === id)?.name ?? 'Unavailable category'}
              value={categorySpending(transactions, month, id)}
              limit={limit}
              detail={`${money(categorySpending(transactions, month, id))} of ${money(limit)}`}
            />
          ))}
        </Card>
      ) : (
        <EmptyState
          title="A fresh month to plan"
          detail={`Net spending in ${monthName(month)} is ${money(spent)}. Set a limit below to start tracking your plan.`}
        />
      )}
      <Card>
        <AppText variant="heading">{budget ? 'Edit your budget' : 'Set your budget'}</AppText>
        <Input
          ref={monthlyRef}
          label="Monthly limit (₹)"
          keyboardType="decimal-pad"
          value={monthly}
          onChangeText={(value) => {
            setMonthly(value);
            edit('monthly');
          }}
          error={errors.monthly}
          placeholder="e.g. 25000"
        />
        <AppText variant="label">Category limits · optional</AppText>
        <AppText colour="muted">
          Choose categories to plan individually. Leave a category amount empty to remove its limit.
          Combined limits must fit within the monthly limit.
        </AppText>
        {available.length ? (
          <Row>
            {available.map((category) => (
              <Chip
                key={category.id}
                label={`${category.name}${category.archived ? ' (archived)' : ''}`}
                selected={category.id in limits}
                onPress={() => {
                  setLimits((previous) => {
                    const next = { ...previous };
                    if (category.id in next) delete next[category.id];
                    else next[category.id] = '';
                    return next;
                  });
                  edit('monthly');
                }}
              />
            ))}
          </Row>
        ) : (
          <AppText colour="muted">
            No expense categories available. You can still set a monthly limit.
          </AppText>
        )}
        {available
          .filter((category) => category.id in limits)
          .map((category) => (
            <Input
              key={category.id}
              ref={(input) => {
                categoryRefs.current[category.id] = input;
              }}
              label={`${category.name} limit (₹)`}
              keyboardType="decimal-pad"
              value={limits[category.id]}
              error={errors[category.id]}
              onChangeText={(value) => {
                setLimits((previous) => ({ ...previous, [category.id]: value }));
                edit(category.id);
                setErrors((previous) => ({ ...previous, monthly: '' }));
              }}
              placeholder="No category limit"
            />
          ))}
        <ErrorText message={error || Object.values(errors).filter(Boolean).join(' ')} />
        {saved && (
          <AppText colour="positive" accessibilityLiveRegion="polite">
            Budget updated for {monthName(month)} in this session.
          </AppText>
        )}
        <Button label="Save budget" onPress={save} />
      </Card>
      <Section title="Budget history">
        {history.length ? (
          history.map((item) => (
            <Card key={item.month}>
              <AppText variant="heading">{monthName(item.month)}</AppText>
              <Meter
                label="Net spending"
                value={totals(transactions, item.month).expenses}
                limit={item.limitPaise}
                detail={`${money(totals(transactions, item.month).expenses)} of ${money(item.limitPaise)}`}
              />
              <Button
                label={`View ${monthName(item.month)}`}
                variant="secondary"
                onPress={() => onMonth(item.month)}
              />
            </Card>
          ))
        ) : (
          <AppText colour="muted">
            No earlier budgets to show. Saved plans for earlier months will appear here.
          </AppText>
        )}
      </Section>
    </View>
  );
}
