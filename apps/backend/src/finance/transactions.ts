import { Router } from 'express';
import {
  deleteQuery,
  transactionCreate,
  transactionPatch,
  transactionQuery,
} from '@nivvi/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { emit, mutate } from '../core/database.js';
import { assertVersion, notFound } from '../core/errors.js';
import { endpoint, id, principal, send, sendMutation, sendPage } from '../core/http.js';
import { getPage } from '../core/pagination.js';
import type { Deps, Tx } from '../core/types.js';
import { category, conflict, parse, path, range, semantic, tombstone } from './common.js';

async function owned(tx: Tx, userId: string, entityId: string) {
  const row = await tx.transaction.findFirst({ where: { id: entityId, userId, deletedAt: null } });
  if (!row) throw notFound();
  return row;
}

async function refunds(tx: Tx, userId: string, expenseId: string, exclude?: string) {
  return (
    (
      await tx.transaction.aggregate({
        where: {
          userId,
          originalExpenseId: expenseId,
          type: 'REFUND',
          deletedAt: null,
          ...(exclude && { id: { not: exclude } }),
        },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor ?? 0n
  );
}

export function transactionRoutes(deps: Deps) {
  const router = Router();
  router.get(
    '/transactions',
    endpoint(async (req, res) => {
      const query = parse(transactionQuery, req.query);
      const { userId } = principal(req);
      range(query.from, query.to);
      if (
        query.minAmountMinor &&
        query.maxAmountMinor &&
        BigInt(query.minAmountMinor) > BigInt(query.maxAmountMinor)
      )
        semantic('Minimum amount exceeds maximum amount.');
      if (query.categoryId) await category(deps.db, userId, query.categoryId, undefined, true);
      const page = getPage(req, deps, userId, query);
      const direction = query.sort.endsWith('asc') ? 'asc' : 'desc';
      const where: Prisma.TransactionWhereInput = {
        userId,
        deletedAt: null,
        ...(query.type && { type: query.type }),
        ...(query.originalExpenseId && { originalExpenseId: query.originalExpenseId }),
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
        ...((query.from || query.to) && {
          occurredAt: {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lt: new Date(query.to) }),
          },
        }),
        ...((query.minAmountMinor || query.maxAmountMinor) && {
          amountMinor: {
            ...(query.minAmountMinor && { gte: BigInt(query.minAmountMinor) }),
            ...(query.maxAmountMinor && { lte: BigInt(query.maxAmountMinor) }),
          },
        }),
        ...(query.q && {
          OR: [
            { description: { contains: query.q, mode: 'insensitive' } },
            { merchantOrPayee: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
      };
      sendPage(
        res,
        page.result(
          await deps.db.transaction.findMany({
            where,
            skip: page.skip,
            take: page.take,
            orderBy: [
              query.sort.startsWith('amount')
                ? { amountMinor: direction }
                : { occurredAt: direction },
              { id: direction },
            ],
          }),
        ),
      );
    }),
  );
  router.get(
    '/transactions/:id',
    endpoint(async (req, res) => {
      send(res, await owned(deps.db, principal(req).userId, id(path(req))));
    }),
  );
  router.post(
    '/transactions',
    endpoint(async (req, res) => {
      const body = parse(transactionCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          if (await tx.transaction.findUnique({ where: { id: body.id } }))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          if (body.type === 'REFUND') {
            if (!body.originalExpenseId) semantic('A refund requires an original expense.');
            const expense = await owned(tx, userId, body.originalExpenseId);
            if (expense.type !== 'EXPENSE') semantic('Refund parent must be an expense.');
            if (body.categoryId !== expense.categoryId)
              semantic('Refund must use its original expense category.');
            await category(tx, userId, expense.categoryId, 'EXPENSE', true);
            if (
              (await refunds(tx, userId, expense.id)) + BigInt(body.amountMinor) >
              expense.amountMinor
            )
              conflict('REFUND_LIMIT_EXCEEDED', 'Refunds cannot exceed the original expense.');
          } else {
            if (body.originalExpenseId) semantic('Only refunds may link an original expense.');
            await category(tx, userId, body.categoryId, body.type);
          }
          const row = await tx.transaction.create({
            data: {
              ...body,
              userId,
              amountMinor: BigInt(body.amountMinor),
              occurredAt: new Date(body.occurredAt),
              source: 'MANUAL_APP',
            },
          });
          await emit(tx, userId, 'Transaction', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/transactions/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion, ...body } = parse(transactionPatch, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(current, baseVersion);
          const amount =
            body.amountMinor === undefined ? current.amountMinor : BigInt(body.amountMinor);
          const categoryId = body.categoryId ?? current.categoryId;
          if (current.type === 'REFUND') {
            if (!current.originalExpenseId) semantic('Refund is missing its original expense.');
            const expense = await owned(tx, userId, current.originalExpenseId);
            if (expense.type !== 'EXPENSE' || categoryId !== expense.categoryId)
              semantic('Refund must use its original expense category.');
            await category(tx, userId, categoryId, 'EXPENSE', true);
            if ((await refunds(tx, userId, expense.id, current.id)) + amount > expense.amountMinor)
              conflict('REFUND_LIMIT_EXCEEDED', 'Refunds cannot exceed the original expense.');
          } else {
            if (body.categoryId) await category(tx, userId, categoryId, current.type);
            if (current.type === 'EXPENSE') {
              const refunded = await refunds(tx, userId, current.id);
              if (refunded > amount)
                conflict('REFUND_LIMIT_EXCEEDED', 'Expense cannot be reduced below live refunds.');
              if (refunded > 0n && categoryId !== current.categoryId)
                conflict(
                  'EXPENSE_HAS_REFUNDS',
                  'Remove linked refunds before changing the expense category.',
                );
            }
          }
          const row = await tx.transaction.update({
            where: { id: entityId },
            data: {
              ...body,
              amountMinor: amount,
              ...(body.occurredAt && { occurredAt: new Date(body.occurredAt) }),
              version: { increment: 1 },
            },
          });
          await emit(tx, userId, 'Transaction', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  router.delete(
    '/transactions/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion } = parse(deleteQuery, req.query);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(current, baseVersion);
          if (current.type === 'EXPENSE' && (await refunds(tx, userId, entityId)) > 0n)
            conflict('EXPENSE_HAS_REFUNDS', 'Remove linked refunds before deleting the expense.');
          if (current.type === 'REFUND' && current.originalExpenseId)
            await owned(tx, userId, current.originalExpenseId);
          const row = await tx.transaction.update({
            where: { id: entityId },
            data: {
              deletedAt: new Date(),
              description: null,
              merchantOrPayee: null,
              version: { increment: 1 },
            },
          });
          const data = tombstone(row);
          await emit(tx, userId, 'Transaction', data);
          return { data, entityId };
        }),
      );
    }),
  );
  return router;
}
