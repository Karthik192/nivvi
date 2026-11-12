import type { ErrorRequestHandler } from 'express';
import { z } from '@nivvi/contracts';
import type { Deps } from './types.js';
import { serialize } from './database.js';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export function notFound(): never {
  throw new ApiError(404, 'NOT_FOUND', 'Record not found.');
}
export function assertVersion(row: { id: string; version: number }, baseVersion: number) {
  if (row.version !== baseVersion)
    throw new ApiError(
      409,
      'VERSION_CONFLICT',
      'This record changed. Review the current version.',
      { entityId: row.id, currentVersion: row.version, current: serialize(row) },
    );
}
export function errorHandler(deps: Deps): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    let failure: ApiError;
    if (error instanceof ApiError) failure = error;
    else if (error instanceof z.ZodError)
      failure = new ApiError(400, 'INVALID_REQUEST', 'Check the request fields.', {
        fieldErrors: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    else if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.parse.failed'
    )
      failure = new ApiError(400, 'INVALID_JSON', 'Malformed JSON body.');
    else if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    )
      failure = new ApiError(413, 'BODY_TOO_LARGE', 'Request body exceeds the allowed size.');
    else if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      failure = new ApiError(
        409,
        'UNIQUE_CONFLICT',
        'This record conflicts with an existing record.',
      );
    else if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003')
      failure = new ApiError(422, 'INVALID_REFERENCE', 'A referenced record is unavailable.');
    else {
      failure = new ApiError(500, 'INTERNAL_ERROR', 'Unable to complete the request.');
      deps.logger.error({
        requestId: req.requestId,
        event: 'request_failed',
        errorType: error instanceof Error ? error.name : 'unknown',
      });
    }
    res.status(failure.status).json({
      error: { code: failure.code, message: failure.message, ...failure.details },
      requestId: req.requestId,
    });
  };
}
