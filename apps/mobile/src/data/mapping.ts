import type {
  Budget,
  Category,
  Goal,
  Transaction,
  PaymentMethod,
  CategoryIcon,
} from '../features/preview/model';
import type { RecordDTO, UserDTO } from './runtime';
export const methods: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  Cash: 'CASH',
  'Debit card': 'DEBIT_CARD',
  'Credit card': 'CREDIT_CARD',
  'Net banking': 'NET_BANKING',
  Other: 'OTHER',
};
export const minor = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error('This amount exceeds the supported form range.');
  return parsed;
};
export const localDay = (value: unknown, zone = 'Asia/Kolkata') => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(String(value)));
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export const category = (r: RecordDTO): Category => ({
  id: r.id,
  version: r.version,
  name: String(r.name),
  kind: r.kind === 'INCOME' ? 'income' : 'expense',
  icon: (r.iconKey === 'gift' ? 'gifts' : r.iconKey) as CategoryIcon,
  archived: !!r.archivedAt,
});
export const transaction = (r: RecordDTO): Transaction => ({
  id: r.id,
  version: r.version,
  userId: String(r.userId),
  amountPaise: minor(r.amountMinor),
  type: String(r.type).toLowerCase() as Transaction['type'],
  categoryId: String(r.categoryId),
  description: String(r.description ?? ''),
  merchant: String(r.merchantOrPayee ?? ''),
  paymentMethod:
    (Object.keys(methods) as PaymentMethod[]).find((k) => methods[k] === r.paymentMethod) ??
    'Other',
  date: localDay(r.occurredAt),
  occurredAt: String(r.occurredAt),
  createdAt: String(r.createdAt),
  updatedAt: String(r.updatedAt),
  ...(r.originalExpenseId ? { originalExpenseId: String(r.originalExpenseId) } : {}),
  syncStatus: r.syncStatus === 'pending' || r.syncStatus === 'conflict' ? r.syncStatus : 'synced',
});
export const goal = (r: RecordDTO): Goal => ({
  id: r.id,
  version: r.version,
  name: String(r.name),
  targetPaise: minor(r.targetMinor),
  targetDate: String(r.targetDate ?? '').slice(0, 10),
  savedPaise: minor(r.savedMinor ?? 0),
  contributions: [],
});
export const budget = (r: RecordDTO): Budget => ({
  id: r.id,
  version: r.version,
  month: String(r.month).slice(0, 7),
  limitPaise: minor(r.limitMinor),
  categoryLimits: Object.fromEntries(
    ((r.allocations ?? []) as RecordDTO[]).map((a) => [String(a.categoryId), minor(a.limitMinor)]),
  ),
  allocations: ((r.allocations ?? []) as RecordDTO[]).map((a) => ({
    id: a.id,
    categoryId: String(a.categoryId),
    version: a.version,
    limitMinor: String(a.limitMinor),
  })),
});
export const profile = (r: UserDTO) => ({
  id: r.id,
  name: r.displayName,
  email: r.email,
  version: r.profileVersion,
});
export function exactMoney(value: string) {
  const n = BigInt(value),
    a = n < 0n ? -n : n;
  // Hermes supports BigInt arithmetic but does not accept BigInt in Intl.NumberFormat.
  const whole = (a / 100n).toString();
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = head ? `${head},${whole.slice(-3)}` : whole;
  return `${n < 0n ? '−' : ''}₹${grouped}${a % 100n ? `.${(a % 100n).toString().padStart(2, '0')}` : ''}`;
}
