import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Screen } from '../../components/ui/Screen';
import { Page, PageHeader, MonthPicker, Row, Chip, EmptyState, Resource } from '../preview/ui';
import { currentMonth, money, monthName, totals } from '../preview/finance';
import { paymentMethods, type TransactionType } from '../preview/model';
import { usePreviewStore } from '../preview/store';
import { TransactionRow } from './TransactionRow';

export function HistoryScreen() {
  const records = usePreviewStore((state) => state.transactions);
  const categories = usePreviewStore((state) => state.categories);
  const scenario = usePreviewStore((state) => state.scenario);
  const [month, setMonth] = useState(currentMonth);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [categoryId, setCategoryId] = useState('all');
  const [method, setMethod] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const [filters, setFilters] = useState(false);
  const filtered = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.date.startsWith(`${month}-`) &&
            (type === 'all' || record.type === type) &&
            (categoryId === 'all' || record.categoryId === categoryId) &&
            (method === 'all' || record.paymentMethod === method) &&
            `${record.merchant} ${record.description} ${categories.find((category) => category.id === record.categoryId)?.name ?? ''}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'highest'
            ? b.amountPaise - a.amountPaise || b.date.localeCompare(a.date)
            : sort === 'oldest'
              ? a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
              : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
        ),
    [records, categories, month, type, categoryId, method, query, sort],
  );
  const clear = () => {
    setQuery('');
    setType('all');
    setCategoryId('all');
    setMethod('all');
    setSort('newest');
  };
  const summary = totals(records, month);
  if (scenario !== 'ready')
    return (
      <Page title="The little details.">
        <Resource />
      </Page>
    );
  return (
    <Screen scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(record) => record.id}
        renderItem={({ item }) => <TransactionRow record={item} categories={categories} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ gap: 12, paddingTop: 24, paddingBottom: 48 }}
        initialNumToRender={12}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <PageHeader title="The little details." subtitle="Your transaction history" />
            <AppText variant="heading">{monthName(month)}</AppText>
            <AppText variant="caption" colour="muted">
              {money(summary.expenses)} net spending · {money(summary.income)} income
            </AppText>
            <Input
              label="Search transactions"
              placeholder="Merchant, note or category"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            <Row>
              <View style={{ flexGrow: 1, flexBasis: 140 }}>
                <Button
                  label={filters ? 'Hide filters' : 'Filters and sorting'}
                  variant="secondary"
                  accessibilityState={{ expanded: filters }}
                  onPress={() => setFilters((value) => !value)}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 112 }}>
                <Button label="Add entry" onPress={() => router.push('/transaction')} />
              </View>
            </Row>
            {(type !== 'all' || categoryId !== 'all' || method !== 'all' || sort !== 'newest') && (
              <AppText variant="caption" colour="muted">
                Active: {type === 'all' ? 'All types' : type} ·{' '}
                {categories.find((category) => category.id === categoryId)?.name ??
                  'All categories'}{' '}
                · {method === 'all' ? 'All methods' : method} · {sort} first
              </AppText>
            )}
            {filters && (
              <View style={{ gap: 16 }}>
                <MonthPicker month={month} onChange={setMonth} />
                <AppText variant="heading">Transaction type</AppText>
                <Row>
                  {(['all', 'expense', 'income', 'refund'] as const).map((option) => (
                    <Chip
                      key={option}
                      label={
                        option === 'all'
                          ? 'All entries'
                          : option === 'expense'
                            ? 'Expenses'
                            : option === 'income'
                              ? 'Income'
                              : 'Refunds'
                      }
                      selected={type === option}
                      onPress={() => setType(option)}
                    />
                  ))}
                </Row>
                <AppText variant="heading">Category</AppText>
                <Row>
                  <Chip
                    label="All categories"
                    selected={categoryId === 'all'}
                    onPress={() => setCategoryId('all')}
                  />
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={`${category.name}${category.kind === 'income' ? ' · income' : ''}`}
                      selected={categoryId === category.id}
                      onPress={() => setCategoryId(category.id)}
                    />
                  ))}
                </Row>
                <AppText variant="heading">Payment method</AppText>
                <Row>
                  <Chip
                    label="All methods"
                    selected={method === 'all'}
                    onPress={() => setMethod('all')}
                  />
                  {paymentMethods.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={method === item}
                      onPress={() => setMethod(item)}
                    />
                  ))}
                </Row>
                <AppText variant="heading">Sort by</AppText>
                <Row>
                  {(['newest', 'oldest', 'highest'] as const).map((item) => (
                    <Chip
                      key={item}
                      label={
                        item === 'newest'
                          ? 'Newest first'
                          : item === 'oldest'
                            ? 'Oldest first'
                            : 'Highest amount'
                      }
                      selected={sort === item}
                      onPress={() => setSort(item)}
                    />
                  ))}
                </Row>
                <Button label="Clear filters" variant="quiet" onPress={clear} />
              </View>
            )}
            <AppText variant="caption" colour="muted" accessibilityLiveRegion="polite">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No little details here yet."
            detail="Try another month or clear your filters. You can also add a new preview entry."
            action="Clear search and filters"
            onAction={clear}
          />
        }
      />
    </Screen>
  );
}
