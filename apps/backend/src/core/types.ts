import type { Logger } from 'pino';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import type { Config } from './config.js';
export type Tx = Prisma.TransactionClient;
export interface Deps {
  db: PrismaClient;
  config: Config;
  logger: Logger;
}
export interface Principal {
  userId: string;
  sessionId: string;
  timezone: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    auth?: Principal;
    requestId: string;
  }
}
