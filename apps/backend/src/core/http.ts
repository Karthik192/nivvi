import type { Request, Response, RequestHandler } from 'express';
import { uuid } from '@nivvi/contracts';
import { ApiError } from './errors.js';
import { serialize } from './database.js';
export const id = (value: unknown) => uuid.parse(value);
export const principal = (req: Request) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return req.auth;
};
export const endpoint =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
export const send = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ data: serialize(data) });
export const sendPage = (res: Response, result: unknown) => res.json(serialize(result));
export const sendMutation = (res: Response, result: { status: number; body: unknown }) =>
  res.status(result.status).json(result.body);
