import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from '@nivvi/contracts';
import { ApiError } from '../core/errors.js';
import { endpoint, principal, send } from '../core/http.js';
import type { Deps } from '../core/types.js';

const query = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const seq = z.string().regex(/^(0|[1-9][0-9]*)$/).max(30);

function signed(deps: Deps, value: string) {
  return createHmac('sha256', deps.config.accessSecret).update(value).digest('base64url');
}
function bootstrapCursor(deps: Deps, userId: string, watermark: string, lastId: string) {
  const body = Buffer.from(JSON.stringify({ userId, watermark, lastId })).toString('base64url');
  return `${body}.${signed(deps, body)}`;
}
function readBootstrapCursor(deps: Deps, value: string, userId: string) {
  const [body, signature, extra] = value.split('.');
  const expected = Buffer.from(signed(deps, body ?? ''));
  const actual = Buffer.from(signature ?? '');
  if (!body || extra || actual.length !== expected.length || !timingSafeEqual(expected, actual))
    throw new ApiError(400, 'INVALID_CURSOR', 'This bootstrap cursor is invalid.');
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
    if (decoded.userId !== userId || typeof decoded.lastId !== 'string' || typeof decoded.watermark !== 'string' || !seq.safeParse(decoded.watermark).success)
      throw new Error('cursor scope');
    return decoded as { userId: string; watermark: string; lastId: string };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'This bootstrap cursor is invalid.');
  }
}

export function syncRoutes(deps: Deps) {
  const router = Router();
  router.get('/sync/bootstrap', endpoint(async (req, res) => {
    const { limit, cursor } = query.parse(req.query);
    const userId = principal(req).userId;
    const state = cursor ? readBootstrapCursor(deps, cursor, userId) : null;
    const page = await deps.db.$transaction(async (tx) => {
      const watermark = state?.watermark ?? String((await tx.syncState.findUnique({ where: { userId } }))?.lastSequence ?? 0n);
      const [categories, rows] = await Promise.all([
        state ? Promise.resolve([]) : tx.category.findMany({ where: { userId, deletedAt: null }, orderBy: { id: 'asc' } }),
        tx.transaction.findMany({ where: { userId, deletedAt: null, ...(state ? { id: { gt: state.lastId } } : {}) }, orderBy: { id: 'asc' }, take: limit + 1 }),
      ]);
      const hasMore = rows.length > limit;
      const selected = rows.slice(0, limit);
      const next = hasMore && selected.length ? bootstrapCursor(deps, userId, watermark, selected[selected.length - 1]!.id) : null;
      return { categories, transactions: selected, watermark, cursor: next, hasMore };
    }, { isolationLevel: 'RepeatableRead' });
    send(res, page);
  }));

  router.get('/sync/pull', endpoint(async (req, res) => {
    const parsed = query.parse({ ...req.query, cursor: req.query.cursor ?? '0' });
    const userId = principal(req).userId;
    const after = seq.parse(parsed.cursor!);
    const page = await deps.db.$transaction(async (tx) => {
      const highWater = (await tx.syncState.findUnique({ where: { userId } }))?.lastSequence ?? 0n;
      if (BigInt(after) > highWater) throw new ApiError(400, 'INVALID_CURSOR', 'The sync cursor is ahead of this account.');
      const rows = await tx.changeEvent.findMany({ where: { userId, sequence: { gt: BigInt(after), lte: highWater } }, orderBy: { sequence: 'asc' }, take: parsed.limit + 1 });
      const hasMore = rows.length > parsed.limit;
      const events = rows.slice(0, parsed.limit);
      const nextCursor = hasMore ? String(events.at(-1)!.sequence) : String(highWater);
      return { events, nextCursor, highWater: String(highWater), hasMore };
    }, { isolationLevel: 'RepeatableRead' });
    send(res, page);
  }));
  return router;
}
