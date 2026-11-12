import { Router } from 'express';
import { DateTime } from 'luxon';
import { comparisonQuery, dashboardQuery, reportQuery } from '@nivvi/contracts';
import { Prisma } from '../generated/prisma/client.js';
import type { Deps, Tx } from '../core/types.js';
import { endpoint, principal, send } from '../core/http.js';
import {
  calculateTotals,
  monthBounds,
  percentageChange,
  sumColumns,
  totals,
  transactionWindow,
  type Sums,
  type Totals,
} from './reporting.js';

export function analyticsRouter(deps: Deps) {
  const router = Router();
  // A response's totals and breakdowns share one bounded, repeatable-read snapshot.
  const snapshot = <T>(work: (tx: Tx) => Promise<T>) =>
    deps.db.$transaction(work, { isolationLevel: 'RepeatableRead' });

  router.get(
    '/analytics/summary',
    endpoint(async (req, res) => {
      const query = reportQuery.parse(req.query);
      const { userId, timezone } = principal(req);
      const from = new Date(query.from),
        to = new Date(query.to);
      const where = transactionWindow(userId, from, to);
      const data = await snapshot(async (tx) => {
        const rows = await tx.$queryRaw<(Sums & { localStart: string })[]>(Prisma.sql`
        SELECT to_char(date_trunc(${query.groupBy}, timezone(${timezone}, t."occurredAt")), 'YYYY-MM-DD') AS "localStart",
          ${sumColumns} FROM "Transaction" t WHERE ${where} GROUP BY 1 ORDER BY 1`);
        return {
          from: query.from,
          to: query.to,
          timezone,
          groupBy: query.groupBy,
          totals: await totals(tx, userId, from, to),
          buckets: rows.map((row) => {
            const start = DateTime.fromISO(row.localStart, { zone: timezone });
            const end =
              query.groupBy === 'day'
                ? start.plus({ days: 1 })
                : query.groupBy === 'week'
                  ? start.plus({ weeks: 1 })
                  : start.plus({ months: 1 });
            return {
              localDate: row.localStart,
              from: start.toISO(),
              to: end.toISO(),
              ...calculateTotals(row),
            };
          }),
        };
      });
      send(res, data);
    }),
  );

  router.get(
    '/analytics/categories',
    endpoint(async (req, res) => {
      const query = reportQuery.parse(req.query);
      const { userId } = principal(req);
      const from = new Date(query.from),
        to = new Date(query.to);
      const where = transactionWindow(userId, from, to);
      send(
        res,
        await snapshot(async (tx) => {
          const rows = await tx.$queryRaw<
            (Sums & { categoryId: string; name: string; kind: string })[]
          >(Prisma.sql`
        SELECT t."categoryId", c.name, c.kind, ${sumColumns} FROM "Transaction" t
        JOIN "Category" c ON c.id = t."categoryId" AND c."userId" = ${userId}::uuid AND c."deletedAt" IS NULL
        WHERE ${where} GROUP BY t."categoryId", c.name, c.kind ORDER BY t."categoryId"`);
          const all = await totals(tx, userId, from, to);
          return {
            totals: all,
            denominator: { metric: 'netExpense', amountMinor: all.netExpense },
            categories: rows.map((row) => ({
              categoryId: row.categoryId,
              name: row.name,
              kind: row.kind,
              ...calculateTotals(row),
            })),
          };
        }),
      );
    }),
  );

  router.get(
    '/analytics/merchants',
    endpoint(async (req, res) => {
      const query = reportQuery.parse(req.query);
      const { userId } = principal(req);
      const from = new Date(query.from),
        to = new Date(query.to);
      const where = transactionWindow(userId, from, to);
      send(
        res,
        await snapshot(async (tx) => {
          const rows = await tx.$queryRaw<(Sums & { merchantOrPayee: string | null })[]>(Prisma.sql`
        SELECT NULLIF(btrim(t."merchantOrPayee"), '') AS "merchantOrPayee", ${sumColumns}
        FROM "Transaction" t WHERE ${where} GROUP BY 1 ORDER BY 1 NULLS LAST`);
          return {
            totals: await totals(tx, userId, from, to),
            merchants: rows.map((row) => ({
              merchantOrPayee: row.merchantOrPayee,
              label: row.merchantOrPayee ?? 'Unspecified',
              ...calculateTotals(row),
            })),
          };
        }),
      );
    }),
  );

  router.get(
    '/analytics/comparison',
    endpoint(async (req, res) => {
      const query = comparisonQuery.parse(req.query);
      const { userId, timezone } = principal(req);
      const current = monthBounds(query.month, timezone),
        previous = monthBounds(query.comparisonMonth, timezone);
      send(
        res,
        await snapshot(async (tx) => {
          const now = await totals(tx, userId, current.from, current.to);
          const baseline = await totals(tx, userId, previous.from, previous.to);
          const changes = Object.fromEntries(
            (Object.keys(now) as (keyof Totals)[]).map((metric) => [
              metric,
              {
                absolute: (BigInt(now[metric]) - BigInt(baseline[metric])).toString(),
                percentage: percentageChange(now[metric], baseline[metric]),
              },
            ]),
          );
          return {
            ...query,
            timezone,
            current: now,
            baseline,
            changes,
            percentageDenominator: 'absoluteBaseline',
          };
        }),
      );
    }),
  );

  router.get(
    '/dashboard',
    endpoint(async (req, res) => {
      const { month } = dashboardQuery.parse(req.query);
      const { userId, timezone } = principal(req);
      const { from, to } = monthBounds(month, timezone);
      send(
        res,
        await snapshot(async (tx) => {
          const all = await totals(tx, userId, from, to);
          const budget = await tx.monthlyBudget.findFirst({
            where: { userId, deletedAt: null, month: new Date(`${month}-01T00:00:00Z`) },
          });
          const recentRecords = await tx.transaction.findMany({
            where: { userId, deletedAt: null, occurredAt: { gte: from, lt: to } },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: 5,
          });
          const goals = await tx.$queryRaw<
            { count: string; targetMinor: string; contributedMinor: string }[]
          >(Prisma.sql`
        SELECT count(*)::text AS count, COALESCE(sum(g."targetMinor"),0)::text AS "targetMinor",
          COALESCE(sum(c.amount),0)::text AS "contributedMinor" FROM "SavingsGoal" g
        LEFT JOIN LATERAL (SELECT sum(gc."amountMinor") AS amount FROM "GoalContribution" gc
          WHERE gc."userId" = ${userId}::uuid AND gc."goalId" = g.id AND gc."deletedAt" IS NULL) c ON true
        WHERE g."userId" = ${userId}::uuid AND g."deletedAt" IS NULL AND g."archivedAt" IS NULL`);
          const alerts: {
            scope: string;
            categoryId: string | null;
            level: string;
            limitMinor: string;
            netExpense: string;
          }[] = [];
          const alert = (
            scope: string,
            categoryId: string | null,
            limit: bigint,
            spent: bigint,
          ) => {
            if (spent > limit || (limit > 0n && spent * 100n >= limit * 80n))
              alerts.push({
                scope,
                categoryId,
                level: spent > limit ? 'OVER_LIMIT' : 'NEAR_LIMIT',
                limitMinor: limit.toString(),
                netExpense: spent.toString(),
              });
          };
          if (budget) {
            alert('MONTH', null, budget.limitMinor, BigInt(all.netExpense));
            const allocations = await tx.$queryRaw<
              { categoryId: string; limitMinor: bigint; netExpense: string }[]
            >(Prisma.sql`
          SELECT a."categoryId", a."limitMinor", COALESCE(sum(CASE WHEN t.type = 'EXPENSE' THEN t."amountMinor"
            WHEN t.type = 'REFUND' THEN -t."amountMinor" ELSE 0 END),0)::text AS "netExpense"
          FROM "CategoryBudget" a LEFT JOIN "Transaction" t ON t."categoryId" = a."categoryId" AND ${transactionWindow(userId, from, to)}
          WHERE a."userId" = ${userId}::uuid AND a."monthlyBudgetId" = ${budget.id}::uuid AND a."deletedAt" IS NULL
          GROUP BY a.id, a."categoryId", a."limitMinor" ORDER BY a."categoryId"`);
            for (const row of allocations)
              alert('CATEGORY', row.categoryId, row.limitMinor, BigInt(row.netExpense));
          }
          return {
            month,
            timezone,
            from,
            to,
            totals: all,
            budget: budget
              ? {
                  id: budget.id,
                  limitMinor: budget.limitMinor,
                  availableMinor: (budget.limitMinor - BigInt(all.netExpense)).toString(),
                }
              : null,
            availableBudgetMinor: budget
              ? (budget.limitMinor - BigInt(all.netExpense)).toString()
              : null,
            goals: goals[0],
            recentRecords,
            alerts,
            freshness: { generatedAt: new Date(), source: 'database' },
          };
        }),
      );
    }),
  );
  return router;
}
