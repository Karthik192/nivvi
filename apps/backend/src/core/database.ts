import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuid } from '@nivvi/contracts';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { ApiError } from './errors.js';
import type { Deps, Tx } from './types.js';
export const createDatabase = (url: string) =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      options: '-c statement_timeout=10000 -c lock_timeout=5000',
    }),
  });
export function serialize(value: unknown): Prisma.JsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.JsonValue;
}
export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
export async function emit(
  tx: Tx,
  userId: string,
  entityType: string,
  row: { id: string; version: number; deletedAt: Date | null },
) {
  const state = await tx.syncState.update({
    where: { userId },
    data: { lastSequence: { increment: 1 } },
  });
  await tx.changeEvent.create({
    data: {
      userId,
      sequence: state.lastSequence,
      entityType,
      entityId: row.id,
      entityVersion: row.version,
      operation: row.deletedAt ? 'DELETE' : 'UPSERT',
      payload: serialize(row) as Prisma.InputJsonValue,
    },
  });
}
export async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "userId" FROM "SyncState" WHERE "userId"=${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findFirst({ where: { id: userId, status: 'ACTIVE' } });
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return user;
}
export async function mutate(
  req: Request,
  deps: Deps,
  action: (
    tx: Tx,
    userId: string,
  ) => Promise<{ data: unknown; status?: number; entityId?: string }>,
) {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const userId = req.auth.userId;
  const key = req.get('Idempotency-Key');
  if (!key || !uuid.safeParse(key).success)
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Supply a UUID Idempotency-Key header.');
  const requestHash = createHash('sha256')
    .update(
      canonical({
        method: req.method,
        path: req.originalUrl.split('?')[0],
        query: req.query,
        body: req.body,
      }),
    )
    .digest('hex');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await deps.db.$transaction(
        async (tx) => {
          await lockUser(tx, userId);
          const session = await tx.session.findFirst({
            where: {
              id: req.auth!.sessionId,
              userId,
              revokedAt: null,
              familyExpiresAt: { gt: new Date() },
            },
          });
          if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
          const previous = await tx.mutationReceipt.findUnique({
            where: { userId_operationId: { userId, operationId: key } },
          });
          if (previous) {
            if (previous.requestHash !== requestHash)
              throw new ApiError(
                409,
                'IDEMPOTENCY_KEY_REUSED',
                'This operation key was used for a different request.',
              );
            return { status: previous.status, body: previous.result };
          }
          await tx.$executeRawUnsafe('SAVEPOINT financial_operation');
          let result: { data: unknown; status?: number; entityId?: string };
          try {
            result = await action(tx, userId);
          } catch (error) {
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT financial_operation');
            let failure: ApiError;
            if (error instanceof ApiError) failure = error;
            else if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            )
              failure = new ApiError(
                409,
                'UNIQUE_CONFLICT',
                'This record conflicts with an existing record.',
              );
            else if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2003'
            )
              failure = new ApiError(
                422,
                'INVALID_REFERENCE',
                'A referenced record is unavailable.',
              );
            else throw error;
            const body = serialize({
              error: { code: failure.code, message: failure.message, ...failure.details },
              requestId: req.requestId,
            });
            await tx.mutationReceipt.create({
              data: {
                userId,
                operationId: key,
                requestHash,
                status: failure.status,
                result: body as Prisma.InputJsonValue,
              },
            });
            return { status: failure.status, body };
          }
          const body = serialize({ data: result.data });
          const status = result.status ?? 200;
          await tx.mutationReceipt.create({
            data: {
              userId,
              operationId: key,
              requestHash,
              entityId: result.entityId,
              status,
              result: body as Prisma.InputJsonValue,
            },
          });
          return { status, body };
        },
        { timeout: 15000, maxWait: 10000 },
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        continue;
      throw error;
    }
  }
  throw new ApiError(503, 'RETRY_LATER', 'Please retry the operation with the same operation key.');
}
