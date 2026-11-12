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
  version?: number;
  id: string;
  name: string;
  kind: CategoryKind;
  icon: CategoryIcon;
  archived: boolean;
};
export type Transaction = {
  id: string;
  userId: string;
  version?: number;
  occurredAt?: string;
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
  syncStatus?: 'pending' | 'synced' | 'conflict';
  remoteConflict?: Record<string, unknown>;
};
export type TransactionDraft = {
  clientId?: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  description: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  date: string;
  originalExpenseId?: string;
};
export type Contribution = { id: string; amountPaise: number; date: string; version?: number };
export type Goal = {
  version?: number;
  savedPaise?: number;
  id: string;
  name: string;
  targetPaise: number;
  targetDate: string;
  contributions: Contribution[];
};
export type Budget = {
  id?: string;
  version?: number;
  allocations?: { id: string; categoryId: string; version: number; limitMinor: string }[];
  month: string;
  limitPaise: number;
  categoryLimits: Record<string, number>;
};
export type Profile = { id?: string; version?: number; name: string; email: string };
export type PreviewScenario = 'ready' | 'loading' | 'error';
