import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/core/config.js';
import { createDatabase } from '../src/core/database.js';
import { decryptMail } from '../src/core/mail.js';
export const config = readConfig(process.env);
if (
  config.env !== 'test' ||
  new URL(config.databaseUrl).pathname !== '/nivvi_test' ||
  config.mailMode !== 'file'
)
  throw new Error('Tests require the dedicated nivvi_test database and local file mail.');
export const db = createDatabase(config.databaseUrl);
export const app = createApp({ db, config, logger: pino({ level: 'silent' }) });
export const api = supertest(app);
export const operationId = () => randomUUID();
export async function newUser() {
  const email = `${randomUUID()}@example.test`;
  const password = 'TestOnlyPassword123!';
  const response = await api
    .post('/api/v1/auth/register')
    .send({ email, password, displayName: 'Test user', installationId: 'test' })
    .expect(201);
  const { user, accessToken, refreshToken } = response.body.data;
  const categories = (
    await api.get('/api/v1/categories').auth(accessToken, { type: 'bearer' }).expect(200)
  ).body.data;
  return {
    user,
    token: accessToken as string,
    accessToken: accessToken as string,
    refreshToken: refreshToken as string,
    email,
    password,
    categories: categories as Array<{ id: string; name: string; kind: string }>,
  };
}
export const closeDatabase = () => db.$disconnect();
export async function readMailJobs(userId: string) {
  return (
    await db.job.findMany({
      where: { userId, type: 'ACCOUNT_EMAIL', status: { in: ['PENDING', 'RETRY'] } },
      orderBy: { createdAt: 'asc' },
    })
  ).map((job) => decryptMail(config, job.payload));
}
