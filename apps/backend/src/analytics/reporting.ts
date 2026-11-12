import { DateTime } from 'luxon';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../core/errors.js';
import type { Tx } from '../core/types.js';

export type ReportingDatabase = PrismaClient | Tx;
export type Totals = {
  grossExpense: string;
  refunds: string;
  netExpense: string;
  income: string;
  surplus: string;
};
export type Sums = { grossExpense: string; refunds: string; income: string };

export function validateWindow(from: Date, to: Date) {
  const span = to.getTime() - from.getTime();
  if (!Number.isFinite(span) || span <= 0 || span > 366 * 86400000) {
    throw new ApiError(
      422,
      'INVALID_REPORT_WINDOW',
      'Use an increasing reporting window of at most 366 days.',
    );
  }
}

export function monthBounds(month: string, timezone: string): { from: Date; to: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new ApiError(422, 'INVALID_MONTH', 'Use YYYY-MM.');
  const start = DateTime.fromISO(`${month}-01`, { zone: timezone });
  if (!start.isValid || start.year < 1)
    throw new ApiError(422, 'INVALID_MONTH', 'Use a valid month and timezone.');
  return { from: start.toJSDate(), to: start.plus({ months: 1 }).toJSDate() };
}

export function calculateTotals(row: Sums): Totals {
  const net = BigInt(row.grossExpense) - BigInt(row.refunds);
  return {
    grossExpense: row.grossExpense,
    refunds: row.refunds,
    income: row.income,
    netExpense: net.toString(),
    surplus: (BigInt(row.income) - net).toString(),
  };
}

// SUM(bigint) is PostgreSQL numeric: return decimal text without a float conversion.
export const sumColumns = Prisma.sql`
  COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t."amountMinor" ELSE 0 END), 0)::text AS "grossExpense",
  COALESCE(SUM(CASE WHEN t.type = 'REFUND' THEN t."amountMinor" ELSE 0 END), 0)::text AS refunds,
  COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t."amountMinor" ELSE 0 END), 0)::text AS income`;

export function transactionWindow(userId: string, from: Date, to: Date) {
  validateWindow(from, to);
  return Prisma.sql`t."userId" = ${userId}::uuid AND t."deletedAt" IS NULL
    AND t."occurredAt" >= ${from} AND t."occurredAt" < ${to}`;
}

export async function totals(
  db: ReportingDatabase,
  userId: string,
  from: Date,
  to: Date,
): Promise<Totals> {
  const rows = await db.$queryRaw<Sums[]>(
    Prisma.sql`SELECT ${sumColumns} FROM "Transaction" t WHERE ${transactionWindow(userId, from, to)}`,
  );
  return calculateTotals(rows[0]);
}

export function percentageChange(current: string, baseline: string): string | null {
  const base = BigInt(baseline);
  if (base === 0n) return null;
  const scaled = ((BigInt(current) - base) * 10000n) / (base < 0n ? -base : base);
  const absolute = scaled < 0n ? -scaled : scaled;
  return `${scaled < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
