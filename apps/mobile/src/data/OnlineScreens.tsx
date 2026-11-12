import { useEffect, useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { api, session, type RecordDTO } from './runtime';
import { liveStore } from './store';
import { exactMoney as money, transaction, methods } from './mapping';
import type { DashboardDTO, TotalsDTO } from './reports';
import { currentMonth, shiftMonth, monthName, exactTotals as localTotals } from '../features/preview/finance';
import { paymentMethods, type TransactionType } from '../features/preview/model';
import {
  Page,
  PageHeader,
  Row,
  Meter,
  MonthPicker,
  EmptyState,
  Chip,
  Section,
} from '../features/preview/ui';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { Mascot } from '../components/brand/Mascot';
import { useTheme } from '../design/theme';
import { TransactionRow } from '../features/transactions/TransactionRow';
const queryString = (values: Record<string, string>) => new URLSearchParams(values).toString();
function Feedback({
  error,
  loading,
  retry,
}: {
  error: Error | null;
  loading: boolean;
  retry: () => unknown;
}) {
  return (
    <Card>
      {loading ? (
        <AppText accessibilityLiveRegion="polite">Loading your records…</AppText>
      ) : (
        <>
          <AppText colour="danger" accessibilityRole="alert">
            {error?.message ?? 'Please try again.'}
          </AppText>
          <Button label="Try again" onPress={() => void retry()} />
          <Button
            label="Sign in again"
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        </>
      )}
    </Card>
  );
}
export function OnlineHome() {
  const owner = liveStore((s) => s.profile?.id);
  const name = liveStore((s) => s.profile?.name);
  const categories = liveStore((s) => s.categories);
  const records = liveStore((s) => s.transactions);
  const offline = session((s) => s.offline);
  const { colours } = useTheme();
  const month = currentMonth();
  const query = useQuery({
    queryKey: ['account', owner, 'dashboard', month],
    enabled: !offline,
    queryFn: () => api.request<DashboardDTO>(`/dashboard?month=${month}`),
  });
  const data = query.data;
  useEffect(() => {
    if (data && liveStore.getState().profile?.id === owner) {
      const recent = data.recentRecords.map(transaction);
      const ids = new Set(recent.map((r) => r.id));
      liveStore.setState({
        transactions: [
          ...recent,
          ...liveStore.getState().transactions.filter((r) => !ids.has(r.id)),
        ],
      });
    }
  }, [data, owner]);
  if (offline) {
    const summary = localTotals(records, month);
    return (
      <Page title="A little more clarity." subtitle={`Hi ${name?.split(' ')[0] ?? 'friend'} · ${monthName(month)}`}>
        <Card><AppText variant="label">Saved on this device</AppText><AppText variant="caption">Other devices and account updates will appear after sync.</AppText></Card>
        <Row>
          <Card><AppText colour="muted">Income</AppText><AppText variant="heading" colour="positive">{money(String(summary.income))}</AppText></Card>
          <Card><AppText colour="muted">Net expenses</AppText><AppText variant="heading">{money(String(summary.expenses))}</AppText></Card>
        </Row>
        <Button label="+ Add expense" onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })} />
        <Button label="Add income" variant="secondary" onPress={() => router.push({ pathname: '/transaction', params: { type: 'income' } })} />
        <Section title="Recent entries">
          {records.slice(0, 5).map((record) => <TransactionRow key={record.id} record={record} categories={categories} />)}
          <Button label="See all transactions" variant="quiet" onPress={() => router.push('/transactions')} />
        </Section>
      </Page>
    );
  }
  return (
    <Page
      title="A little more clarity."
      subtitle={`Hi ${name?.split(' ')[0] ?? 'friend'} · ${monthName(month)}`}
    >
      {!data ? (
        <Feedback error={query.error} loading={query.isPending} retry={query.refetch} />
      ) : (
        <>
          {query.error && <Feedback error={query.error} loading={false} retry={query.refetch} />}
          <Card style={{ backgroundColor: colours.primary, borderRadius: 32 }}>
            <AppText variant="label" colour="onPrimary">
              {data.budget ? 'Room in your budget' : 'A plan for your month'}
            </AppText>
            <AppText variant="amount" colour="onPrimary">
              {data.budget ? money(data.budget.availableMinor) : 'Your pace.'}
            </AppText>
            <AppText colour="onPrimary">
              {data.budget
                ? `${money(data.totals.netExpense)} net spending of ${money(data.budget.limitMinor)} planned`
                : 'Set a monthly limit to see how much room is left.'}
            </AppText>
          </Card>
          {data.budget && (
            <Meter
              label="Monthly spending"
              value={Number(data.totals.netExpense)}
              limit={Number(data.budget.limitMinor)}
            />
          )}
          <Row>
            <Card>
              <AppText colour="muted">Income</AppText>
              <AppText variant="heading" colour="positive">
                {money(data.totals.income)}
              </AppText>
            </Card>
            <Card>
              <AppText colour="muted">Net expenses</AppText>
              <AppText variant="heading">{money(data.totals.netExpense)}</AppText>
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
              label="Manage budget"
              variant="secondary"
              onPress={() => router.push('/budgets')}
            />
          </Row>
          <Row>
            <Mascot state={data.alerts.length ? 'attentive' : 'idle'} />
            <View style={{ flex: 1, minWidth: 140 }}>
              <AppText variant="heading">
                {data.alerts.length ? 'A moment to check in.' : 'One small win.'}
              </AppText>
              <AppText>Your money, at your pace. Every entry brings a little clarity.</AppText>
            </View>
          </Row>
          {data.alerts.map((a, i) => (
            <Card key={i}>
              <AppText colour="warning">
                {a.scope === 'MONTH'
                  ? 'Monthly budget'
                  : (categories.find((c) => c.id === a.categoryId)?.name ?? 'Category')}
                : {a.level === 'OVER_LIMIT' ? 'above your plan' : 'approaching your limit'}.
              </AppText>
              <AppText>
                {money(a.netExpense)} of {money(a.limitMinor)}
              </AppText>
            </Card>
          ))}
          <Section title="Recent little details">
            {data.recentRecords.length ? (
              data.recentRecords.map((r) => (
                <TransactionRow key={r.id} record={transaction(r)} categories={categories} />
              ))
            ) : (
              <EmptyState
                title="A little space to begin."
                detail="Add your first expense or income."
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
          <Card>
            <AppText variant="heading">What you’re growing</AppText>
            <AppText>Manually tracked towards goals: {money(data.goals.contributedMinor)}</AppText>
            <Button
              label="Visit your goals"
              variant="secondary"
              onPress={() => router.push('/goals')}
            />
          </Card>
          <Card>
            <AppText variant="heading">The month, at a glance.</AppText>
            <AppText>Income minus net expenses: {money(data.totals.surplus)}</AppText>
            <AppText variant="caption" colour="muted">
              Budget room, surplus and contributions are not bank balances.
            </AppText>
            <Button
              label="Explore Insights"
              variant="quiet"
              onPress={() => router.push('/insights')}
            />
          </Card>
          <AppText variant="caption" colour="muted">
            Last loaded {new Date(data.freshness.generatedAt).toLocaleTimeString('en-IN')}. Online
            saving requires a connection.
          </AppText>
          <Button label="Refresh overview" variant="quiet" onPress={() => void query.refetch()} />
        </>
      )}
    </Page>
  );
}
export function OnlineHistory() {
  const owner = liveStore((s) => s.profile?.id);
  const categories = liveStore((s) => s.categories);
  const localRecords = liveStore((s) => s.transactions);
  const offline = session((s) => s.offline);
  const [month, setMonth] = useState(currentMonth);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [categoryId, setCategory] = useState('all');
  const [method, setMethod] = useState('all');
  const [sort, setSort] = useState('date_desc');
  const [filters, setFilters] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 350);
    return () => clearTimeout(timer);
  }, [q]);
  const bounds = useQuery({
    queryKey: ['account', owner, 'dashboard', month],
    enabled: !offline,
    queryFn: () => api.request<DashboardDTO>(`/dashboard?month=${month}`),
  });
  const values = {
    from: bounds.data?.from ?? '',
    to: bounds.data?.to ?? '',
    sort,
    ...(search ? { q: search } : {}),
    ...(type !== 'all' ? { type: type.toUpperCase() } : {}),
    ...(categoryId !== 'all' ? { categoryId } : {}),
    ...(method !== 'all' ? { paymentMethod: methods[method as keyof typeof methods] } : {}),
  };
  const query = useInfiniteQuery({
    queryKey: ['account', owner, 'history', values],
    initialPageParam: null as string | null,
    enabled: !offline && !!bounds.data,
    queryFn: ({ pageParam }) =>
      api.page<RecordDTO>(
        `/transactions?${queryString({ ...values, limit: '25', ...(pageParam ? { cursor: pageParam } : {}) })}`,
      ),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const serverRecords = query.data?.pages.flatMap((p) => p.data).map(transaction) ?? [];
  const records = offline ? localRecords.filter((row) => row.date.startsWith(`${month}-`)
    && (type === 'all' || row.type === type) && (categoryId === 'all' || row.categoryId === categoryId)
    && (method === 'all' || row.paymentMethod === method)
    && `${row.merchant} ${row.description}`.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b)=>sort==='date_asc'?a.date.localeCompare(b.date):sort==='amount_desc'?b.amountPaise-a.amountPaise:b.date.localeCompare(a.date)) : serverRecords;
  useEffect(() => {
    if (!offline && query.data && liveStore.getState().profile?.id === owner) {
      const rows = query.data.pages.flatMap((p) => p.data).map(transaction);
      const ids = new Set(rows.map((r) => r.id));
      liveStore.setState({
        transactions: [...rows, ...liveStore.getState().transactions.filter((r) => !ids.has(r.id))],
      });
    }
  }, [query.data, owner, offline]);
  const clear = () => {
    setQ('');
    setType('all');
    setCategory('all');
    setMethod('all');
    setSort('date_desc');
  };
  return (
    <Screen scroll={false}>
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <TransactionRow record={item} categories={categories} />}
        contentContainerStyle={{ gap: 12, paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshing={!offline && query.isRefetching}
        onRefresh={() => {
          void bounds.refetch();
          void query.refetch();
        }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <PageHeader title="The little details." subtitle="Your transaction history" />
            <AppText variant="heading">{monthName(month)}</AppText>
          {offline ? <AppText>Saved on this device · sync when you’re back online.</AppText> : bounds.data && (
              <AppText>
                {money(bounds.data.totals.netExpense)} net spending ·{' '}
                {money(bounds.data.totals.income)} income
              </AppText>
            )}
            <Input
              label="Search transactions"
              placeholder="Merchant or note"
              value={q}
              onChangeText={setQ}
            />
            <Row>
              <Button
                label={filters ? 'Hide filters' : 'Filters and sorting'}
                variant="secondary"
                onPress={() => setFilters((v) => !v)}
              />
              <Button label="Add entry" onPress={() => router.push('/transaction')} />
            </Row>
            {filters && (
              <>
                <MonthPicker month={month} onChange={setMonth} />
                <Row>
                  {(['all', 'expense', 'income', 'refund'] as const).map((v) => (
                    <Chip key={v} label={v} selected={type === v} onPress={() => setType(v)} />
                  ))}
                </Row>
                <AppText variant="heading">Category</AppText>
                <Row>
                  <Chip
                    label="All categories"
                    selected={categoryId === 'all'}
                    onPress={() => setCategory('all')}
                  />
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      label={`${c.name}${c.kind === 'income' ? ' · income' : ''}`}
                      selected={categoryId === c.id}
                      onPress={() => setCategory(c.id)}
                    />
                  ))}
                </Row>
                <AppText variant="heading">Payment method</AppText>
                <Row>
                  {['all', ...paymentMethods].map((v) => (
                    <Chip
                      key={v}
                      label={v === 'all' ? 'All methods' : v}
                      selected={method === v}
                      onPress={() => setMethod(v)}
                    />
                  ))}
                </Row>
                <Row>
                  {(
                    [
                      ['date_desc', 'Newest first'],
                      ['date_asc', 'Oldest first'],
                      ['amount_desc', 'Highest amount'],
                    ] as const
                  ).map(([v, label]) => (
                    <Chip key={v} label={label} selected={sort === v} onPress={() => setSort(v)} />
                  ))}
                </Row>
                <Button label="Clear filters" variant="quiet" onPress={clear} />
              </>
            )}
            {(query.error || bounds.error) && (
              <Feedback
                error={query.error ?? bounds.error}
                loading={false}
                retry={() => {
                  void bounds.refetch();
                  void query.refetch();
                }}
              />
            )}
            <AppText variant="caption" colour="muted">
            {records.length} {offline ? 'device entries' : `loaded entries${query.hasNextPage ? ' · more available' : ''}`}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          query.isPending || bounds.isPending ? (
            <AppText>Loading your records…</AppText>
          ) : (
            <EmptyState
              title="No little details here yet."
              detail="Try another month or add an entry."
              action="Clear filters"
              onAction={clear}
            />
          )
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <Button
              label="Load more"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}
