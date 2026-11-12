import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { budgetPlan, month } from '@nivvi/contracts';
import { mutate, emit } from '../core/database.js';
import { endpoint, sendMutation } from '../core/http.js';
import { ApiError } from '../core/errors.js';
import type { Deps } from '../core/types.js';
import { category, budgetRecord, monthDate, tombstone, semantic } from './common.js';
export function planRoutes(deps: Deps) {
  const router = Router();
  router.put(
    '/budget-plans/:month',
    endpoint(async (req, res) => {
      const selected = month.parse(req.params.month);
      const body = budgetPlan.parse(req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await tx.monthlyBudget.findFirst({
            where: { userId, month: monthDate(selected), deletedAt: null },
          });
          const children = current
            ? await tx.categoryBudget.findMany({
                where: { userId, monthlyBudgetId: current.id, deletedAt: null },
                orderBy: { id: 'asc' },
              })
            : [];
          const expected = [...body.baseAllocations].sort((a, b) => a.id.localeCompare(b.id));
          if (
            (current?.version ?? null) !== body.baseVersion ||
            JSON.stringify(children.map((r) => ({ id: r.id, version: r.version }))) !==
              JSON.stringify(expected)
          )
            throw new ApiError(
              409,
              'VERSION_CONFLICT',
              'This plan changed. Reload and review the latest plan before saving.',
            );
          if (new Set(body.allocations.map((r) => r.categoryId)).size !== body.allocations.length)
            semantic('Each category can appear once.');
          if (
            body.allocations.reduce((sum, r) => sum + BigInt(r.limitMinor), 0n) >
            BigInt(body.limitMinor)
          )
            semantic('Category allocations cannot exceed the monthly limit.');
          for (const allocation of body.allocations)
            await category(
              tx,
              userId,
              allocation.categoryId,
              'EXPENSE',
              children.some((c) => c.categoryId === allocation.categoryId),
            );
          const parent = current
            ? await tx.monthlyBudget.update({
                where: { id: current.id },
                data: { limitMinor: BigInt(body.limitMinor), version: { increment: 1 } },
              })
            : await tx.monthlyBudget.create({
                data: {
                  id: randomUUID(),
                  userId,
                  month: monthDate(selected),
                  limitMinor: BigInt(body.limitMinor),
                },
              });
          await emit(tx, userId, 'MonthlyBudget', budgetRecord(parent));
          for (const old of children) {
            if (!body.allocations.some((a) => a.categoryId === old.categoryId)) {
              const deleted = await tx.categoryBudget.update({
                where: { id: old.id },
                data: { deletedAt: new Date(), version: { increment: 1 } },
              });
              await emit(tx, userId, 'CategoryBudget', tombstone(deleted));
            }
          }
          const allocations = [];
          for (const allocation of body.allocations) {
            const old = children.find((c) => c.categoryId === allocation.categoryId);
            const row = old
              ? await tx.categoryBudget.update({
                  where: { id: old.id },
                  data: { limitMinor: BigInt(allocation.limitMinor), version: { increment: 1 } },
                })
              : await tx.categoryBudget.create({
                  data: {
                    id: randomUUID(),
                    userId,
                    monthlyBudgetId: parent.id,
                    categoryId: allocation.categoryId,
                    limitMinor: BigInt(allocation.limitMinor),
                  },
                });
            await emit(tx, userId, 'CategoryBudget', row);
            allocations.push(row);
          }
          return {
            data: { ...budgetRecord(parent), allocations },
            status: current ? 200 : 201,
            entityId: parent.id,
          };
        }),
      );
    }),
  );
  return router;
}
