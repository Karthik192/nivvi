import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { db, api, newUser, closeDatabase } from './helpers.js';
import {
  monthBounds,
  percentageChange,
  totals,
  validateWindow,
} from '../src/analytics/reporting.js';
import { makeOpenApi } from '../src/openapi.js';
import * as contracts from '@nivvi/contracts';
import { publicSchemas, z } from '@nivvi/contracts';

after(() => closeDatabase());

test('local month windows preserve DST and reject invalid windows', () => {
  const march = monthBounds('2026-03', 'America/New_York');
  assert.equal(march.from.toISOString(), '2026-03-01T05:00:00.000Z');
  assert.equal(march.to.toISOString(), '2026-04-01T04:00:00.000Z');
  assert.throws(() => monthBounds('2026-13', 'UTC'));
  assert.throws(() => monthBounds('2026-03', 'Invalid/Zone'));
  assert.throws(() => validateWindow(new Date('2026-01-01'), new Date('2026-01-01')));
  assert.throws(() => validateWindow(new Date('2024-01-01'), new Date('2026-01-01')));
  validateWindow(new Date(0), new Date(366 * 86400000));
  assert.throws(() => validateWindow(new Date(0), new Date(366 * 86400000 + 1)));
  assert.equal(percentageChange('100', '0'), null);
  assert.equal(percentageChange('-50', '-100'), '50.00');
  assert.equal(percentageChange('-150', '-100'), '-50.00');
});

test('weekly database buckets begin Monday and preserve DST offsets', async () => {
  const { user, token } = await newUser();
  await db.user.update({ where: { id: user.id }, data: { timezone: 'America/New_York' } });
  const category = await db.category.findFirstOrThrow({
    where: { userId: user.id, kind: 'EXPENSE' },
  });
  await db.transaction.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      categoryId: category.id,
      amountMinor: 1n,
      type: 'EXPENSE',
      paymentMethod: 'CASH',
      occurredAt: new Date('2026-03-08T07:00:00Z'),
    },
  });
  const response = await api
    .get('/api/v1/analytics/summary')
    .auth(token, { type: 'bearer' })
    .query({ from: '2026-03-01T00:00:00-05:00', to: '2026-04-01T00:00:00-04:00', groupBy: 'week' })
    .expect(200);
  assert.equal(response.body.data.buckets[0].localDate, '2026-03-02');
  assert.equal(response.body.data.buckets[0].from, '2026-03-02T00:00:00.000-05:00');
  assert.equal(response.body.data.buckets[0].to, '2026-03-09T00:00:00.000-04:00');
});

