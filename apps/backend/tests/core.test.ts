import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pino from 'pino';
import supertest from 'supertest';
import {
  categoryCreate,
  transactionCreate,
  amountMinor,
  limitMinor,
  profilePatch,
} from '@nivvi/contracts';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/core/config.js';
import { canonical } from '../src/core/database.js';
import { workOneMail } from '../src/core/mail.js';
import { api, app, config, db, newUser, closeDatabase } from './helpers.js';
after(closeDatabase);
test('strict contracts reject ownership/money/metadata injection and retain exact paise', () => {
  assert.equal(amountMinor.parse('12550'), '12550');
  assert.equal(limitMinor.parse('0'), '0');
  for (const invalid of ['0', '-1', '1.5', '01', '1000000000000', 'NaN'])
    assert.equal(amountMinor.safeParse(invalid).success, false);
  assert.equal(
    categoryCreate.safeParse({
      name: 'Food',
      kind: 'EXPENSE',
      iconKey: 'food',
      userId: randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    transactionCreate.safeParse({
      id: randomUUID(),
      amountMinor: '100',
      type: 'EXPENSE',
      categoryId: randomUUID(),
      occurredAt: '2026-11-11T12:00:00+05:30',
      paymentMethod: 'CASH',
      source: 'MANUAL_WIDGET',
    }).success,
    false,
  );
  assert.equal(profilePatch.safeParse({ baseVersion: 1, timezone: 'Invalid/Zone' }).success, false);
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
});
test('production configuration requires HTTPS and SMTP instead of a fake delivery mode', () => {
  assert.throws(() => readConfig({ ...process.env, NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ ...process.env, DATABASE_URL: 'file:memory.db' }));
  assert.throws(() => readConfig({ ...process.env, ACCESS_TOKEN_SECRET: 'short' }));
});
test('liveness, readiness, body limits and unauthenticated API errors have bounded public responses', async () => {
  await api.get('/health/live').expect(200);
  await api.get('/health/ready').expect(200);
  const rejected = await api.get('/api/v1/transactions').expect(401);
  assert.ok(rejected.body.requestId);
  assert.ok(rejected.headers['x-request-id']);
  assert.equal(rejected.headers['cache-control'], 'no-store');
  const malformed = await api
    .post('/api/v1/auth/register')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  await api
    .post('/api/v1/auth/register')
    .send({ payload: 'x'.repeat(70000) })
    .expect(413);
  assert.ok(!JSON.stringify(rejected.body).includes('passwordHash'));
});
test('database runtime role cannot create schemas and SQL enforces tenant ownership and amount constraints', async () => {
  const [role] = await db.$queryRaw<
    Array<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; canCreate: boolean }>
  >`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,has_schema_privilege(current_user,'public','CREATE') AS "canCreate" FROM pg_roles r WHERE r.rolname=current_user`;
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(role.rolcreaterole, false);
  assert.equal(role.canCreate, false);
  const alice = await newUser(),
    bob = await newUser();
  const category = alice.categories.find((c) => c.kind === 'EXPENSE')!;
  const data = {
    id: randomUUID(),
    userId: alice.user.id,
    categoryId: category.id,
    amountMinor: 100n,
    currency: 'INR',
    type: 'EXPENSE',
    paymentMethod: 'CASH',
    occurredAt: new Date('2026-11-11T00:00:00Z'),
  };
  await assert.rejects(() => db.transaction.create({ data: { ...data, amountMinor: -1n } }));
  await assert.rejects(() =>
    db.transaction.create({ data: { ...data, categoryId: bob.categories[0].id } }),
  );
  await assert.rejects(() => db.transaction.create({ data: { ...data, type: 'REFUND' } }));
  await assert.rejects(() => db.transaction.create({ data: { ...data, currency: 'USD' } }));
  await assert.rejects(() =>
    db.category.update({ where: { id: category.id }, data: { version: 0 } }),
  );
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: category.id } })).version, 1);
  const budget = {
    id: randomUUID(),
    userId: alice.user.id,
    month: new Date('2026-11-01T00:00:00Z'),
    limitMinor: 0n,
  };
  await db.monthlyBudget.create({ data: budget });
  await assert.rejects(() => db.monthlyBudget.create({ data: { ...budget, id: randomUUID() } }));
  await db.monthlyBudget.update({ where: { id: budget.id }, data: { deletedAt: new Date() } });
  await db.monthlyBudget.create({ data: { ...budget, id: randomUUID() } });
});
test('mail jobs are encrypted at rest and local delivery is truthfully labelled', async () => {
  const user = await newUser();
  const target = await db.job.findFirstOrThrow({
    where: { userId: user.user.id, type: 'ACCOUNT_EMAIL' },
  });
  assert.ok(!JSON.stringify(target.payload).includes(user.email));
  const deps = { db, config, logger: pino({ level: 'silent' }) };
  for (let count = 0; count < 200; count++) {
    if ((await db.job.findUniqueOrThrow({ where: { id: target.id } })).status === 'DELIVERED')
      break;
    assert.equal(await workOneMail(deps), true);
  }
  const delivered = await db.job.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(delivered.status, 'DELIVERED');
  assert.deepEqual(delivered.payload, { redacted: true });
  const file = JSON.parse(
    await readFile(join(config.mailDirectory, `${target.id}.json`), 'utf8'),
  ) as { delivery: string; to: string; text: string };
  assert.equal(file.delivery, 'LOCAL_FILE_ONLY_NOT_SENT');
  assert.equal(file.to, user.email);
  assert.ok(file.text.includes('#token='));
});
test('auth endpoints enforce an IP rate limit outside the test-only limiter bypass', async () => {
  const restricted = supertest(
    createApp({ db, config: { ...config, env: 'development' }, logger: pino({ level: 'silent' }) }),
  );
  for (let count = 0; count < 30; count++)
    await restricted
      .post('/api/v1/auth/password/forgot')
      .send({ email: `missing-${count}@example.test` })
      .expect(202);
  const response = await restricted
    .post('/api/v1/auth/password/forgot')
    .send({ email: 'missing@example.test' })
    .expect(429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  assert.ok(response.headers['retry-after']);
});
test('mail failures retry with a bound and recover an expired final lease', async () => {
  const user = await newUser();
  const job = await db.job.create({
    data: {
      userId: user.user.id,
      type: 'ACCOUNT_EMAIL',
      dedupeKey: randomUUID(),
      payload: { invalid: true },
      createdAt: new Date('2000-01-01'),
      nextAttemptAt: new Date('2000-01-01'),
    },
  });
  const deps = { db, config, logger: pino({ level: 'silent' }) };
  for (let attempt = 1; attempt <= 5; attempt++) {
    await db.job.update({ where: { id: job.id }, data: { nextAttemptAt: new Date('2000-01-01') } });
    await workOneMail(deps);
    const current = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(current.attempts, attempt);
    assert.equal(current.status, attempt === 5 ? 'FAILED' : 'RETRY');
    assert.equal(current.lockedUntil, null);
  }
  await db.job.update({
    where: { id: job.id },
    data: { status: 'RETRY', lockedUntil: new Date('2000-01-01') },
  });
  await workOneMail(deps);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, 'FAILED');
});
test('server does not accept a client-supplied correlation ID', async () => {
  const result = await supertest(app)
    .get('/health/live')
    .set('X-Request-Id', 'attacker-controlled')
    .expect(200);
  assert.notEqual(result.headers['x-request-id'], 'attacker-controlled');
});
