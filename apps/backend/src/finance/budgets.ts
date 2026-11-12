import { Router } from 'express';
import {
  allocationCreate,
  allocationPatch,
  budgetCreate,
  budgetPatch,
  budgetQuery,
  deleteQuery,
} from '@nivvi/contracts';
import { emit, mutate } from '../core/database.js';
import { assertVersion, notFound } from '../core/errors.js';
import { endpoint, id, principal, send, sendMutation, sendPage } from '../core/http.js';
import { getPage } from '../core/pagination.js';
import { monthBounds, totals } from '../analytics/reporting.js';
import type { Deps, Tx } from '../core/types.js';
import {
  budgetRecord,
  category,
  conflict,
  monthDate,
  parse,
  path,
  semantic,
  tombstone,
} from './common.js';

async function owned(tx: Tx, userId: string, entityId: string) {
  const row = await tx.monthlyBudget.findFirst({
    where: { id: entityId, userId, deletedAt: null },
  });
  if (!row) throw notFound();
  return row;
}

async function allocated(tx: Tx, userId: string, monthlyBudgetId: string, exclude?: string) {
  return (
    (
      await tx.categoryBudget.aggregate({
        where: {
          userId,
          monthlyBudgetId,
          deletedAt: null,
          ...(exclude && { id: { not: exclude } }),
        },
        _sum: { limitMinor: true },
      })
    )._sum.limitMinor ?? 0n
  );
}

