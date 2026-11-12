import type { Request } from 'express';
import { MAX_MINOR, z } from '@nivvi/contracts';
import { ApiError, notFound } from '../core/errors.js';
import type { Tx } from '../core/types.js';

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request.', {
      fieldErrors: z.flattenError(result.error),
    });
  return result.data;
}

export function conflict(code: string, message: string): never {
  throw new ApiError(409, code, message);
}

export function semantic(message: string): never {
  throw new ApiError(422, 'INVALID_FINANCIAL_STATE', message);
}

export function bounded(value: bigint): bigint {
  if (value > MAX_MINOR || value < 0n) semantic('Aggregate exceeds the supported money range.');
  return value;
}

export function normalizeName(name: string): string {
  const normalized = name.normalize('NFKC').toLowerCase();
  if ([...normalized].length > 120) semantic('The normalized category name is too long.');
  return normalized;
}

export async function category(
  tx: Tx,
  userId: string,
  id: string,
  kind?: string,
  allowArchived = false,
) {
  const row = await tx.category.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw notFound();
  if (!allowArchived && row.archivedAt) semantic('This category is archived.');
  if (kind && row.kind !== kind) semantic('Category kind does not match this record.');
  return row;
}

export function range(from?: string, to?: string, maxDays = 3660) {
  if (
    from &&
    to &&
    (Date.parse(from) >= Date.parse(to) || Date.parse(to) - Date.parse(from) > maxDays * 86400000)
  ) {
    semantic('Use an increasing date window within the supported range.');
  }
}

export function path(req: Request, key = 'id'): unknown {
  return req.params[key];
}

export function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}
export function budgetRecord<T extends { month: Date }>(row: T) {
  return { ...row, month: row.month.toISOString().slice(0, 7) };
}
export function goalRecord<T extends { targetDate: Date | null }>(row: T) {
  return { ...row, targetDate: row.targetDate?.toISOString().slice(0, 10) ?? null };
}

export function tombstone(row: { id: string; version: number; deletedAt: Date | null }) {
  return { id: row.id, version: row.version, deletedAt: row.deletedAt };
}
