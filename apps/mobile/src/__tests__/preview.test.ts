import { usePreviewStore } from '../features/preview/store';
import {
  amountInput,
  currentMonth,
  exactTotals,
  goalSaved,
  parseAmount,
  progressPercent,
  refundRemaining,
  shiftMonth,
  today,
  totals,
  validDate,
  validateBudget,
  validateTransaction,
} from '../features/preview/finance';
import { createFixtures } from '../features/preview/fixtures';
import {
  categoryBreakdown,
  merchantBreakdown,
  spendingPeriods,
} from '../features/preview/analytics';
import type { TransactionDraft } from '../features/preview/model';

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  amount: '10.01',
  type: 'expense',
  categoryId: 'expense-0',
  description: 'A little test',
  merchant: 'Chai shop',
  paymentMethod: 'Cash',
  date: today(),
  ...overrides,
});
beforeEach(() => {
  usePreviewStore.getState().resetDemo();
  usePreviewStore.setState({ profile: null });
});
describe('integer-paise validation and reporting boundaries', () => {
  it('parses decimal strings without floating point multiplication or silent rounding', () => {
    expect(parseAmount('0.01')).toBe(1);
    expect(parseAmount('123456.78')).toBe(12345678);
    expect(parseAmount('999999999.99')).toBe(99999999999);
    expect(amountInput(1001)).toBe('10.01');
  });
  it.each(['0', '-1', '1.234', '1e3', 'NaN', 'Infinity', '1,000', '10000000000', '.5', ''])(
    'rejects malformed or out-of-range money: %s',
    (value) => expect(() => parseAmount(value)).toThrow(),
  );
  it('accepts the shared API maximum without rounding', () => {
    expect(parseAmount('9999999999.99')).toBe(999999999999);
  });
  it('rejects overflowed dates and follows calendar month boundaries', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(() => shiftMonth('2026-13', 1)).toThrow();
  });
  it('counts refunds in their own month and keeps negative spending truthful', () => {
    const fixtures = createFixtures();
    const expense = fixtures.transactions.find((record) => record.id === 'shopping')!;
    const refund = fixtures.transactions.find((record) => record.id === 'refund')!;
    const month = currentMonth();
    const earlier = shiftMonth(month, -1);
    const records = [
      { ...expense, date: `${earlier}-01` },
      { ...refund, date: `${month}-01` },
    ];
    expect(totals(records, month).expenses).toBe(-40000);
    expect(totals(records, earlier).expenses).toBe(240000);
    expect(progressPercent(-40000, 100000)).toBe(0);
    expect(progressPercent(200000, 100000)).toBe(100);
  });
  it('keeps offline aggregate money exact beyond the safe integer range', () => {
    const row=createFixtures().transactions.find((record)=>record.type==='expense')!;
    const records=Array.from({length:10000},(_,index)=>({...row,id:`large-${index}`,date:`${currentMonth()}-01`,amountPaise:999999999999}));
    expect(exactTotals(records,currentMonth()).gross).toBe('9999999999990000');
    expect(exactTotals(records,currentMonth()).expenses).toBe('9999999999990000');
  });
});
describe('preview mutations and derived views', () => {
  it('creates, edits and deletes one entry with consistent dashboard totals', () => {
    const baseline = totals(usePreviewStore.getState().transactions, currentMonth()).expenses;
    const id = usePreviewStore.getState().saveTransaction(draft());
    expect(totals(usePreviewStore.getState().transactions, currentMonth()).expenses).toBe(
      baseline + 1001,
    );
    usePreviewStore.getState().saveTransaction(draft({ amount: '2.34' }), id);
    expect(totals(usePreviewStore.getState().transactions, currentMonth()).expenses).toBe(
      baseline + 234,
    );
    usePreviewStore.getState().deleteTransaction(id);
    expect(totals(usePreviewStore.getState().transactions, currentMonth()).expenses).toBe(baseline);
  });
  it('prevents over-refunds, invalid categories and deletion of linked expenses', () => {
    const state = usePreviewStore.getState();
    expect(refundRemaining(state.transactions, 'shopping')).toBe(200000);
    expect(() =>
      state.saveTransaction(
        draft({
          type: 'refund',
          categoryId: 'expense-2',
          originalExpenseId: 'shopping',
          amount: '2000.01',
        }),
      ),
    ).toThrow();
    expect(() => state.deleteTransaction('shopping')).toThrow();
    expect(() => state.saveTransaction(draft({ categoryId: 'income-0' }))).toThrow();
    expect(() => state.saveTransaction(draft({ amount: '1' }), 'missing')).toThrow();
  });
  it('preserves refund links and validates edits against already-refunded amounts', () => {
    const state = usePreviewStore.getState();
    const original = state.transactions.find((record) => record.id === 'shopping')!;
    const result = validateTransaction(
      draft({ categoryId: original.categoryId, amount: '100.00', date: original.date }),
      state.categories,
      state.transactions,
      original.id,
    );
    expect(result.errors.amount).toBeTruthy();
    expect(refundRemaining(state.transactions, 'shopping', 'refund')).toBe(240000);
    expect(() =>
      state.saveTransaction(
        draft({
          type: 'refund',
          amount: '2400',
          categoryId: 'expense-2',
          originalExpenseId: 'shopping',
        }),
        'refund',
      ),
    ).not.toThrow();
  });
  it('keeps archived categories in history and allows refunds against archived originals', () => {
    usePreviewStore.getState().archiveCategory('expense-2');
    expect(() =>
      usePreviewStore.getState().saveTransaction(draft({ categoryId: 'expense-2' })),
    ).toThrow();
    expect(() =>
      usePreviewStore.getState().saveTransaction(
        draft({
          type: 'refund',
          originalExpenseId: 'shopping',
          categoryId: 'expense-2',
          amount: '1',
        }),
      ),
    ).not.toThrow();
    expect(
      categoryBreakdown(
        usePreviewStore.getState().transactions,
        usePreviewStore.getState().categories,
        currentMonth(),
      ).some((category) => category.id === 'expense-2'),
    ).toBe(true);
  });
  it('rejects duplicate category names and over-allocated budget limits', () => {
    expect(() => usePreviewStore.getState().saveCategory(' food ', 'expense', 'food')).toThrow();
    expect(() =>
      validateBudget({ month: currentMonth(), limitPaise: 10000, categoryLimits: { food: 10001 } }),
    ).toThrow();
    expect(() =>
      validateBudget({ month: currentMonth(), limitPaise: 0, categoryLimits: {} }),
    ).not.toThrow();
  });
  it('restores an archived category instead of recreating its name under a new ID', () => {
    const state = usePreviewStore.getState();
    state.archiveCategory('expense-0');
    expect(() => state.saveCategory(' FOOD ', 'expense', 'food')).toThrow();
    expect(state.saveCategory('Food', 'expense', 'food', 'expense-0')).toBe('expense-0');
    expect(
      usePreviewStore.getState().categories.find((category) => category.id === 'expense-0')
        ?.archived,
    ).toBe(false);
  });
  it('adds/removes goal contributions without creating income or expenses', () => {
    const state = usePreviewStore.getState();
    const ledger = [...state.transactions];
    const before = goalSaved(state.goals[0]!);
    state.contribute('weekend', '120.50');
    const goal = usePreviewStore.getState().goals.find((item) => item.id === 'weekend')!;
    expect(goalSaved(goal)).toBe(before + 12050);
    expect(usePreviewStore.getState().transactions).toEqual(ledger);
    state.removeContribution('weekend', goal.contributions.at(-1)!.id);
    expect(goalSaved(usePreviewStore.getState().goals[0]!)).toBe(before);
  });
  it('keeps exact category, weekly and merchant totals in agreement', () => {
    const { transactions, categories } = createFixtures();
    const month = currentMonth();
    const net = totals(transactions, month).expenses;
    expect(net).toBe(1755000);
    expect(
      categoryBreakdown(transactions, categories, month).reduce(
        (sum, category) => sum + category.amount,
        0,
      ),
    ).toBe(net);
    expect(
      spendingPeriods(transactions, month, 'weekly').reduce((sum, week) => sum + week.value, 0),
    ).toBe(net);
    expect(
      merchantBreakdown(transactions, month).reduce((sum, merchant) => sum + merchant.amount, 0),
    ).toBe(net);
  });
  it('supports recoverable error/empty previews and clears session data on sign-out', () => {
    const state = usePreviewStore.getState();
    state.signIn('Test explorer', 'test@example.com');
    state.setScenario('error');
    state.resetDemo(true);
    expect(usePreviewStore.getState().transactions).toHaveLength(0);
    expect(usePreviewStore.getState().scenario).toBe('ready');
    state.saveTransaction(draft());
    state.signOut();
    expect(usePreviewStore.getState().profile).toBeNull();
    expect(
      usePreviewStore.getState().transactions.some((record) => record.merchant === 'Chai shop'),
    ).toBe(false);
  });
});