export function budgetRoutes(deps: Deps) {
  const router = Router();
  router.get(
    '/budgets',
    endpoint(async (req, res) => {
      const query = parse(budgetQuery, req.query);
      if (query.from && query.to && query.from >= query.to)
        semantic('Use an increasing month window.');
      const { userId } = principal(req);
      const page = getPage(req, deps, userId, query);
      const rows = await deps.db.monthlyBudget.findMany({
        where: {
          userId,
          deletedAt: null,
          ...((query.from || query.to) && {
            month: {
              ...(query.from && { gte: monthDate(query.from) }),
              ...(query.to && { lt: monthDate(query.to) }),
            },
          }),
        },
        include: { allocations: { where: { userId, deletedAt: null }, orderBy: { id: 'asc' } } },
        skip: page.skip,
        take: page.take,
        orderBy: [{ month: 'desc' }, { id: 'desc' }],
      });
      sendPage(res, page.result(rows.map(budgetRecord)));
    }),
  );
  router.get(
    '/budgets/:id',
    endpoint(async (req, res) => {
      const { userId, timezone } = principal(req);
      const row = await owned(deps.db, userId, id(path(req)));
      const month = row.month.toISOString().slice(0, 7);
      const bounds = monthBounds(month, timezone);
      const spending = await totals(deps.db, userId, bounds.from, bounds.to);
      const net = BigInt(spending.netExpense);
      const allocations = await deps.db.categoryBudget.findMany({
        where: { userId, monthlyBudgetId: row.id, deletedAt: null },
        orderBy: { id: 'asc' },
      });
      // Negative period net expense is valid when refunds relate to earlier purchases.
      const progressBasisPoints = row.limitMinor === 0n ? null : (net * 10000n) / row.limitMinor;
      send(res, {
        ...budgetRecord(row),
        allocations,
        spending,
        remainingMinor: row.limitMinor - net,
        progressBasisPoints,
        nearLimit: row.limitMinor > 0n && net * 100n >= row.limitMinor * 80n,
        overLimit: net > row.limitMinor,
      });
    }),
  );
  router.post(
    '/budgets',
    endpoint(async (req, res) => {
      const body = parse(budgetCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const month = monthDate(body.month);
          if (await tx.monthlyBudget.findUnique({ where: { id: body.id } }))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          if (await tx.monthlyBudget.findFirst({ where: { userId, month, deletedAt: null } }))
            conflict('BUDGET_EXISTS', 'This month already has a budget.');
          const row = budgetRecord(
            await tx.monthlyBudget.create({
              data: { ...body, month, userId, limitMinor: BigInt(body.limitMinor) },
            }),
          );
          await emit(tx, userId, 'MonthlyBudget', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/budgets/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion, limitMinor } = parse(budgetPatch, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(budgetRecord(current), baseVersion);
          const limit = BigInt(limitMinor);
          if ((await allocated(tx, userId, entityId)) > limit)
            conflict(
              'ALLOCATION_LIMIT_EXCEEDED',
              'Overall limit cannot be less than its category allocations.',
            );
          const row = budgetRecord(
            await tx.monthlyBudget.update({
              where: { id: entityId },
              data: { limitMinor: limit, version: { increment: 1 } },
            }),
          );
          await emit(tx, userId, 'MonthlyBudget', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  router.delete(
    '/budgets/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion } = parse(deleteQuery, req.query);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(budgetRecord(current), baseVersion);
          const deletedAt = new Date();
          const children = await tx.categoryBudget.findMany({
            where: { userId, monthlyBudgetId: entityId, deletedAt: null },
            orderBy: { id: 'asc' },
          });
          for (const child of children) {
            const row = await tx.categoryBudget.update({
              where: { id: child.id },
              data: { deletedAt, version: { increment: 1 } },
            });
            await emit(tx, userId, 'CategoryBudget', tombstone(row));
          }
          const row = await tx.monthlyBudget.update({
            where: { id: entityId },
            data: { deletedAt, version: { increment: 1 } },
          });
          const data = tombstone(row);
          await emit(tx, userId, 'MonthlyBudget', data);
          return { data, entityId };
        }),
      );
    }),
  );
  router.post(
    '/budgets/:id/categories',
    endpoint(async (req, res) => {
      const monthlyBudgetId = id(path(req));
      const body = parse(allocationCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const parent = await owned(tx, userId, monthlyBudgetId);
          await category(tx, userId, body.categoryId, 'EXPENSE');
          if (await tx.categoryBudget.findUnique({ where: { id: body.id } }))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          if (
            await tx.categoryBudget.findFirst({
              where: { userId, monthlyBudgetId, categoryId: body.categoryId, deletedAt: null },
            })
          )
            conflict('ALLOCATION_EXISTS', 'This category already has an allocation.');
          if (
            (await allocated(tx, userId, monthlyBudgetId)) + BigInt(body.limitMinor) >
            parent.limitMinor
          )
            conflict(
              'ALLOCATION_LIMIT_EXCEEDED',
              'Category allocations cannot exceed the monthly limit.',
            );
          const row = await tx.categoryBudget.create({
            data: { ...body, userId, monthlyBudgetId, limitMinor: BigInt(body.limitMinor) },
          });
          await emit(tx, userId, 'CategoryBudget', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/budgets/:id/categories/:allocationId',
    endpoint(async (req, res) => {
      const monthlyBudgetId = id(path(req));
      const entityId = id(path(req, 'allocationId'));
      const { baseVersion, limitMinor } = parse(allocationPatch, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const parent = await owned(tx, userId, monthlyBudgetId);
          const current = await tx.categoryBudget.findFirst({
            where: { id: entityId, userId, monthlyBudgetId, deletedAt: null },
          });
          if (!current) throw notFound();
          assertVersion(current, baseVersion);
          if (
            (await allocated(tx, userId, monthlyBudgetId, entityId)) + BigInt(limitMinor) >
            parent.limitMinor
          )
            conflict(
              'ALLOCATION_LIMIT_EXCEEDED',
              'Category allocations cannot exceed the monthly limit.',
            );
          const row = await tx.categoryBudget.update({
            where: { id: entityId },
            data: { limitMinor: BigInt(limitMinor), version: { increment: 1 } },
          });
          await emit(tx, userId, 'CategoryBudget', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  router.delete(
    '/budgets/:id/categories/:allocationId',
    endpoint(async (req, res) => {
      const monthlyBudgetId = id(path(req));
      const entityId = id(path(req, 'allocationId'));
      const { baseVersion } = parse(deleteQuery, req.query);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          await owned(tx, userId, monthlyBudgetId);
          const current = await tx.categoryBudget.findFirst({
            where: { id: entityId, userId, monthlyBudgetId, deletedAt: null },
          });
          if (!current) throw notFound();
          assertVersion(current, baseVersion);
          const row = await tx.categoryBudget.update({
            where: { id: entityId },
            data: { deletedAt: new Date(), version: { increment: 1 } },
          });
          const data = tombstone(row);
          await emit(tx, userId, 'CategoryBudget', data);
          return { data, entityId };
        }),
      );
    }),
  );
  return router;
}
