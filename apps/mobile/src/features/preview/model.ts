export type TransactionType = 'expense' | 'income' | 'refund';
export type CategoryKind = 'expense' | 'income';
export const paymentMethods = [
  'UPI',
  'Cash',
  'Debit card',
  'Credit card',
  'Net banking',
  'Other',
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const iconKeys = [
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
  'salary',
  'freelance',
  'investments',
  'gifts',
] as const;
export type CategoryIcon = (typeof iconKeys)[number];
export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: CategoryIcon;
  archived: boolean;
};
export type Transaction = {
  id: string;
  userId: 'preview';
  amountPaise: number;
  type: TransactionType;
  categoryId: string;
  description: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  date: string;
  createdAt: string;
  updatedAt: string;
  originalExpenseId?: string;
};
export type TransactionDraft = {
  amount: string;
  type: TransactionType;
  categoryId: string;
  description: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  date: string;
  originalExpenseId?: string;
};
export type Contribution = { id: string; amountPaise: number; date: string };
export type Goal = {
  id: string;
  name: string;
  targetPaise: number;
  targetDate: string;
  contributions: Contribution[];
};
export type Budget = { month: string; limitPaise: number; categoryLimits: Record<string, number> };
export type Profile = { name: string; email: string };
export type PreviewScenario = 'ready' | 'loading' | 'error';
