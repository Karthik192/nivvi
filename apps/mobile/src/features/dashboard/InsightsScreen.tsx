import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useTheme } from '../../design/theme';
import { useMotion } from '../../design/useMotion';
import { Page, Row, MonthPicker, Meter, Section, Resource, EmptyState } from '../preview/ui';
import { currentMonth, money, totals, shiftMonth, monthName, today } from '../preview/finance';
import { spendingPeriods, categoryBreakdown, merchantBreakdown } from '../preview/analytics';
import { usePreviewStore } from '../preview/store';

export function InsightsScreen() {
  const transactions = usePreviewStore((state) => state.transactions);
  const categories = usePreviewStore((state) => state.categories);
  const { colours } = useTheme();
  const { reduced } = useMotion();
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const summary = totals(transactions, month);
  const previous = totals(transactions, shiftMonth(month, -1));
  const records = transactions.filter((record) => record.date.startsWith(`${month}-`));
  const periods = spendingPeriods(transactions, month, view);
  const max = Math.max(1, ...periods.map((period) => Math.abs(period.value)));
  const breakdown = categoryBreakdown(transactions, categories, month);
  const merchants = merchantBreakdown(transactions, month).slice(0, 5);
  return (
    <Page title="Find your rhythm." subtitle="A clearer picture, at your pace.">
      <Resource>
        <MonthPicker month={month} onChange={setMonth} />
        <Card>
          <AppText variant="label" colour="muted">
            Net spending
          </AppText>
          <AppText variant="amount">{money(summary.expenses)}</AppText>
          <Meter
            label="Spending as a share of income"
            value={summary.expenses}
            limit={summary.income}
            detail={
              summary.income > 0
                ? `${Math.round((summary.expenses / summary.income) * 100)}% of ${money(summary.income)} income`
                : 'No income recorded for this month.'
            }
          />
          <AppText>Income minus net expenses: {money(summary.surplus)}</AppText>
          <AppText variant="caption" colour="muted">
            Surplus is a cash-flow calculation, not a verified bank balance. Refunds reduce spending
            on their refund date.
          </AppText>
        </Card>
        {records.length === 0 ? (
          <EmptyState
            title="Your patterns start with an entry."
            detail="There are no transactions for this month yet."
            action="Add an entry"
            onAction={() => router.push('/transaction')}
          />
        ) : null}
        <Section title="Spending over time">
          <Row>
            <Button
              label="Weekly view"
              variant={view === 'weekly' ? 'primary' : 'secondary'}
              accessibilityState={{ selected: view === 'weekly' }}
              onPress={() => setView('weekly')}
            />
            <Button
              label="Monthly view"
              variant={view === 'monthly' ? 'primary' : 'secondary'}
              accessibilityState={{ selected: view === 'monthly' }}
              onPress={() => setView('monthly')}
            />
          </Row>
          <Card>
            <Animated.View
              key={`${month}-${view}`}
              entering={reduced ? undefined : FadeIn.duration(260)}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <Svg width="100%" height={150} viewBox="0 0 280 150" accessible={false}>
                {periods.map((period, index) => (
                  <Rect
                    key={period.label}
                    x={index * (280 / periods.length) + 8}
                    y={140 - Math.max(0, period.value / max) * 125}
                    width={Math.max(8, 280 / periods.length - 16)}
                    height={period.value > 0 ? Math.max(2, (period.value / max) * 125) : 0}
                    rx={6}
                    fill={index === periods.length - 1 ? colours.onAccent : colours.primary}
                  />
                ))}
              </Svg>
            </Animated.View>
            <AppText variant="caption" colour="muted">
              {view === 'weekly'
                ? `Monday-start weeks · ${month === currentMonth() ? `entries through ${today()}` : 'selected month'}`
                : 'Net expenses across six months'}
              . Exact values below; negative net spending has no positive bar.
            </AppText>
            {periods.map((period) => (
              <View key={period.label} style={{ gap: 4 }}>
                <AppText variant="caption" colour="muted">
                  {view === 'weekly' ? `Days ${period.label}` : period.label}
                </AppText>
                <AppText variant="label">{money(period.value)}</AppText>
              </View>
            ))}
          </Card>
        </Section>
        <Section title="Where it went">
          {breakdown.map((category) => (
            <Card key={category.id}>
              <AppText variant="heading">{category.name}</AppText>
              <AppText>{money(category.amount)}</AppText>
              <Meter
                label={`${category.name} share`}
                value={category.amount}
                limit={summary.expenses}
              />
            </Card>
          ))}
          {!breakdown.length && (
            <AppText colour="muted">Category patterns appear as you add expenses.</AppText>
          )}
          <Button
            label="Review category budgets"
            variant="quiet"
            onPress={() => router.push('/budgets')}
          />
        </Section>
        <Card>
          <AppText variant="heading">Compared with last month</AppText>
          <AppText>
            {previous.count
              ? `${money(Math.abs(summary.expenses - previous.expenses))} ${summary.expenses <= previous.expenses ? 'less' : 'more'} than ${monthName(shiftMonth(month, -1))}.`
              : 'No previous-month entries to compare yet.'}
          </AppText>
          <AppText colour="muted">
            Current {money(summary.expenses)} · previous {money(previous.expenses)}
          </AppText>
        </Card>
        <Section title="Merchant moments">
          {merchants.map((merchant) => (
            <Card key={merchant.name}>
              <AppText variant="label">{merchant.name}</AppText>
              <AppText>{money(merchant.amount)}</AppText>
            </Card>
          ))}
          {!merchants.length && (
            <AppText colour="muted">Add a merchant to see where your spending happens.</AppText>
          )}
        </Section>
      </Resource>
    </Page>
  );
}