test('database reports exact grouped paise, dated refunds, isolation and soft deletion', async () => {
  const { user, token } = await newUser();
  const foreign = await newUser();
  const categories = await db.category.findMany({ where: { userId: user.id } });
  const expense = categories.find((c) => c.kind === 'EXPENSE')!;
  const income = categories.find((c) => c.kind === 'INCOME')!;
  const originalId = randomUUID();
  const transaction = (
    amountMinor: bigint,
    type: string,
    occurredAt: string,
    extra: { originalExpenseId?: string; merchantOrPayee?: string; deletedAt?: Date } = {},
  ) =>
    db.transaction.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        categoryId: type === 'INCOME' ? income.id : expense.id,
        amountMinor,
        type,
        paymentMethod: 'UPI',
        occurredAt: new Date(occurredAt),
        ...extra,
      },
    });
  await db.transaction.create({
    data: {
      id: originalId,
      userId: user.id,
      categoryId: expense.id,
      amountMinor: 999999999999n,
      type: 'EXPENSE',
      paymentMethod: 'CASH',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  await transaction(999999999999n, 'REFUND', '2026-02-03T00:00:00Z', {
    originalExpenseId: originalId,
  });
  await transaction(100n, 'EXPENSE', '2026-02-03T00:00:00Z', { merchantOrPayee: 'Market' });
  await transaction(50n, 'INCOME', '2026-02-04T00:00:00Z');
  await transaction(777n, 'EXPENSE', '2026-02-04T00:00:00Z', { deletedAt: new Date() });
  const foreignCategory = await db.category.findFirstOrThrow({
    where: { userId: foreign.user.id, kind: 'EXPENSE' },
  });
  await db.transaction.create({
    data: {
      id: randomUUID(),
      userId: foreign.user.id,
      categoryId: foreignCategory.id,
      amountMinor: 555n,
      type: 'EXPENSE',
      paymentMethod: 'CASH',
      occurredAt: new Date('2026-02-03T00:00:00Z'),
    },
  });
  const goal = await db.savingsGoal.create({
    data: { id: randomUUID(), userId: user.id, name: 'Trip', targetMinor: 1000n },
  });
  await db.goalContribution.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      goalId: goal.id,
      amountMinor: 2000n,
      contributedAt: new Date('2026-02-04T00:00:00Z'),
    },
  });
  const window = { from: '2026-02-01T00:00:00Z', to: '2026-03-01T00:00:00Z' };
  const expected = {
    grossExpense: '100',
    refunds: '999999999999',
    netExpense: '-999999999899',
    income: '50',
    surplus: '999999999949',
  };
  assert.deepEqual(await totals(db, user.id, new Date(window.from), new Date(window.to)), expected);
  for (const route of ['summary', 'categories', 'merchants']) {
    const response = await api
      .get(`/api/v1/analytics/${route}`)
      .auth(token, { type: 'bearer' })
      .query(window)
      .expect(200);
    assert.deepEqual(response.body.data.totals, expected);
    if (route === 'categories') {
      assert.equal(
        response.body.data.categories.find(
          (c: { categoryId: string }) => c.categoryId === expense.id,
        ).netExpense,
        expected.netExpense,
      );
      assert.equal(response.body.data.denominator.amountMinor, expected.netExpense);
    }
    if (route === 'merchants')
      assert.equal(
        response.body.data.merchants.find((m: { label: string }) => m.label === 'Unspecified')
          .refunds,
        expected.refunds,
      );
  }
  const dashboard = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-02' })
    .expect(200);
  assert.deepEqual(dashboard.body.data.totals, expected);
  assert.equal(dashboard.body.data.availableBudgetMinor, null);
  assert.equal(dashboard.body.data.goals.contributedMinor, '2000');
  const comparison = await api
    .get('/api/v1/analytics/comparison')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-03', comparisonMonth: '2026-02' })
    .expect(200);
  assert.equal(comparison.body.data.changes.netExpense.absolute, '999999999899');
  assert.equal(comparison.body.data.changes.netExpense.percentage, '100.00');
});

test('dashboard distinguishes zero budget, derives alerts and caps recent records', async () => {
  const { user, token } = await newUser();
  const category = await db.category.findFirstOrThrow({
    where: { userId: user.id, kind: 'EXPENSE' },
  });
  const budget = await db.monthlyBudget.create({
    data: { id: randomUUID(), userId: user.id, month: new Date('2026-05-01'), limitMinor: 0n },
  });
  await db.transaction.createMany({
    data: Array.from({ length: 7 }, () => ({
      id: randomUUID(),
      userId: user.id,
      categoryId: category.id,
      type: 'EXPENSE',
      amountMinor: 10n,
      paymentMethod: 'CASH',
      occurredAt: new Date('2026-05-02'),
    })),
  });
  const response = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-05' })
    .expect(200);
  assert.equal(response.body.data.availableBudgetMinor, '-70');
  assert.equal(response.body.data.budget.limitMinor, '0');
  assert.equal(response.body.data.alerts[0].level, 'OVER_LIMIT');
  assert.equal(response.body.data.recentRecords.length, 5);
  await db.monthlyBudget.update({ where: { id: budget.id }, data: { limitMinor: 80n } });
  await db.categoryBudget.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      monthlyBudgetId: budget.id,
      categoryId: category.id,
      limitMinor: 80n,
    },
  });
  const near = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-05' })
    .expect(200);
  assert.equal(near.body.data.alerts[0].level, 'NEAR_LIMIT');
  assert.equal(near.body.data.alerts[1].categoryId, category.id);
  assert.equal(near.body.data.alerts[1].netExpense, '70');
});

