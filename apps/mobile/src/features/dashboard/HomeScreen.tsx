import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Mascot } from '../../components/brand/Mascot';
import { useTheme } from '../../design/theme';
import { Page, Row, Meter, Section, EmptyState, Resource } from '../preview/ui';
import { currentMonth, monthName, money, totals, goalSaved } from '../preview/finance';
import { usePreviewStore } from '../preview/store';
import { TransactionRow } from '../transactions/TransactionRow';

export function HomeScreen() {
  const { colours } = useTheme();
  const transactions = usePreviewStore((state) => state.transactions);
  const categories = usePreviewStore((state) => state.categories);
  const profile = usePreviewStore((state) => state.profile);
  const budgets = usePreviewStore((state) => state.budgets);
  const goals = usePreviewStore((state) => state.goals);
  const month = currentMonth();
  const summary = totals(transactions, month);
  const budget = budgets[month];
  const remaining = budget ? budget.limitPaise - summary.expenses : null;
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const firstGoal = goals[0];
  const nearLimit = !!budget && summary.expenses >= budget.limitPaise * 0.8;
  return (
    <Page
      title="A little more clarity."
      subtitle={`Hi ${profile?.name.split(' ')[0] ?? 'friend'} · ${monthName(month)}`}
    >
      <Resource>
        <Card style={{ backgroundColor: colours.primary, borderRadius: 32 }}>
          <AppText variant="label" colour="onPrimary">
            {budget ? 'Room in your budget' : 'A plan for your month'}
          </AppText>
          <AppText variant="amount" colour="onPrimary">
            {remaining === null ? 'Your pace.' : money(remaining)}
          </AppText>
          <AppText colour="onPrimary">
            {budget
              ? `${money(summary.expenses)} net spending of ${money(budget.limitPaise)} planned`
              : 'Set a monthly limit to see how much room is left.'}
          </AppText>
          {remaining !== null && remaining < 0 && (
            <AppText colour="onPrimary">
              Above your plan by {money(-remaining)}. Review it when you’re ready.
            </AppText>
          )}
        </Card>
        {budget && (
          <Meter
            label="Monthly spending"
            value={summary.expenses}
            limit={budget.limitPaise}
            detail={`${money(summary.expenses)} after ${money(summary.refunds)} in refunds`}
          />
        )}
        <Row>
          <Card style={{ flexGrow: 1 }}>
            <AppText variant="caption" colour="muted">
              Income
            </AppText>
            <AppText variant="heading" colour="positive">
              {money(summary.income)}
            </AppText>
          </Card>
          <Card style={{ flexGrow: 1 }}>
            <AppText variant="caption" colour="muted">
              Net expenses
            </AppText>
            <AppText variant="heading">{money(summary.expenses)}</AppText>
          </Card>
        </Row>
        <Button
          label="+ Add expense"
          onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })}
        />
        <Row>
          <Button
            label="Add income"
            variant="secondary"
            onPress={() => router.push({ pathname: '/transaction', params: { type: 'income' } })}
          />
          <Button
            label={budget ? 'Manage budget' : 'Set a budget'}
            variant="secondary"
            onPress={() => router.push('/budgets')}
          />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Mascot state={nearLimit ? 'attentive' : 'idle'} />
          <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
            <AppText variant="heading">
              {nearLimit ? 'A moment to check in.' : 'One small win.'}
            </AppText>
            <AppText colour="muted">
              {nearLimit
                ? 'You’re close to your planned limit. Take a look when you’re ready.'
                : 'You made time for your money. That’s a lovely start.'}
            </AppText>
          </View>
        </View>
        <Section title="Recent little details">
          {recent.length ? (
            recent.map((record) => (
              <TransactionRow key={record.id} record={record} categories={categories} />
            ))
          ) : (
            <EmptyState
              title="A little space to begin."
              detail="Add a sample expense or income to see your overview take shape."
              action="Add your first entry"
              onAction={() => router.push('/transaction')}
            />
          )}
          <Button
            label="See all transactions"
            variant="quiet"
            onPress={() => router.push('/transactions')}
          />
        </Section>
        <Section title="What you’re growing">
          {firstGoal ? (
            <Card>
              <AppText variant="heading">{firstGoal.name}</AppText>
              <AppText>
                {money(goalSaved(firstGoal))} of {money(firstGoal.targetPaise)}
              </AppText>
              <Meter
                label="Goal progress"
                value={goalSaved(firstGoal)}
                limit={firstGoal.targetPaise}
              />
              <Button
                label="Visit your goal"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/goal-detail', params: { id: firstGoal.id } })
                }
              />
            </Card>
          ) : (
            <EmptyState
              title="Make room for a wish."
              detail="Start a savings goal for something that matters to you."
              action="Create a goal"
              onAction={() => router.push('/goal')}
            />
          )}
        </Section>
        <Card>
          <AppText variant="heading">The month, at a glance.</AppText>
          <AppText>Income minus net expenses: {money(summary.surplus)}</AppText>
          <AppText>
            Manually tracked towards goals:{' '}
            {money(goals.reduce((sum, goal) => sum + goalSaved(goal), 0))}
          </AppText>
          <AppText variant="caption" colour="muted">
            Budget room, surplus and goal contributions are not verified bank balances.
          </AppText>
          <Button
            label="Explore Insights"
            variant="quiet"
            onPress={() => router.push('/insights')}
          />
        </Card>
      </Resource>
    </Page>
  );
}
