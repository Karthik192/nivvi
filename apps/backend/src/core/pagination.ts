import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Deps } from './types.js';
import { canonical } from './database.js';
import { ApiError } from './errors.js';
export function getPage(
  req: Request,
  deps: Deps,
  userId: string,
  query: { cursor?: string; limit: number },
  scope?: string,
) {
  const context = canonical({
    userId,
    path: scope ?? req.baseUrl + req.path,
    query: { ...req.query, cursor: undefined },
  });
  const mac = (v: string) =>
    createHmac('sha256', deps.config.accessSecret).update(context).update(v).digest('base64url');
  let skip = 0;
  if (query.cursor) {
    const [encoded, signature] = query.cursor.split('.');
    const expected = Buffer.from(mac(encoded ?? ''));
    const supplied = Buffer.from(signature ?? '');
    if (!encoded || supplied.length !== expected.length || !timingSafeEqual(expected, supplied))
      throw new ApiError(400, 'INVALID_CURSOR', 'This cursor does not match the requested list.');
    skip = Number(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(skip) || skip < 0 || skip > 100000)
      throw new ApiError(400, 'INVALID_CURSOR', 'Cursor range is not supported.');
  }
  return {
    skip,
    take: query.limit + 1,
    result: <T>(rows: T[]) => {
      const hasMore = rows.length > query.limit;
      const encoded = Buffer.from(String(skip + query.limit)).toString('base64url');
      return {
        data: rows.slice(0, query.limit),
        page: { hasMore, nextCursor: hasMore ? `${encoded}.${mac(encoded)}` : null },
      };
    },
  };
}
