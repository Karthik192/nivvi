import { Router } from 'express';
import {
  contributionCreate,
  contributionPatch,
  deleteQuery,
  goalCreate,
  goalDeleteQuery,
  goalPatch,
  goalQuery,
  pagination,
} from '@nivvi/contracts';
import { emit, mutate } from '../core/database.js';
import { assertVersion, notFound } from '../core/errors.js';
import { endpoint, id, principal, send, sendMutation, sendPage } from '../core/http.js';
import { getPage } from '../core/pagination.js';
import type { Deps, Tx } from '../core/types.js';
import { bounded, conflict, goalRecord, parse, path, semantic, tombstone } from './common.js';

async function owned(tx: Tx, userId: string, entityId: string) {
  const row = await tx.savingsGoal.findFirst({ where: { id: entityId, userId, deletedAt: null } });
  if (!row) throw notFound();
  return row;
}

async function saved(tx: Tx, userId: string, goalId: string, exclude?: string) {
  return (
    (
      await tx.goalContribution.aggregate({
        where: { userId, goalId, deletedAt: null, ...(exclude && { id: { not: exclude } }) },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor ?? 0n
  );
}

export function goalRoutes(deps: Deps) {
  const router = Router();
  router.get(
    '/goals',
    endpoint(async (req, res) => {
      const query = parse(goalQuery, req.query);
      const { userId } = principal(req);
      const page = getPage(req, deps, userId, query);
      const rows = await deps.db.savingsGoal.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(query.includeArchived === 'false' && { archivedAt: null }),
        },
        skip: page.skip,
        take: page.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const result = page.result(rows);
      const contributions = result.data.length
        ? await deps.db.goalContribution.groupBy({
            by: ['goalId'],
            where: { userId, deletedAt: null, goalId: { in: result.data.map((row) => row.id) } },
            _sum: { amountMinor: true },
          })
        : [];
      const savedByGoal = new Map(
        contributions.map((row) => [row.goalId, row._sum.amountMinor ?? 0n]),
      );
      sendPage(res, {
        ...result,
        data: result.data.map((row) => ({
          ...goalRecord(row),
          savedMinor: savedByGoal.get(row.id) ?? 0n,
        })),
      });
    }),
  );
  router.get(
    '/goals/:id',
    endpoint(async (req, res) => {
      const { userId } = principal(req);
      const row = await owned(deps.db, userId, id(path(req)));
      const savedMinor = await saved(deps.db, userId, row.id);
      send(res, { ...goalRecord(row), savedMinor, completed: savedMinor >= row.targetMinor });
    }),
  );
  router.post(
    '/goals',
    endpoint(async (req, res) => {
      const body = parse(goalCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          if (await tx.savingsGoal.findUnique({ where: { id: body.id } }))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          const row = goalRecord(
            await tx.savingsGoal.create({
              data: {
                ...body,
                userId,
                targetMinor: BigInt(body.targetMinor),
                targetDate: body.targetDate ? new Date(body.targetDate) : null,
              },
            }),
          );
          await emit(tx, userId, 'SavingsGoal', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/goals/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion, archived, targetMinor, targetDate, ...body } = parse(
        goalPatch,
        req.body,
      );
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(goalRecord(current), baseVersion);
          const row = goalRecord(
            await tx.savingsGoal.update({
              where: { id: entityId },
              data: {
                ...body,
                ...(targetMinor !== undefined && { targetMinor: BigInt(targetMinor) }),
                ...(targetDate !== undefined && {
                  targetDate: targetDate ? new Date(targetDate) : null,
                }),
                ...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
                version: { increment: 1 },
              },
            }),
          );
          await emit(tx, userId, 'SavingsGoal', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  router.delete(
    '/goals/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion, confirmContributions } = parse(goalDeleteQuery, req.query);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await owned(tx, userId, entityId);
          assertVersion(goalRecord(current), baseVersion);
          const children = await tx.goalContribution.findMany({
            where: { userId, goalId: entityId, deletedAt: null },
            orderBy: { id: 'asc' },
          });
          if (children.length && confirmContributions !== 'true')
            conflict(
              'CONTRIBUTIONS_CONFIRMATION_REQUIRED',
              'Confirm deletion of this goal and its contributions.',
            );
          const deletedAt = new Date();
          for (const child of children) {
            const row = await tx.goalContribution.update({
              where: { id: child.id },
              data: { deletedAt, note: null, version: { increment: 1 } },
            });
            await emit(tx, userId, 'GoalContribution', tombstone(row));
          }
          const row = await tx.savingsGoal.update({
            where: { id: entityId },
            data: { deletedAt, name: 'Deleted goal', version: { increment: 1 } },
          });
          const data = tombstone(row);
          await emit(tx, userId, 'SavingsGoal', data);
          return { data, entityId };
        }),
      );
    }),
  );
  router.get(
    '/goals/:id/contributions',
    endpoint(async (req, res) => {
      const goalId = id(path(req));
      const { userId } = principal(req);
      await owned(deps.db, userId, goalId);
      const query = parse(pagination.strict(), req.query);
      const page = getPage(req, deps, userId, query, goalId);
      sendPage(
        res,
        page.result(
          await deps.db.goalContribution.findMany({
            where: { userId, goalId, deletedAt: null },
            skip: page.skip,
            take: page.take,
            orderBy: [{ contributedAt: 'desc' }, { id: 'desc' }],
          }),
        ),
      );
    }),
  );
  router.post(
    '/goals/:id/contributions',
    endpoint(async (req, res) => {
      const goalId = id(path(req));
      const body = parse(contributionCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const parent = await owned(tx, userId, goalId);
          if (parent.archivedAt) semantic('Restore the archived goal before adding contributions.');
          if (await tx.goalContribution.findUnique({ where: { id: body.id } }))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          bounded((await saved(tx, userId, goalId)) + BigInt(body.amountMinor));
          const row = await tx.goalContribution.create({
            data: {
              ...body,
              goalId,
              userId,
              amountMinor: BigInt(body.amountMinor),
              contributedAt: new Date(body.contributedAt),
            },
          });
          await emit(tx, userId, 'GoalContribution', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/goals/:id/contributions/:contributionId',
    endpoint(async (req, res) => {
      const goalId = id(path(req));
      const entityId = id(path(req, 'contributionId'));
      const { baseVersion, amountMinor, contributedAt, ...body } = parse(
        contributionPatch,
        req.body,
      );
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          await owned(tx, userId, goalId);
          const current = await tx.goalContribution.findFirst({
            where: { id: entityId, userId, goalId, deletedAt: null },
          });
          if (!current) throw notFound();
          assertVersion(current, baseVersion);
          const amount = amountMinor === undefined ? current.amountMinor : BigInt(amountMinor);
          bounded((await saved(tx, userId, goalId, entityId)) + amount);
          const row = await tx.goalContribution.update({
            where: { id: entityId },
            data: {
              ...body,
              amountMinor: amount,
              ...(contributedAt && { contributedAt: new Date(contributedAt) }),
              version: { increment: 1 },
            },
          });
          await emit(tx, userId, 'GoalContribution', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  router.delete(
    '/goals/:id/contributions/:contributionId',
    endpoint(async (req, res) => {
      const goalId = id(path(req));
      const entityId = id(path(req, 'contributionId'));
      const { baseVersion } = parse(deleteQuery, req.query);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          await owned(tx, userId, goalId);
          const current = await tx.goalContribution.findFirst({
            where: { id: entityId, userId, goalId, deletedAt: null },
          });
          if (!current) throw notFound();
          assertVersion(current, baseVersion);
          const row = await tx.goalContribution.update({
            where: { id: entityId },
            data: { deletedAt: new Date(), note: null, version: { increment: 1 } },
          });
          const data = tombstone(row);
          await emit(tx, userId, 'GoalContribution', data);
          return { data, entityId };
        }),
      );
    }),
  );
  return router;
}
