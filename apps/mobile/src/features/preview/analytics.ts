import type { Category, Transaction } from './model';
import { categorySpending, monthName, shiftMonth, totals } from './finance';

export function spendingPeriods(
  transactions: Transaction[],
  month: string,
  view: 'weekly' | 'monthly',
) {
  if (view === 'monthly')
    return Array.from({ length: 6 }, (_, index) => {
      const period = shiftMonth(month, index - 5);
      return { label: monthName(period), value: totals(transactions, period).expenses };
    });
  const records = transactions.filter((record) => record.date.startsWith(`${month}-`));
  const lastDay = new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`);
  lastDay.setUTCDate(0);
  const countDays = lastDay.getUTCDate();
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((countDays + offset) / 7) }, (_, index) => {
    const start = Math.max(1, index * 7 - offset + 1);
    const end = Math.min(countDays, (index + 1) * 7 - offset);
    return {
      label: `${start}–${end}`,
      value: records
        .filter(
          (record) =>
            Number(record.date.slice(-2)) >= start &&
            Number(record.date.slice(-2)) <= end &&
            record.type !== 'income',
        )
        .reduce(
          (sum, record) =>
            sum + (record.type === 'refund' ? -record.amountPaise : record.amountPaise),
          0,
        ),
    };
  });
}
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  month: string,
) {
  return categories
    .filter((category) => category.kind === 'expense')
    .map((category) => ({
      ...category,
      amount: categorySpending(transactions, month, category.id),
    }))
    .filter((category) => category.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}
export function merchantBreakdown(transactions: Transaction[], month: string) {
  const records = transactions.filter(
    (record) => record.date.startsWith(`${month}-`) && record.type !== 'income',
  );
  const grouped = new Map<string, number>();
  for (const record of records) {
    const name = record.merchant.trim() || 'Unnamed merchant';
    grouped.set(
      name,
      (grouped.get(name) ?? 0) +
        (record.type === 'refund' ? -record.amountPaise : record.amountPaise),
    );
  }
  return [...grouped]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}
