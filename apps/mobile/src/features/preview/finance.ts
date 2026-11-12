import type { Budget, Category, Goal, Transaction, TransactionDraft } from './model';

export const MAX_AMOUNT_PAISE = 999_999_999_999;
export function parseAmount(input: string): number {
  const value = input.trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter rupees with up to two decimal places.');
  const [whole = '0', decimal = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > MAX_AMOUNT_PAISE)
    throw new Error('Enter an amount from ₹0.01 to ₹9,99,99,99,999.99.');
  return paise;
}
export function parseLimit(input: string): number {
  if (input.trim() === '0' || input.trim() === '0.0' || input.trim() === '0.00') return 0;
  return parseAmount(input);
}
export const amountInput = (paise: number) => (paise / 100).toFixed(2);
export function money(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
export function today() {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (key: string) => parts.find((part) => part.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function shiftMonth(month: string, by: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.');
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}
export const monthName = (month: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
export const currentMonth = () => today().slice(0, 7);
export function totals(records: Transaction[], month: string) {
  const selected = records.filter((record) => record.date.startsWith(`${month}-`));
  const sum = (type: Transaction['type']) =>
    selected
      .filter((record) => record.type === type)
      .reduce((value, record) => value + record.amountPaise, 0);
  const income = sum('income');
  const gross = sum('expense');
  const refunds = sum('refund');
  return {
    income,
    gross,
    refunds,
    expenses: gross - refunds,
    surplus: income - gross + refunds,
    count: selected.length,
  };
}
export function exactTotals(records: Transaction[], month: string) {
  const selected = records.filter((record) => record.date.startsWith(`${month}-`));
  const sum = (type: Transaction['type']) => selected
    .filter((record) => record.type === type)
    .reduce((value, record) => value + BigInt(record.amountPaise), 0n);
  const income=sum('income');
  const gross=sum('expense');
  const refunds=sum('refund');
  return {
    income:income.toString(), gross:gross.toString(), refunds:refunds.toString(),
    expenses:(gross-refunds).toString(), surplus:(income-gross+refunds).toString(), count:selected.length,
  };
}
export function categorySpending(records: Transaction[], month: string, categoryId: string) {
  return records
    .filter(
      (record) =>
        record.date.startsWith(`${month}-`) &&
        record.categoryId === categoryId &&
        record.type !== 'income',
    )
    .reduce(
      (sum, record) => sum + (record.type === 'refund' ? -record.amountPaise : record.amountPaise),
      0,
    );
}
export const goalSaved = (goal: Goal) =>
  goal.savedPaise ??
  goal.contributions.reduce((sum, contribution) => sum + contribution.amountPaise, 0);
export const progressPercent = (amount: number, limit: number) =>
  limit > 0 ? Math.max(0, Math.min(100, (amount / limit) * 100)) : 0;
export function refundRemaining(records: Transaction[], expenseId: string, editingId?: string) {
  const parent = records.find((record) => record.id === expenseId && record.type === 'expense');
  return parent
    ? parent.amountPaise -
        records
          .filter(
            (record) =>
              record.type === 'refund' &&
              record.originalExpenseId === expenseId &&
              record.id !== editingId,
          )
          .reduce((sum, record) => sum + record.amountPaise, 0)
    : 0;
}
export function validateTransaction(
  draft: TransactionDraft,
  categories: Category[],
  records: Transaction[],
  editingId?: string,
) {
  const errors: Partial<Record<keyof TransactionDraft, string>> = {};
  let amountPaise = 0;
  try {
    amountPaise = parseAmount(draft.amount);
  } catch (error) {
    errors.amount = (error as Error).message;
  }
  if (!validDate(draft.date) || draft.date > today())
    errors.date = 'Use a real date, today or earlier, as YYYY-MM-DD.';
  if (draft.merchant.trim().length > 80) errors.merchant = 'Keep this to 80 characters.';
  if (draft.description.trim().length > 280)
    errors.description = 'Keep your note to 280 characters.';
  const existing = records.find((record) => record.id === editingId);
  const category = categories.find((item) => item.id === draft.categoryId);
  if (
    !category ||
    category.kind !== (draft.type === 'income' ? 'income' : 'expense') ||
    (category.archived && draft.type !== 'refund' && existing?.categoryId !== category.id)
  )
    errors.categoryId = 'Choose an available category for this entry.';
  if (draft.type === 'refund') {
    const parent = records.find(
      (record) => record.id === draft.originalExpenseId && record.type === 'expense',
    );
    if (!parent) errors.originalExpenseId = 'Choose the original expense.';
    else if (draft.categoryId !== parent.categoryId)
      errors.categoryId = 'A refund uses its original expense category.';
    else if (draft.date < parent.date)
      errors.date = 'The refund cannot be earlier than its expense.';
    else if (amountPaise > refundRemaining(records, parent.id, editingId))
      errors.amount = `The remaining refundable amount is ${money(refundRemaining(records, parent.id, editingId))}.`;
  }
  if (existing?.type === 'expense') {
    const refunded = existing.amountPaise - refundRemaining(records, existing.id);
    if (
      refunded > 0 &&
      (draft.type !== 'expense' ||
        draft.categoryId !== existing.categoryId ||
        amountPaise < refunded ||
        records.some(
          (record) => record.originalExpenseId === existing.id && record.date < draft.date,
        ))
    )
      errors.amount =
        'This expense has refunds. Keep its category and type, an amount covering the refunds, and a date before them.';
  }
  return { errors, amountPaise };
}
export function validateBudget(budget: Budget) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.month)) throw new Error('Use a valid budget month.');
  const limits = [budget.limitPaise, ...Object.values(budget.categoryLimits)];
  if (limits.some((limit) => !Number.isSafeInteger(limit) || limit < 0 || limit > MAX_AMOUNT_PAISE))
    throw new Error('Budget limits must be positive rupee amounts.');
  if (
    Object.values(budget.categoryLimits).reduce((sum, value) => sum + value, 0) > budget.limitPaise
  )
    throw new Error('Category limits must fit within your monthly budget.');
}
