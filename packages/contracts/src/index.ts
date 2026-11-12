import { z } from 'zod';
export { z };
export const MAX_MINOR = 999999999999n;
export const uuid = z.uuid();
export const version = z.number().int().min(1).max(2147483646);
export const amountMinor = z.string().regex(/^[1-9]\d{0,11}$/);
export const limitMinor = z.string().regex(/^(0|[1-9]\d{0,11})$/);
export const currency = z.literal('INR');
export const timestamp = z.iso.datetime({ offset: true });
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const localDate = z.iso.date();
export const categoryKind = z.enum(['EXPENSE', 'INCOME']);
export const transactionType = z.enum(['EXPENSE', 'INCOME', 'REFUND']);
export const paymentMethod = z.enum([
  'UPI',
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'NET_BANKING',
  'OTHER',
]);
export const iconKey = z.enum([
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
  'gift',
  'leaf',
  'shield',
  'goal',
]);
export const colourToken = z.enum(['primary', 'accent', 'peach', 'lavender']);
export const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const pagination = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const categoryCreate = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1).max(60),
    kind: categoryKind,
    iconKey,
    colourToken: colourToken.default('primary'),
  })
  .strict();
export const categoryPatch = categoryCreate
  .omit({ id: true, kind: true })
  .partial()
  .extend({ archived: z.boolean().optional(), baseVersion: version })
  .strict();
const transactionFields = z.object({
  amountMinor,
  currency: currency.default('INR'),
  categoryId: uuid,
  description: optionalText(500),
  merchantOrPayee: optionalText(120),
  paymentMethod,
  occurredAt: timestamp,
});
export const transactionCreate = transactionFields
  .extend({ id: uuid, type: transactionType, originalExpenseId: uuid.optional() })
  .strict();
export const transactionPatch = transactionFields
  .partial()
  .extend({ baseVersion: version })
  .strict();
export const transactionQuery = pagination
  .extend({
    type: transactionType.optional(),
    originalExpenseId: uuid.optional(),
    categoryId: uuid.optional(),
    paymentMethod: paymentMethod.optional(),
    from: timestamp.optional(),
    to: timestamp.optional(),
    minAmountMinor: limitMinor.optional(),
    maxAmountMinor: amountMinor.optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
  })
  .strict();
export const categoryQuery = z
  .object({
    kind: categoryKind.optional(),
    includeArchived: z.enum(['true', 'false']).default('false'),
  })
  .strict();
export const deleteQuery = z
  .object({ baseVersion: z.coerce.number().int().min(1).max(2147483646) })
  .strict();
export const budgetCreate = z
  .object({ id: uuid, month, limitMinor, currency: currency.default('INR') })
  .strict();
export const budgetPatch = z.object({ baseVersion: version, limitMinor }).strict();
export const budgetPlan = z
  .object({
    baseVersion: version.nullable(),
    limitMinor,
    baseAllocations: z.array(z.object({ id: uuid, version }).strict()).max(100),
    allocations: z.array(z.object({ categoryId: uuid, limitMinor }).strict()).max(100),
  })
  .strict();
export const budgetQuery = pagination
  .extend({ from: month.optional(), to: month.optional() })
  .strict();
export const allocationCreate = z.object({ id: uuid, categoryId: uuid, limitMinor }).strict();
export const allocationPatch = budgetPatch;
export const goalCreate = z
  .object({
    id: uuid,
    name: z.string().trim().min(1).max(80),
    targetMinor: amountMinor,
    currency: currency.default('INR'),
    targetDate: localDate.nullable().optional(),
    iconKey: iconKey.default('goal'),
  })
  .strict();
export const goalPatch = goalCreate
  .omit({ id: true, currency: true })
  .partial()
  .extend({ baseVersion: version, archived: z.boolean().optional() })
  .strict();
export const goalDeleteQuery = deleteQuery
  .extend({ confirmContributions: z.enum(['true', 'false']).default('false') })
  .strict();
export const goalQuery = pagination
  .extend({ includeArchived: z.enum(['true', 'false']).default('false') })
  .strict();
export const contributionCreate = z
  .object({ id: uuid, amountMinor, contributedAt: timestamp, note: optionalText(500) })
  .strict();
export const contributionPatch = contributionCreate
  .omit({ id: true })
  .partial()
  .extend({ baseVersion: version })
  .strict();
export const reportQuery = z
  .object({
    from: timestamp,
    to: timestamp,
    groupBy: z.enum(['day', 'week', 'month']).default('month'),
  })
  .strict();
export const dashboardQuery = z.object({ month }).strict();
export const comparisonQuery = z.object({ month, comparisonMonth: month }).strict();
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z.string().min(12).max(128);
export const installationId = z.string().trim().min(1).max(128);
export const registerBody = z
  .object({
    email,
    password,
    displayName: z.string().trim().min(1).max(80),
    installationId: installationId.default('manual'),
  })
  .strict();
export const loginBody = z
  .object({ email, password: z.string().min(1).max(128), installationId })
  .strict();
export const refreshBody = z.object({ refreshToken: z.string().min(40).max(256) }).strict();
export const forgotBody = z.object({ email }).strict();
export const resetBody = z
  .object({ resetToken: z.string().min(40).max(256), newPassword: password })
  .strict();
export const verifyBody = z.object({ verificationToken: z.string().min(40).max(256) }).strict();
export const reauthBody = z.object({ password: z.string().min(1).max(128) }).strict();
export const accountDeleteBody = reauthBody
  .extend({ confirmation: z.literal('DELETE MY ACCOUNT') })
  .strict();
export const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Use a supported IANA timezone.');
export const profilePatch = z
  .object({
    baseVersion: version,
    displayName: z.string().trim().min(1).max(80).optional(),
    locale: z.literal('en-IN').optional(),
    theme: z.enum(['system', 'light', 'dark']).optional(),
    timezone: timezone.optional(),
  })
  .strict();
export const publicSchemas = {
  categoryCreate,
  categoryPatch,
  transactionCreate,
  transactionPatch,
  budgetCreate,
  budgetPatch,
  allocationCreate,
  allocationPatch,
  goalCreate,
  goalPatch,
  contributionCreate,
  contributionPatch,
  registerBody,
  loginBody,
  refreshBody,
  forgotBody,
  resetBody,
  verifyBody,
  profilePatch,
  accountDeleteBody,
};
