import { Router } from 'express';
import { categoryCreate, categoryPatch, categoryQuery } from '@nivvi/contracts';
import { emit, mutate } from '../core/database.js';
import { assertVersion } from '../core/errors.js';
import { endpoint, id, principal, send, sendMutation } from '../core/http.js';
import type { Deps } from '../core/types.js';
import { category, conflict, normalizeName, parse, path } from './common.js';

export function categoryRoutes(deps: Deps) {
  const router = Router();
  router.get(
    '/categories',
    endpoint(async (req, res) => {
      const query = parse(categoryQuery, req.query);
      send(
        res,
        await deps.db.category.findMany({
          where: {
            userId: principal(req).userId,
            deletedAt: null,
            ...(query.kind && { kind: query.kind }),
            ...(query.includeArchived === 'false' && { archivedAt: null }),
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      );
    }),
  );
  router.post(
    '/categories',
    endpoint(async (req, res) => {
      const body = parse(categoryCreate, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const normalizedName = normalizeName(body.name);
          if (await tx.category.findFirst({ where: { userId, kind: body.kind, normalizedName } }))
            conflict(
              'CATEGORY_NAME_RESERVED',
              'Restore the existing category or use a distinct name.',
            );
          if (body.id && (await tx.category.findUnique({ where: { id: body.id } })))
            conflict('ID_UNAVAILABLE', 'This identifier has already been used.');
          const row = await tx.category.create({ data: { ...body, normalizedName, userId } });
          await emit(tx, userId, 'Category', row);
          return { data: row, status: 201, entityId: row.id };
        }),
      );
    }),
  );
  router.patch(
    '/categories/:id',
    endpoint(async (req, res) => {
      const entityId = id(path(req));
      const { baseVersion, archived, ...body } = parse(categoryPatch, req.body);
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const current = await category(tx, userId, entityId, undefined, true);
          assertVersion(current, baseVersion);
          const normalizedName = body.name === undefined ? undefined : normalizeName(body.name);
          if (
            normalizedName &&
            (await tx.category.findFirst({
              where: { userId, kind: current.kind, normalizedName, id: { not: entityId } },
            }))
          )
            conflict('CATEGORY_NAME_RESERVED', 'This category name is reserved.');
          const row = await tx.category.update({
            where: { id: entityId },
            data: {
              ...body,
              ...(normalizedName !== undefined && { normalizedName }),
              ...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
              version: { increment: 1 },
            },
          });
          await emit(tx, userId, 'Category', row);
          return { data: row, entityId };
        }),
      );
    }),
  );
  return router;
}