test('month is half-open in local time and archived categories retain history', async () => {
  const { user, token } = await newUser();
  const category = await db.category.findFirstOrThrow({
    where: { userId: user.id, kind: 'EXPENSE' },
  });
  await db.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } });
  await db.transaction.createMany({
    data: [
      '2026-01-31T18:29:59.999Z',
      '2026-01-31T18:30:00Z',
      '2026-02-28T18:29:59.999Z',
      '2026-02-28T18:30:00Z',
    ].map((instant) => ({
      id: randomUUID(),
      userId: user.id,
      categoryId: category.id,
      type: 'EXPENSE',
      amountMinor: 1n,
      paymentMethod: 'CASH',
      occurredAt: new Date(instant),
    })),
  });
  const response = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-02' })
    .expect(200);
  assert.equal(response.body.data.totals.grossExpense, '2');
  const report = await api
    .get('/api/v1/analytics/categories')
    .auth(token, { type: 'bearer' })
    .query({ from: '2026-02-01T00:00:00+05:30', to: '2026-03-01T00:00:00+05:30' })
    .expect(200);
  assert.equal(report.body.data.categories[0].categoryId, category.id);
  assert.equal(report.body.data.categories[0].grossExpense, '2');
  const empty = await api
    .get('/api/v1/analytics/summary')
    .auth(token, { type: 'bearer' })
    .query({ from: '2026-04-01T00:00:00Z', to: '2026-05-01T00:00:00Z' })
    .expect(200);
  assert.deepEqual(empty.body.data.buckets, []);
  assert.equal(empty.body.data.totals.surplus, '0');
});

test('strict reporting windows reject missing offsets, extra keys and oversized spans', async () => {
  const { token } = await newUser();
  for (const query of [
    { from: '2026-01-01T00:00:00', to: '2026-02-01T00:00:00Z' },
    { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { from: '2026-02-01T00:00:00Z', to: '2026-02-01T00:00:00Z' },
    { from: '2024-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', userId: randomUUID() },
  ]) {
    const response = await api
      .get('/api/v1/analytics/summary')
      .auth(token, { type: 'bearer' })
      .query(query);
    assert.ok([400, 422].includes(response.status));
  }
  await api.get('/api/v1/dashboard').query({ month: '2026-01' }).expect(401);
  for (const route of ['summary', 'categories', 'merchants']) {
    await api
      .get(`/api/v1/analytics/${route}`)
      .auth(token, { type: 'bearer' })
      .query({ from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', groupBy: ['day', 'week'] })
      .expect(400);
    await api
      .get(`/api/v1/analytics/${route}`)
      .auth(token, { type: 'bearer' })
      .query({ from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', userId: randomUUID() })
      .expect(400);
  }
  await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-01', userId: randomUUID() })
    .expect(400);
  await api
    .get('/api/v1/analytics/comparison')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-01', comparisonMonth: '2026-02', userId: randomUUID() })
    .expect(400);
});

test('SQL aggregates remain exact above JavaScript safe integer and recent IDs break ties', async () => {
  const { user, token } = await newUser();
  const category = await db.category.findFirstOrThrow({
    where: { userId: user.id, kind: 'EXPENSE' },
  });
  const ids = Array.from({ length: 9009 }, () => randomUUID());
  for (let offset = 0; offset < ids.length; offset += 500) {
    await db.transaction.createMany({
      data: ids.slice(offset, offset + 500).map((id) => ({
        id,
        userId: user.id,
        categoryId: category.id,
        amountMinor: 999999999999n,
        type: 'EXPENSE',
        paymentMethod: 'CASH',
        merchantOrPayee: 'Precision',
        occurredAt: new Date('2026-06-02T00:00:00Z'),
      })),
    });
  }
  const expected = (999999999999n * 9009n).toString();
  assert.ok(BigInt(expected) > BigInt(Number.MAX_SAFE_INTEGER));
  const window = { from: '2026-06-01T00:00:00Z', to: '2026-07-01T00:00:00Z' };
  for (const route of ['summary', 'categories', 'merchants']) {
    const response = await api
      .get(`/api/v1/analytics/${route}`)
      .auth(token, { type: 'bearer' })
      .query(window)
      .expect(200);
    assert.equal(response.body.data.totals.grossExpense, expected);
    if (route === 'summary') assert.equal(response.body.data.buckets[0].grossExpense, expected);
    if (route === 'categories') assert.equal(response.body.data.categories[0].netExpense, expected);
    if (route === 'merchants') assert.equal(response.body.data.merchants[0].netExpense, expected);
  }
  const dashboard = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-06' })
    .expect(200);
  assert.equal(dashboard.body.data.totals.grossExpense, expected);
  assert.deepEqual(
    dashboard.body.data.recentRecords.map((row: { id: string }) => row.id),
    ids.sort().reverse().slice(0, 5),
  );
});

test('dashboard goal totals exclude foreign, deleted and archived goals and deleted contributions', async () => {
  const { user, token } = await newUser();
  const foreign = await newUser();
  const active = await db.savingsGoal.create({
    data: { id: randomUUID(), userId: user.id, name: 'Active', targetMinor: 100n },
  });
  const archived = await db.savingsGoal.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      name: 'Archived',
      targetMinor: 200n,
      archivedAt: new Date(),
    },
  });
  const deleted = await db.savingsGoal.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      name: 'Deleted',
      targetMinor: 300n,
      deletedAt: new Date(),
    },
  });
  const other = await db.savingsGoal.create({
    data: { id: randomUUID(), userId: foreign.user.id, name: 'Foreign', targetMinor: 400n },
  });
  await db.goalContribution.createMany({
    data: [
      {
        id: randomUUID(),
        userId: user.id,
        goalId: active.id,
        amountMinor: 50n,
        contributedAt: new Date('2025-01-01'),
      },
      {
        id: randomUUID(),
        userId: user.id,
        goalId: active.id,
        amountMinor: 60n,
        contributedAt: new Date('2026-07-02'),
        deletedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: user.id,
        goalId: archived.id,
        amountMinor: 70n,
        contributedAt: new Date('2026-07-02'),
      },
      {
        id: randomUUID(),
        userId: user.id,
        goalId: deleted.id,
        amountMinor: 80n,
        contributedAt: new Date('2026-07-02'),
      },
      {
        id: randomUUID(),
        userId: foreign.user.id,
        goalId: other.id,
        amountMinor: 90n,
        contributedAt: new Date('2026-07-02'),
      },
    ],
  });
  await db.monthlyBudget.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      month: new Date('2026-07-01'),
      limitMinor: 100n,
      deletedAt: new Date(),
    },
  });
  const response = await api
    .get('/api/v1/dashboard')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-07' })
    .expect(200);
  assert.deepEqual(response.body.data.goals, {
    count: '1',
    targetMinor: '100',
    contributedMinor: '50',
  });
  assert.equal(response.body.data.totals.income, '0');
  assert.equal(response.body.data.totals.netExpense, '0');
  assert.equal(response.body.data.budget, null);
  assert.deepEqual(response.body.data.alerts, []);
});

