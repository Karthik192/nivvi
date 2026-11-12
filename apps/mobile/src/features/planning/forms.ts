import { parseAmount, parseLimit, today, validDate } from '../preview/finance';
import type { Budget } from '../preview/model';

export type FieldErrors = Record<string, string>;
export function budgetDraft(month: string, monthly: string, categories: Record<string, string>) {
  const errors: FieldErrors = {};
  let limitPaise = 0;
  try {
    limitPaise = parseLimit(monthly);
  } catch (error) {
    errors.monthly = (error as Error).message;
  }
  const categoryLimits: Record<string, number> = {};
  for (const [id, amount] of Object.entries(categories)) {
    if (!amount.trim()) continue;
    try {
      categoryLimits[id] = parseLimit(amount);
    } catch (error) {
      errors[id] = (error as Error).message;
    }
  }
  if (
    !errors.monthly &&
    Object.values(categoryLimits).reduce((sum, value) => sum + value, 0) > limitPaise
  ) {
    errors.monthly =
      'Category limits must fit within your monthly limit. Increase it or reduce a category limit.';
  }
  return { errors, budget: { month, limitPaise, categoryLimits } satisfies Budget };
}

export function goalErrors(name: string, amount: string, date: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim() || name.trim().length > 60)
    errors.name = 'Use a goal name between 1 and 60 characters.';
  try {
    parseAmount(amount);
  } catch (error) {
    errors.amount = (error as Error).message;
  }
  if (date && (!validDate(date) || date < today()))
    errors.date = 'Use today or a future date, as YYYY-MM-DD, or leave this empty.';
  return errors;
}