type Breakdown = TotalsDTO & {
  categoryId: string;
  name: string;
  kind: string;
  label?: string;
  merchantOrPayee?: string | null;
};
export function OnlineInsights() {
  const owner = liveStore((s) => s.profile?.id);
  const records = liveStore((s) => s.transactions);
  const categoriesForOffline = liveStore((s) => s.categories);
  const offline = session((s) => s.offline);
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState<'week' | 'month'>('week');
  const query = useQuery({
    queryKey: ['account', owner, 'insights', month, view],
    enabled: !offline,
    queryFn: async () => {
      const bounds = await api.request<DashboardDTO>(`/dashboard?month=${month}`);
      const start =
        view === 'month'
          ? await api.request<DashboardDTO>(`/dashboard?month=${shiftMonth(month, -5)}`)
          : bounds;
      const window = queryString({ from: bounds.from, to: bounds.to });
      const [summary, categories, merchants, comparison] = await Promise.all([
        api.request<{ totals: TotalsDTO; buckets: (TotalsDTO & { localDate: string })[] }>(
          `/analytics/summary?${queryString({ from: start.from, to: bounds.to, groupBy: view })}`,
        ),
        api.request<{ categories: Breakdown[] }>(`/analytics/categories?${window}`),
        api.request<{ merchants: Breakdown[] }>(`/analytics/merchants?${window}`),
        api.request<{
          baseline: TotalsDTO;
          changes: Record<keyof TotalsDTO, { absolute: string; percentage: string | null }>;
        }>(`/analytics/comparison?month=${month}&comparisonMonth=${shiftMonth(month, -1)}`),
      ]);
      return { bounds, summary, categories, merchants, comparison };
    },
  });
  const data = query.data;
  if (offline) {
    const summary=localTotals(records,month);
    const categoryTotals=categoriesForOffline.map((category)=>({category,amount:records.filter((r)=>r.date.startsWith(`${month}-`)&&r.categoryId===category.id).reduce((sum,r)=>sum+(r.type==='expense'?BigInt(r.amountPaise):r.type==='refund'?-BigInt(r.amountPaise):0n),0n)})).filter((row)=>row.amount!==0n).sort((a,b)=>a.amount>b.amount?-1:a.amount<b.amount?1:0);
    return <Page title="Find your rhythm." subtitle="Device data · sync when you’re back online."><MonthPicker month={month} onChange={setMonth}/><Card><AppText colour="muted">Net spending saved here</AppText><AppText variant="amount">{money(summary.expenses)}</AppText><AppText>Income: {money(summary.income)}</AppText><AppText>Income minus expenses: {money(summary.surplus)}</AppText></Card><Section title="By category">{categoryTotals.map(({category,amount})=><Card key={category.id}><AppText>{category.name}</AppText><AppText variant="heading">{money(amount.toString())}</AppText></Card>)}{categoryTotals.length===0&&<AppText>No category spending saved for this month.</AppText>}</Section></Page>;
  }
  return (
    <Page title="Find your rhythm." subtitle="A clearer picture, at your pace.">
      <MonthPicker month={month} onChange={setMonth} />
      {!data ? (
        <Feedback error={query.error} loading={query.isPending} retry={query.refetch} />
      ) : (
        <>
          {query.error && <Feedback error={query.error} loading={false} retry={query.refetch} />}
          <Card>
            <AppText colour="muted">Net spending</AppText>
            <AppText variant="amount">{money(data.bounds.totals.netExpense)}</AppText>
            <AppText>Income: {money(data.bounds.totals.income)}</AppText>
            <AppText>Income minus net expenses: {money(data.bounds.totals.surplus)}</AppText>
            <AppText variant="caption" colour="muted">
              Refunds reduce spending on their refund date. Surplus is not a bank balance.
            </AppText>
          </Card>
          <Section title="Spending over time">
            <Row>
              <Button
                label="Weekly view"
                variant={view === 'week' ? 'primary' : 'secondary'}
                onPress={() => setView('week')}
              />
              <Button
                label="Monthly view"
                variant={view === 'month' ? 'primary' : 'secondary'}
                onPress={() => setView('month')}
              />
            </Row>
            <Card>
              <AppText colour="muted">
                {view === 'week' ? 'Monday-start weeks in this month' : 'Six-month trend'}
              </AppText>
              {data.summary.buckets.map((b) => (
                <View key={b.localDate} style={{ gap: 6 }}>
                  <AppText variant="label">
                    {b.localDate} · {money(b.netExpense)}
                  </AppText>
                  <Meter
                    label={`Net spending from ${b.localDate}`}
                    value={Number(b.netExpense)}
                    limit={Math.max(1, ...data.summary.buckets.map((v) => Number(v.netExpense)))}
                  />
                </View>
              ))}
              {!data.summary.buckets.length && <AppText>No entries in this period yet.</AppText>}
            </Card>
          </Section>
          <Section title="Where it went">
            {data.categories.categories
              .filter((c) => c.kind === 'EXPENSE')
              .map((c) => (
                <Card key={c.categoryId}>
                  <AppText variant="heading">{c.name}</AppText>
                  <AppText>{money(c.netExpense)}</AppText>
                  <Meter
                    label={`${c.name} share`}
                    value={Number(c.netExpense)}
                    limit={Number(data.bounds.totals.netExpense)}
                  />
                </Card>
              ))}
          </Section>
          <Card>
            <AppText variant="heading">Compared with last month</AppText>
            <AppText>Previous: {money(data.comparison.baseline.netExpense)}</AppText>
            <AppText>Change: {money(data.comparison.changes.netExpense.absolute)}</AppText>
            <AppText>
              {data.comparison.changes.netExpense.percentage === null
                ? 'No nonzero baseline for a percentage.'
                : `${data.comparison.changes.netExpense.percentage}% change`}
            </AppText>
          </Card>
          <Section title="Merchant moments">
            {data.merchants.merchants
              .sort((a, b) => Number(b.netExpense) - Number(a.netExpense))
              .slice(0, 10)
              .map((m, i) => (
                <Card key={i}>
                  <AppText variant="label">{m.label ?? m.merchantOrPayee ?? 'Unspecified'}</AppText>
                  <AppText>{money(m.netExpense)}</AppText>
                </Card>
              ))}
          </Section>
          <Button label="Refresh insights" variant="quiet" onPress={() => void query.refetch()} />
        </>
      )}
    </Page>
  );
}