test('comparison uses absolute negative baseline and explicit no-baseline state', async () => {
  assert.equal(percentageChange('100', '0'), null);
  assert.equal(percentageChange('-50', '-100'), '50.00');
  assert.equal(percentageChange('-150', '-100'), '-50.00');
  const { token } = await newUser();
  const response = await api
    .get('/api/v1/analytics/comparison')
    .auth(token, { type: 'bearer' })
    .query({ month: '2026-02', comparisonMonth: '2026-01' })
    .expect(200);
  assert.equal(response.body.data.changes.netExpense.percentage, null);
  assert.equal(response.body.data.changes.netExpense.absolute, '0');
});

test('OpenAPI publishes generated input contracts and analytics routes', () => {
  const spec = makeOpenApi();
  assert.equal(spec.openapi, '3.1.0');
  for (const [name, schema] of Object.entries(publicSchemas)) {
    assert.deepEqual(spec.components.schemas[name], z.toJSONSchema(schema, { io: 'input' }));
  }
  for (const path of [
    '/dashboard',
    '/analytics/summary',
    '/analytics/categories',
    '/analytics/merchants',
    '/analytics/comparison',
  ]) {
    assert.ok(spec.paths[path].get);
  }
  const sources = [
    'auth/index.ts',
    'finance/transactions.ts',
    'finance/categories.ts',
    'finance/budgets.ts',
    'finance/goals.ts',
    'finance/sync.ts',
    'analytics/index.ts',
  ];
  for (const file of sources) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/router\.(get|post|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
      const path =
        `${file === 'auth/index.ts' && !match[2].startsWith('/me') ? '/auth' : ''}${match[2]}`.replace(
          /:([A-Za-z]+)/g,
          '{$1}',
        );
      assert.ok(spec.paths[path]?.[match[1]], `${match[1]} ${path} must be documented`);
    }
  }
  assert.deepEqual(spec.paths['/transactions'].post.requestBody, {
    required: true,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/transactionCreate' } } },
  });
  const body = {
    id: randomUUID(),
    amountMinor: '100',
    type: 'EXPENSE',
    categoryId: randomUUID(),
    paymentMethod: 'CASH',
    occurredAt: '2026-01-01T00:00:00+05:30',
  };
  assert.equal(publicSchemas.transactionCreate.safeParse(body).success, true);
  assert.equal(
    publicSchemas.transactionCreate.safeParse({ ...body, amountMinor: 100 }).success,
    false,
  );
  assert.equal(
    publicSchemas.transactionCreate.safeParse({ ...body, userId: randomUUID() }).success,
    false,
  );
  assert.equal(spec.components.schemas.transactionCreate.additionalProperties, false);
});

