import { currentMonth, shiftMonth, today } from './finance';
import type { Budget, Category, Goal, Transaction } from './model';

export function createFixtures(): {
  categories: Category[];
  transactions: Transaction[];
  budgets: Record<string, Budget>;
  goals: Goal[];
} {
  const month = currentMonth();
  const previous = shiftMonth(month, -1);
  const date = (day: number) =>
    `${month}-${String(Math.min(day, Number(today().slice(-2)))).padStart(2, '0')}`;
  const expenseNames = [
    'Food',
    'Groceries',
    'Shopping',
    'Transportation',
    'Entertainment',
    'Bills',
    'Health',
    'Education',
    'Travel',
    'Subscriptions',
    'Other',
  ];
  const expenseIcons = [
    'food',
    'groceries',
    'shopping',
    'transport',
    'entertainment',
    'bills',
    'health',
    'education',
    'travel',
    'subscriptions',
    'other',
  ] as const;
  const categories: Category[] = expenseNames.map((name, index) => ({
    id: `expense-${index}`,
    name,
    kind: 'expense',
    icon: expenseIcons[index] ?? 'other',
    archived: false,
  }));
  for (const [index, name] of ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other'].entries())
    categories.push({
      id: `income-${index}`,
      name,
      kind: 'income',
      icon: (['salary', 'freelance', 'investments', 'gifts', 'other'] as const)[index] ?? 'other',
      archived: false,
    });
  const stamp = new Date().toISOString();
  const transaction = (
    id: string,
    amountPaise: number,
    categoryId: string,
    merchant: string,
    when: string,
    type: Transaction['type'] = 'expense',
    originalExpenseId?: string,
  ): Transaction => ({
    id,
    userId: 'preview',
    amountPaise,
    categoryId,
    merchant,
    date: when,
    type,
    paymentMethod: 'UPI',
    description: '',
    createdAt: stamp,
    updatedAt: stamp,
    ...(originalExpenseId ? { originalExpenseId } : {}),
  });
  return {
    categories,
    transactions: [
      transaction('coffee', 24000, 'expense-0', 'Third Wave Coffee', date(9)),
      transaction('meals', 591000, 'expense-0', 'Meals with friends', date(6)),
      transaction('groceries', 525000, 'expense-1', 'Fresh basket', date(8)),
      transaction('metro', 315000, 'expense-3', 'Metro & weekend rides', date(5)),
      transaction('shopping', 240000, 'expense-2', 'Everyday essentials', date(3)),
      transaction('refund', 40000, 'expense-2', 'Returned item', date(9), 'refund', 'shopping'),
      transaction('subscription', 100000, 'expense-9', 'Music & films', date(2)),
      {
        ...transaction('salary', 6500000, 'income-0', 'Monthly salary', date(1), 'income'),
        paymentMethod: 'Net banking',
      },
      transaction(
        'previous-expense',
        1980000,
        'expense-10',
        'Last month expenses',
        `${previous}-15`,
      ),
      transaction(
        'previous-salary',
        6500000,
        'income-0',
        'Last month salary',
        `${previous}-01`,
        'income',
      ),
    ],
    budgets: {
      [month]: {
        month,
        limitPaise: 3000000,
        categoryLimits: { 'expense-0': 800000, 'expense-1': 700000 },
      },
      [previous]: { month: previous, limitPaise: 3000000, categoryLimits: {} },
    },
    goals: [
      {
        id: 'weekend',
        name: 'A weekend away',
        targetPaise: 2000000,
        targetDate: '',
        contributions: [{ id: 'first-step', amountPaise: 800000, date: date(1) }],
      },
      {
        id: 'rainy-day',
        name: 'A little breathing room',
        targetPaise: 5000000,
        targetDate: '',
        contributions: [{ id: 'rainy-start', amountPaise: 1200000, date: date(1) }],
      },
    ],
  };
}