test('OpenAPI query schemas, mount prefixes, envelopes and mutation requirements stay explicit', async () => {
  const spec = makeOpenApi();
  assert.deepEqual(spec.servers, [{ url: '/api/v1' }]);
  assert.ok(
    Object.keys(spec.paths).every(
      (path) => !path.startsWith('/api/v1'),
    ),
  );
  const querySchemas = {
    transactionQuery: contracts.transactionQuery,
    categoryQuery: contracts.categoryQuery,
    budgetQuery: contracts.budgetQuery,
    goalQuery: contracts.goalQuery,
    deleteQuery: contracts.deleteQuery,
    goalDeleteQuery: contracts.goalDeleteQuery,
    pagination: contracts.pagination.strict(),
    reportQuery: contracts.reportQuery,
    dashboardQuery: contracts.dashboardQuery,
    comparisonQuery: contracts.comparisonQuery,
    syncBootstrapQuery: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict(),
    syncPullQuery: z.object({ cursor: z.string().regex(/^(0|[1-9][0-9]*)$/).max(30).default('0'), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict(),
  };
  for (const [name, schema] of Object.entries(querySchemas)) {
    const generated = z.toJSONSchema(schema, { io: 'input' });
    assert.deepEqual(spec.components.schemas[name], generated);
    assert.equal(generated.additionalProperties, false);
  }
  const financialPrefixes = ['/transactions', '/categories', '/budgets', '/budget-plans', '/goals'];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const parameters = operation.parameters as Array<{
        name: string;
        in: string;
        required: boolean;
        schema: unknown;
      }>;
      const linkedQuery = operation['x-query-schema'] as { $ref: string } | undefined;
      if (linkedQuery) {
        const schemaName = linkedQuery.$ref.split('/').at(-1)!;
        const schema = spec.components.schemas[schemaName] as {
          properties: Record<string, unknown>;
          required?: string[];
        };
        assert.deepEqual(
          parameters
            .filter((p) => p.in === 'query')
            .map((p) => p.name)
            .sort(),
          Object.keys(schema.properties).sort(),
        );
        for (const parameter of parameters.filter((p) => p.in === 'query')) {
          assert.deepEqual(parameter.schema, schema.properties[parameter.name]);
          assert.equal(parameter.required, schema.required?.includes(parameter.name) ?? false);
        }
        assert.match(String(operation.description), /unknown keys/);
      }
      const financialWrite =
        financialPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) &&
        method !== 'get';
      const operationKey = parameters.find(
        (p) => p.in === 'header' && p.name === 'Idempotency-Key',
      );
      assert.equal(
        Boolean(operationKey),
        financialWrite,
        `${method} ${path}: correct idempotency requirement`,
      );
      if (operationKey) assert.equal(operationKey.required, true);
      if (financialWrite && method === 'delete')
        assert.equal(parameters.find((p) => p.name === 'baseVersion')?.required, true);
      if (financialWrite && method === 'patch') {
        const request = operation.requestBody as {
          content: { 'application/json': { schema: { $ref: string } } };
        };
        const schema = spec.components.schemas[
          request.content['application/json'].schema.$ref.split('/').at(-1)!
        ] as { required: string[] };
        assert.ok(schema.required.includes('baseVersion'));
        assert.match(String(operation.description), /VERSION_CONFLICT/);
      }
    }
  }
  for (const path of ['/health/live', '/health/ready', '/openapi.json']) {
    assert.deepEqual(spec.paths[path].get.servers, [{ url: '/' }]);
    assert.deepEqual(spec.paths[path].get.security, []);
  }
  const response = await api.get('/openapi.json').expect(200);
  assert.deepEqual(response.body, spec);
  assert.equal(Object.hasOwn(response.body, 'data'), false);
  await api.get('/health/live').expect(200, { data: { status: 'ok' } });
  const responses = spec.paths['/transactions'].get.responses as Record<
    string,
    { content: { 'application/json': { schema: { required: string[] } } } }
  >;
  assert.deepEqual(responses['200'].content['application/json'].schema.required, ['data', 'page']);
  const summary = spec.paths['/analytics/summary'].get.responses as typeof responses;
  assert.deepEqual(summary['200'].content['application/json'].schema.required, ['data']);
});
