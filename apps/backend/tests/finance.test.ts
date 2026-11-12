import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, db, newUser, operationId, closeDatabase } from './helpers.js';

after(() => closeDatabase());

type Account = Awaited<ReturnType<typeof newUser>>;
const root = '/api/v1';
const expenseCategory = (account: Account) => account.categories.find((c) => c.kind === 'EXPENSE')!;
const incomeCategory = (account: Account) => account.categories.find((c) => c.kind === 'INCOME')!;
const post = (token: string, route: string, body: object, key: string = operationId()) =>
  api
    .post(root + route)
    .auth(token, { type: 'bearer' })
    .set('Idempotency-Key', key)
    .send(body);
const patch = (token: string, route: string, body: object, key: string = operationId()) =>
  api
    .patch(root + route)
    .auth(token, { type: 'bearer' })
    .set('Idempotency-Key', key)
    .send(body);
const remove = (
  token: string,
  route: string,
  baseVersion = 1,
  extra: Record<string, string> = {},
  key: string = operationId(),
) =>
  api
    .delete(root + route)
    .auth(token, { type: 'bearer' })
    .set('Idempotency-Key', key)
    .query({ baseVersion, ...extra });
const get = (token: string, route: string) => api.get(root + route).auth(token, { type: 'bearer' });
function transaction(account: Account, extra: object = {}) {
  return {
    id: operationId(),
    type: 'EXPENSE',
    amountMinor: '10000',
    currency: 'INR',
    categoryId: expenseCategory(account).id,
    paymentMethod: 'UPI',
    occurredAt: '2026-05-15T12:00:00+05:30',
    ...extra,
  };
}
async function createExpense(account: Account, extra: object = {}) {
  return (await post(account.token, '/transactions', transaction(account, extra)).expect(201)).body
    .data;
}
async function createBudget(account: Account, extra: object = {}) {
  return (
    await post(account.token, '/budgets', {
      id: operationId(),
      month: '2026-05',
      limitMinor: '10000',
      currency: 'INR',
      ...extra,
    }).expect(201)
  ).body.data;
}
async function createGoal(account: Account, extra: object = {}) {
  return (
    await post(account.token, '/goals', {
      id: operationId(),
      name: 'Trip',
      targetMinor: '50000',
      currency: 'INR',
      ...extra,
    }).expect(201)
  ).body.data;
}

test('financial routes require authentication and UUID operation keys', async () => {
  for (const route of ['/transactions', '/categories', '/budgets', '/goals'])
    await api.get(root + route).expect(401);
  const account = await newUser();
  await api
    .post(root + '/transactions')
    .auth(account.token, { type: 'bearer' })
    .send(transaction(account))
    .expect(400);
  await post(account.token, '/transactions', transaction(account), 'invalid').expect(400);
  assert.equal(await db.transaction.count({ where: { userId: account.user.id } }), 0);
});

test('transaction CRUD has exact money, immutable type, strict metadata and row versions', async () => {
  const account = await newUser();
  const row = await createExpense(account, { amountMinor: '999999999999', description: 'Lunch' });
  assert.equal(row.amountMinor, '999999999999');
  assert.equal(row.source, 'MANUAL_APP');
  assert.equal(row.version, 1);
  assert.equal(
    (await get(account.token, `/transactions/${row.id}`).expect(200)).body.data.id,
    row.id,
  );
  for (const body of [
    { type: 'INCOME' },
    { userId: operationId() },
    { source: 'MANUAL_WIDGET' },
    { version: 50 },
    { originalExpenseId: operationId() },
  ]) {
    await patch(account.token, `/transactions/${row.id}`, { baseVersion: 1, ...body }).expect(400);
  }
  const updated = (
    await patch(account.token, `/transactions/${row.id}`, {
      baseVersion: 1,
      amountMinor: '12345',
      merchantOrPayee: 'Cafe',
    }).expect(200)
  ).body.data;
  assert.equal(updated.version, 2);
  assert.equal(updated.amountMinor, '12345');
  const stale = await patch(account.token, `/transactions/${row.id}`, {
    baseVersion: 1,
    amountMinor: '23456',
  }).expect(409);
  assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
  assert.equal(stale.body.error.currentVersion, 2);
  await remove(account.token, `/transactions/${row.id}`, 1).expect(409);
  const deleted = (await remove(account.token, `/transactions/${row.id}`, 2).expect(200)).body.data;
  assert.equal(deleted.version, 3);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.description, undefined);
  await get(account.token, `/transactions/${row.id}`).expect(404);
  assert.equal((await get(account.token, '/transactions').expect(200)).body.data.length, 0);
  await post(account.token, '/transactions', transaction(account, { id: row.id })).expect(409);
});

test('invalid money, timestamps, asset keys and incompatible categories are rejected', async () => {
  const account = await newUser();
  for (const amountMinor of ['0', '-1', '1.25', '01', '1000000000000', '1e3', 10]) {
    await post(account.token, '/transactions', transaction(account, { amountMinor })).expect(400);
  }
  await post(
    account.token,
    '/transactions',
    transaction(account, { occurredAt: '2026-05-01T12:00:00' }),
  ).expect(400);
  await post(account.token, '/transactions', transaction(account, { currency: 'USD' })).expect(400);
  await post(
    account.token,
    '/transactions',
    transaction(account, { categoryId: incomeCategory(account).id }),
  ).expect(422);
  await post(
    account.token,
    '/transactions',
    transaction(account, { originalExpenseId: operationId() }),
  ).expect(422);
  await post(account.token, '/categories', {
    name: 'Custom',
    kind: 'EXPENSE',
    iconKey: 'unreviewed-url',
  }).expect(400);
  await post(account.token, '/goals', { id: operationId(), name: 'Trip', targetMinor: '0' }).expect(
    400,
  );
});

test('idempotency replays canonical create/update/delete responses and rejects changed reuse', async () => {
  const account = await newUser();
  const body = transaction(account);
  const key = operationId();
  const [first, retry] = await Promise.all([
    post(account.token, '/transactions', body, key),
    post(account.token, '/transactions', body, key),
  ]);
  assert.equal(first.status, 201);
  assert.equal(retry.status, 201);
  assert.deepEqual(retry.body, first.body);
  const updateKey = operationId();
  const change = { baseVersion: 1, amountMinor: '9000' };
  const updated = await patch(account.token, `/transactions/${body.id}`, change, updateKey).expect(
    200,
  );
  assert.deepEqual(
    (await patch(account.token, `/transactions/${body.id}`, change, updateKey).expect(200)).body,
    updated.body,
  );
  assert.deepEqual(
    (await post(account.token, '/transactions', body, key).expect(201)).body,
    first.body,
  );
  const reused = await post(
    account.token,
    '/transactions',
    { ...body, amountMinor: '20000' },
    key,
  ).expect(409);
  assert.equal(reused.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
  const deleteKey = operationId();
  const deleted = await remove(account.token, `/transactions/${body.id}`, 2, {}, deleteKey).expect(
    200,
  );
  assert.deepEqual(
    (await remove(account.token, `/transactions/${body.id}`, 2, {}, deleteKey).expect(200)).body,
    deleted.body,
  );
  assert.equal(
    await db.changeEvent.count({ where: { userId: account.user.id, entityId: body.id } }),
    3,
  );
  assert.equal(await db.mutationReceipt.count({ where: { userId: account.user.id } }), 3);
});

test('failed mutation receipts replay after state changes while schema failures leave keys available', async () => {
  const account = await newUser();
  const schemaKey = operationId();
  const expenseBody = transaction(account);
  await post(
    account.token,
    '/transactions',
    { ...expenseBody, amountMinor: '0' },
    schemaKey,
  ).expect(400);
  assert.equal(
    await db.mutationReceipt.count({ where: { userId: account.user.id, operationId: schemaKey } }),
    0,
  );
  await post(account.token, '/transactions', expenseBody, schemaKey).expect(201);

  const firstRefund = (
    await post(
      account.token,
      '/transactions',
      transaction(account, {
        type: 'REFUND',
        originalExpenseId: expenseBody.id,
        amountMinor: '7000',
      }),
    ).expect(201)
  ).body.data;
  const refundBody = transaction(account, {
    type: 'REFUND',
    originalExpenseId: expenseBody.id,
    amountMinor: '4000',
  });
  const failureKey = operationId();
  const failure = await post(account.token, '/transactions', refundBody, failureKey).expect(409);
  assert.equal(failure.body.error.code, 'REFUND_LIMIT_EXCEEDED');
  assert.equal(await db.transaction.count({ where: { id: refundBody.id } }), 0);
  assert.equal(
    await db.changeEvent.count({ where: { userId: account.user.id, entityId: refundBody.id } }),
    0,
  );
  assert.equal(
    (
      await db.mutationReceipt.findUniqueOrThrow({
        where: { userId_operationId: { userId: account.user.id, operationId: failureKey } },
      })
    ).status,
    409,
  );
  await patch(account.token, `/transactions/${firstRefund.id}`, {
    baseVersion: 1,
    amountMinor: '6000',
  }).expect(200);
  assert.deepEqual(
    (await post(account.token, '/transactions', refundBody, failureKey).expect(409)).body,
    failure.body,
  );
  await post(account.token, '/transactions', refundBody).expect(201);

  const missingId = operationId();
  const missingKey = operationId();
  const absent = await remove(
    account.token,
    `/transactions/${missingId}`,
    1,
    {},
    missingKey,
  ).expect(404);
  await createExpense(account, { id: missingId });
  assert.deepEqual(
    (await remove(account.token, `/transactions/${missingId}`, 1, {}, missingKey).expect(404)).body,
    absent.body,
  );
  await get(account.token, `/transactions/${missingId}`).expect(200);
});

test('semantic error receipts survive category restoration and require a new operation to apply', async () => {
  const account = await newUser();
  const category = expenseCategory(account);
  await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 1,
    archived: true,
  }).expect(200);
  const body = transaction(account);
  const key = operationId();
  const failed = await post(account.token, '/transactions', body, key).expect(422);
  const receipt = await db.mutationReceipt.findUniqueOrThrow({
    where: { userId_operationId: { userId: account.user.id, operationId: key } },
  });
  assert.equal(receipt.status, 422);
  assert.deepEqual(receipt.result, failed.body);
  await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 2,
    archived: false,
  }).expect(200);
  assert.deepEqual(
    (await post(account.token, '/transactions', body, key).expect(422)).body,
    failed.body,
  );
  assert.equal(await db.transaction.count({ where: { id: body.id } }), 0);
  assert.equal(
    await db.changeEvent.count({ where: { userId: account.user.id, entityId: body.id } }),
    0,
  );
  const changed = await post(
    account.token,
    '/transactions',
    { ...body, amountMinor: '1' },
    key,
  ).expect(409);
  assert.equal(changed.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
  await post(account.token, '/transactions', body).expect(201);
});

test('foreign entities, category filters and refund parents never cross ownership', async () => {
  const account = await newUser();
  const foreign = await newUser();
  const expense = await createExpense(foreign);
  await get(account.token, `/transactions/${expense.id}`).expect(404);
  await patch(account.token, `/transactions/${expense.id}`, {
    baseVersion: 1,
    amountMinor: '10',
  }).expect(404);
  await remove(account.token, `/transactions/${expense.id}`).expect(404);
  await get(account.token, '/transactions')
    .query({ categoryId: expenseCategory(foreign).id })
    .expect(404);
  await post(
    account.token,
    '/transactions',
    transaction(account, { categoryId: expenseCategory(foreign).id }),
  ).expect(404);
  await post(
    account.token,
    '/transactions',
    transaction(account, { type: 'REFUND', originalExpenseId: expense.id }),
  ).expect(404);
  await patch(account.token, `/categories/${expenseCategory(foreign).id}`, {
    baseVersion: 1,
    name: 'Stolen',
  }).expect(404);
  const local = await createExpense(account);
  await patch(account.token, `/transactions/${local.id}`, {
    baseVersion: 1,
    categoryId: expenseCategory(foreign).id,
  }).expect(404);
});

test('categories reserve archived names, restore the same ID and allow refunds on archived history', async () => {
  const account = await newUser();
  const category = expenseCategory(account);
  const expense = await createExpense(account);
  await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 1,
    archived: true,
  }).expect(200);
  const active = (await get(account.token, '/categories').expect(200)).body.data as {
    id: string;
  }[];
  assert.ok(!active.some((c) => c.id === category.id));
  const all = (
    await get(account.token, '/categories').query({ includeArchived: 'true' }).expect(200)
  ).body.data as { id: string }[];
  assert.ok(all.some((c) => c.id === category.id));
  await post(account.token, '/categories', {
    name: category.name.toUpperCase(),
    kind: 'EXPENSE',
    iconKey: 'other',
  }).expect(409);
  await post(account.token, '/transactions', transaction(account)).expect(422);
  const refund = await post(
    account.token,
    '/transactions',
    transaction(account, { type: 'REFUND', originalExpenseId: expense.id, amountMinor: '100' }),
  ).expect(201);
  assert.equal(refund.body.data.categoryId, category.id);
  await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 2,
    kind: 'INCOME',
  }).expect(400);
  const restored = await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 2,
    archived: false,
    name: 'Renamed category',
  }).expect(200);
  assert.equal(restored.body.data.id, category.id);
  assert.equal(restored.body.data.version, 3);
  await post(account.token, '/transactions', transaction(account)).expect(201);
});

test('custom categories validate assets, normalize names and version metadata changes', async () => {
  const account = await newUser();
  const categoryId = operationId();
  const created = await post(account.token, '/categories', {
    id: categoryId,
    name: '  Coffee  ',
    kind: 'EXPENSE',
    iconKey: 'food',
    colourToken: 'peach',
  }).expect(201);
  assert.equal(created.body.data.id, categoryId);
  assert.equal(created.body.data.name, 'Coffee');
  await post(account.token, '/categories', {
    name: 'Ｃｏｆｆｅｅ',
    kind: 'EXPENSE',
    iconKey: 'food',
  }).expect(409);
  await post(account.token, '/categories', {
    name: 'Coffee',
    kind: 'INCOME',
    iconKey: 'salary',
  }).expect(201);
  await patch(account.token, `/categories/${categoryId}`, {
    baseVersion: 1,
    colourToken: 'invalid',
  }).expect(400);
  const changed = (
    await patch(account.token, `/categories/${categoryId}`, {
      baseVersion: 1,
      name: 'Tea',
      iconKey: 'leaf',
      colourToken: 'lavender',
    }).expect(200)
  ).body.data;
  assert.equal(changed.version, 2);
  assert.equal(changed.iconKey, 'leaf');
  await patch(account.token, `/categories/${categoryId}`, {
    baseVersion: 1,
    archived: true,
  }).expect(409);
  const events = await db.changeEvent.findMany({
    where: { userId: account.user.id, entityId: categoryId },
    orderBy: { sequence: 'asc' },
  });
  assert.deepEqual(
    events.map((event) => event.entityVersion),
    [1, 2],
  );
  assert.ok(events.every((event) => event.entityType === 'Category'));
});

test('concurrent refunds serialize caps; edits and deletes preserve the combined expense state', async () => {
  const account = await newUser();
  const expense = await createExpense(account);
  const bodies = [0, 1].map(() =>
    transaction(account, { type: 'REFUND', originalExpenseId: expense.id, amountMinor: '6000' }),
  );
  const results = await Promise.all(
    bodies.map((body) => post(account.token, '/transactions', body)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const refund = results.find((r) => r.status === 201)!.body.data;
  await patch(account.token, `/transactions/${expense.id}`, {
    baseVersion: 1,
    amountMinor: '5999',
  }).expect(409);
  const alternative = account.categories.find(
    (c) => c.kind === 'EXPENSE' && c.id !== expenseCategory(account).id,
  )!;
  await patch(account.token, `/transactions/${expense.id}`, {
    baseVersion: 1,
    categoryId: alternative.id,
  }).expect(409);
  await remove(account.token, `/transactions/${expense.id}`).expect(409);
  await post(
    account.token,
    '/transactions',
    transaction(account, {
      type: 'REFUND',
      originalExpenseId: expense.id,
      categoryId: alternative.id,
      amountMinor: '1',
    }),
  ).expect(422);
  const second = (
    await post(
      account.token,
      '/transactions',
      transaction(account, { type: 'REFUND', originalExpenseId: expense.id, amountMinor: '4000' }),
    ).expect(201)
  ).body.data;
  await patch(account.token, `/transactions/${refund.id}`, {
    baseVersion: 1,
    amountMinor: '6001',
  }).expect(409);
  await patch(account.token, `/transactions/${refund.id}`, {
    baseVersion: 1,
    amountMinor: '5000',
  }).expect(200);
  await patch(account.token, `/transactions/${expense.id}`, {
    baseVersion: 1,
    amountMinor: '9000',
  }).expect(200);
  await remove(account.token, `/transactions/${refund.id}`, 2).expect(200);
  await remove(account.token, `/transactions/${second.id}`).expect(200);
  await remove(account.token, `/transactions/${expense.id}`, 2).expect(200);
  await post(
    account.token,
    '/transactions',
    transaction(account, { type: 'REFUND', originalExpenseId: expense.id, amountMinor: '1' }),
  ).expect(404);
});

test('concurrent expense reduction and refund creation cannot over-refund', async () => {
  const account = await newUser();
  const expense = await createExpense(account);
  const responses = await Promise.all([
    patch(account.token, `/transactions/${expense.id}`, { baseVersion: 1, amountMinor: '5000' }),
    post(
      account.token,
      '/transactions',
      transaction(account, { type: 'REFUND', originalExpenseId: expense.id, amountMinor: '6000' }),
    ),
  ]);
  assert.equal(responses.filter((r) => r.status === 409).length, 1);
  const parent = await db.transaction.findUniqueOrThrow({ where: { id: expense.id } });
  const sum =
    (
      await db.transaction.aggregate({
        where: { userId: account.user.id, originalExpenseId: expense.id, deletedAt: null },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor ?? 0n;
  assert.ok(sum <= parent.amountMinor);
});

test('concurrent edits from the same base version apply exactly one correction', async () => {
  const account = await newUser();
  const expense = await createExpense(account);
  const responses = await Promise.all([
    patch(account.token, `/transactions/${expense.id}`, { baseVersion: 1, amountMinor: '20000' }),
    patch(account.token, `/transactions/${expense.id}`, { baseVersion: 1, amountMinor: '30000' }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const updated = responses.find((response) => response.status === 200)!.body.data;
  const rejected = responses.find((response) => response.status === 409)!.body.error;
  assert.equal(rejected.code, 'VERSION_CONFLICT');
  assert.equal(rejected.currentVersion, 2);
  assert.equal(rejected.current.amountMinor, updated.amountMinor);
  const canonical = (await get(account.token, `/transactions/${expense.id}`).expect(200)).body.data;
  assert.equal(canonical.version, 2);
  assert.equal(canonical.amountMinor, updated.amountMinor);
  assert.equal(
    await db.changeEvent.count({ where: { userId: account.user.id, entityId: expense.id } }),
    2,
  );
});

test('transaction pagination binds owner, filters and sort; amount/date filters validate', async () => {
  const account = await newUser();
  for (const amountMinor of ['30', '10', '20']) await createExpense(account, { amountMinor });
  const first = await get(account.token, '/transactions')
    .query({ limit: 2, sort: 'amount_asc' })
    .expect(200);
  assert.deepEqual(
    first.body.data.map((row: { amountMinor: string }) => row.amountMinor),
    ['10', '20'],
  );
  assert.equal(first.body.page.hasMore, true);
  const cursor = first.body.page.nextCursor;
  const second = await get(account.token, '/transactions')
    .query({ limit: 2, sort: 'amount_asc', cursor })
    .expect(200);
  assert.deepEqual(
    second.body.data.map((row: { amountMinor: string }) => row.amountMinor),
    ['30'],
  );
  assert.equal(second.body.page.hasMore, false);
  await get(account.token, '/transactions')
    .query({ limit: 2, sort: 'amount_desc', cursor })
    .expect(400);
  const other = await newUser();
  await get(other.token, '/transactions')
    .query({ limit: 2, sort: 'amount_asc', cursor })
    .expect(400);
  const filtered = await get(account.token, '/transactions')
    .query({
      minAmountMinor: '20',
      maxAmountMinor: '30',
      from: '2026-05-01T00:00:00Z',
      to: '2026-06-01T00:00:00Z',
    })
    .expect(200);
  assert.equal(filtered.body.data.length, 2);
  await get(account.token, '/transactions')
    .query({ minAmountMinor: '30', maxAmountMinor: '20' })
    .expect(422);
  await get(account.token, '/transactions')
    .query({ from: '2026-06-01T00:00:00Z', to: '2026-05-01T00:00:00Z' })
    .expect(422);
  await get(account.token, '/transactions').query({ limit: 101 }).expect(400);
  await get(account.token, '/transactions').query({ userId: other.user.id }).expect(400);
});

test('budget allocation races enforce caps, versions, parent ownership and category kind', async () => {
  const account = await newUser();
  const foreign = await newUser();
  const budget = await createBudget(account);
  const categories = account.categories.filter((c) => c.kind === 'EXPENSE');
  const allocations = categories
    .slice(0, 2)
    .map((c) => ({ id: operationId(), categoryId: c.id, limitMinor: '6000' }));
  const responses = await Promise.all(
    allocations.map((body) => post(account.token, `/budgets/${budget.id}/categories`, body)),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const allocation = responses.find((r) => r.status === 201)!.body.data;
  await patch(account.token, `/budgets/${budget.id}`, {
    baseVersion: 1,
    limitMinor: '5999',
  }).expect(409);
  await patch(account.token, `/budgets/${budget.id}/categories/${allocation.id}`, {
    baseVersion: 1,
    limitMinor: '10001',
  }).expect(409);
  await patch(account.token, `/budgets/${budget.id}/categories/${allocation.id}`, {
    baseVersion: 1,
    limitMinor: '4000',
  }).expect(200);
  await remove(account.token, `/budgets/${budget.id}/categories/${allocation.id}`, 1).expect(409);
  await post(account.token, `/budgets/${budget.id}/categories`, {
    id: operationId(),
    categoryId: incomeCategory(account).id,
    limitMinor: '1',
  }).expect(422);
  await post(account.token, `/budgets/${budget.id}/categories`, {
    id: operationId(),
    categoryId: expenseCategory(foreign).id,
    limitMinor: '1',
  }).expect(404);
  await get(foreign.token, `/budgets/${budget.id}`).expect(404);
  await post(foreign.token, `/budgets/${budget.id}/categories`, {
    id: operationId(),
    categoryId: expenseCategory(foreign).id,
    limitMinor: '1',
  }).expect(404);
  await patch(foreign.token, `/budgets/${budget.id}`, {
    baseVersion: 1,
    limitMinor: '20000',
  }).expect(404);
  const other = await createBudget(account, { month: '2026-06' });
  await patch(account.token, `/budgets/${other.id}/categories/${allocation.id}`, {
    baseVersion: 2,
    limitMinor: '1',
  }).expect(404);
  await remove(account.token, `/budgets/${other.id}/categories/${allocation.id}`, 2).expect(404);
  await remove(account.token, `/budgets/${budget.id}/categories/${allocation.id}`, 2).expect(200);
  await patch(account.token, `/budgets/${budget.id}`, { baseVersion: 1, limitMinor: '0' }).expect(
    200,
  );
  await patch(account.token, `/budgets/${budget.id}`, { baseVersion: 1, limitMinor: '1' }).expect(
    409,
  );
  await createBudget(account, { month: '2026-07', limitMinor: '0' });
});

test('budget detail uses dated net expenses and cascades emit individual tombstones', async () => {
  const account = await newUser();
  const expense = await createExpense(account, {
    amountMinor: '10000',
    occurredAt: '2026-04-01T12:00:00+05:30',
  });
  await createExpense(account, { amountMinor: '9000' });
  await post(
    account.token,
    '/transactions',
    transaction(account, { type: 'REFUND', amountMinor: '500', originalExpenseId: expense.id }),
  ).expect(201);
  const budget = await createBudget(account);
  await post(account.token, '/budgets', {
    id: operationId(),
    month: '2026-05',
    limitMinor: '1',
  }).expect(409);
  const allocation = (
    await post(account.token, `/budgets/${budget.id}/categories`, {
      id: operationId(),
      categoryId: expenseCategory(account).id,
      limitMinor: '5000',
    }).expect(201)
  ).body.data;
  const detail = (await get(account.token, `/budgets/${budget.id}`).expect(200)).body.data;
  assert.equal(detail.month, '2026-05');
  assert.equal(detail.spending.netExpense, '8500');
  assert.equal(detail.remainingMinor, '1500');
  assert.equal(detail.progressBasisPoints, '8500');
  assert.equal(detail.nearLimit, true);
  assert.equal(detail.overLimit, false);
  assert.equal(
    (await get(account.token, '/budgets').query({ from: '2026-05', to: '2026-06' }).expect(200))
      .body.data[0].allocations.length,
    1,
  );
  await remove(account.token, `/budgets/${budget.id}`).expect(200);
  await get(account.token, `/budgets/${budget.id}`).expect(404);
  const events = await db.changeEvent.findMany({
    where: {
      userId: account.user.id,
      entityId: { in: [budget.id, allocation.id] },
      operation: 'DELETE',
    },
  });
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.entityVersion === 2));
  const deletedChild = await db.categoryBudget.findUniqueOrThrow({ where: { id: allocation.id } });
  assert.ok(deletedChild.deletedAt);
  await post(account.token, `/budgets/${budget.id}/categories`, {
    id: operationId(),
    categoryId: expenseCategory(account).id,
    limitMinor: '1',
  }).expect(404);
  await createBudget(account); // A fresh ID may replace the soft-deleted month.
});

test('allocation edits race safely with overall limit changes and duplicate month creates', async () => {
  const account = await newUser();
  const bodies = [0, 1].map(() => ({ id: operationId(), month: '2026-05', limitMinor: '10000' }));
  const creates = await Promise.all(bodies.map((body) => post(account.token, '/budgets', body)));
  assert.deepEqual(creates.map((r) => r.status).sort(), [201, 409]);
  const budget = creates.find((r) => r.status === 201)!.body.data;
  const allocation = (
    await post(account.token, `/budgets/${budget.id}/categories`, {
      id: operationId(),
      categoryId: expenseCategory(account).id,
      limitMinor: '4000',
    }).expect(201)
  ).body.data;
  const responses = await Promise.all([
    patch(account.token, `/budgets/${budget.id}`, { baseVersion: 1, limitMinor: '5000' }),
    patch(account.token, `/budgets/${budget.id}/categories/${allocation.id}`, {
      baseVersion: 1,
      limitMinor: '6000',
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const parent = await db.monthlyBudget.findUniqueOrThrow({ where: { id: budget.id } });
  const child = await db.categoryBudget.findUniqueOrThrow({ where: { id: allocation.id } });
  assert.ok(child.limitMinor <= parent.limitMinor);
});

test('budget reads preserve local month boundaries, zero limits and refund-negative periods', async () => {
  const account = await newUser();
  const budget = await createBudget(account, { limitMinor: '0' });
  const original = await createExpense(account, {
    occurredAt: '2026-04-30T23:59:59+05:30',
    amountMinor: '1000',
  });
  await post(
    account.token,
    '/transactions',
    transaction(account, {
      type: 'REFUND',
      originalExpenseId: original.id,
      amountMinor: '1000',
      occurredAt: '2026-05-01T00:00:00+05:30',
    }),
  ).expect(201);
  await createExpense(account, { occurredAt: '2026-06-01T00:00:00+05:30', amountMinor: '2000' });
  const detail = (await get(account.token, `/budgets/${budget.id}`).expect(200)).body.data;
  assert.equal(detail.spending.grossExpense, '0');
  assert.equal(detail.spending.refunds, '1000');
  assert.equal(detail.spending.netExpense, '-1000');
  assert.equal(detail.remainingMinor, '1000');
  assert.equal(detail.progressBasisPoints, null);
  assert.equal(detail.nearLimit, false);
  assert.equal(detail.overLimit, false);
});

test('retired categories cannot be referenced or restored; income cannot be a refund parent', async () => {
  const account = await newUser();
  const category = expenseCategory(account);
  await db.category.update({ where: { id: category.id }, data: { deletedAt: new Date() } });
  await post(account.token, '/transactions', transaction(account)).expect(404);
  await patch(account.token, `/categories/${category.id}`, {
    baseVersion: 1,
    archived: false,
  }).expect(404);
  await get(account.token, '/transactions').query({ categoryId: category.id }).expect(404);
  const income = (
    await post(
      account.token,
      '/transactions',
      transaction(account, { type: 'INCOME', categoryId: incomeCategory(account).id }),
    ).expect(201)
  ).body.data;
  await post(
    account.token,
    '/transactions',
    transaction(account, {
      type: 'REFUND',
      originalExpenseId: income.id,
      categoryId: income.categoryId,
    }),
  ).expect(422);
});

test('goal contributions CRUD, overfunding, corrections, archive/restore and cascades', async () => {
  const account = await newUser();
  const goal = await createGoal(account, { targetDate: '2027-01-01' });
  assert.equal(goal.targetDate, '2027-01-01');
  const contribution = (
    await post(account.token, `/goals/${goal.id}/contributions`, {
      id: operationId(),
      amountMinor: '60000',
      contributedAt: '2026-05-01T00:00:00Z',
      note: 'Earmarked',
    }).expect(201)
  ).body.data;
  const detail = (await get(account.token, `/goals/${goal.id}`).expect(200)).body.data;
  assert.equal(detail.savedMinor, '60000');
  assert.equal(detail.completed, true);
  await patch(account.token, `/goals/${goal.id}/contributions/${contribution.id}`, {
    baseVersion: 1,
    amountMinor: '55000',
    note: null,
  }).expect(200);
  await remove(account.token, `/goals/${goal.id}/contributions/${contribution.id}`, 1).expect(409);
  assert.equal((await get(account.token, '/goals').expect(200)).body.data[0].savedMinor, '55000');
  await patch(account.token, `/goals/${goal.id}`, {
    baseVersion: 1,
    archived: true,
    targetDate: null,
  }).expect(200);
  assert.equal((await get(account.token, '/goals').expect(200)).body.data.length, 0);
  assert.equal(
    (await get(account.token, '/goals').query({ includeArchived: 'true' }).expect(200)).body.data
      .length,
    1,
  );
  await post(account.token, `/goals/${goal.id}/contributions`, {
    id: operationId(),
    amountMinor: '1',
    contributedAt: '2026-05-01T00:00:00Z',
  }).expect(422);
  const restored = (
    await patch(account.token, `/goals/${goal.id}`, {
      baseVersion: 2,
      archived: false,
      targetMinor: '54000',
    }).expect(200)
  ).body.data;
  assert.equal(restored.id, goal.id);
  assert.equal(restored.targetDate, null);
  await patch(account.token, `/goals/${goal.id}`, { baseVersion: 2, name: 'Stale' }).expect(409);
  assert.equal(
    (await get(account.token, `/goals/${goal.id}/contributions`).expect(200)).body.data.length,
    1,
  );
  await remove(account.token, `/goals/${goal.id}`, 3).expect(409);
  await remove(account.token, `/goals/${goal.id}`, 3, { confirmContributions: 'true' }).expect(200);
  await get(account.token, `/goals/${goal.id}`).expect(404);
  await get(account.token, `/goals/${goal.id}/contributions`).expect(404);
  assert.equal(
    await db.changeEvent.count({
      where: {
        userId: account.user.id,
        operation: 'DELETE',
        entityId: { in: [goal.id, contribution.id] },
      },
    }),
    2,
  );
  const child = await db.goalContribution.findUniqueOrThrow({ where: { id: contribution.id } });
  assert.ok(child.deletedAt);
  assert.equal(child.version, 3);
  assert.equal(child.note, null);
});

test('goal children require the exact owned live parent and aggregate amounts stay bounded', async () => {
  const account = await newUser();
  const foreign = await newUser();
  const goal = await createGoal(account);
  const otherGoal = await createGoal(account);
  const body = {
    id: operationId(),
    amountMinor: '999999999999',
    contributedAt: '2026-05-01T00:00:00Z',
  };
  await post(account.token, `/goals/${goal.id}/contributions`, body).expect(201);
  await post(account.token, `/goals/${goal.id}/contributions`, {
    ...body,
    id: operationId(),
    amountMinor: '1',
  }).expect(422);
  await get(foreign.token, `/goals/${goal.id}`).expect(404);
  await get(foreign.token, `/goals/${goal.id}/contributions`).expect(404);
  await patch(foreign.token, `/goals/${goal.id}`, { baseVersion: 1, name: 'Stolen' }).expect(404);
  await post(foreign.token, `/goals/${goal.id}/contributions`, {
    ...body,
    id: operationId(),
  }).expect(404);
  await patch(account.token, `/goals/${otherGoal.id}/contributions/${body.id}`, {
    baseVersion: 1,
    amountMinor: '1',
  }).expect(404);
  await remove(account.token, `/goals/${otherGoal.id}/contributions/${body.id}`).expect(404);
  await remove(foreign.token, `/goals/${goal.id}/contributions/${body.id}`).expect(404);
  await remove(account.token, `/goals/${goal.id}/contributions/${body.id}`).expect(200);
  assert.equal(
    (await get(account.token, `/goals/${goal.id}`).expect(200)).body.data.savedMinor,
    '0',
  );
  await remove(account.token, `/goals/${goal.id}`).expect(200);
});

test('Postgres independently enforces money bounds and composite ownership references', async () => {
  const account = await newUser();
  const foreign = await newUser();
  const data = {
    userId: account.user.id,
    categoryId: expenseCategory(account).id,
    type: 'EXPENSE',
    paymentMethod: 'CASH',
    occurredAt: new Date(),
  };
  for (const amountMinor of [0n, -1n, 1000000000000n]) {
    await assert.rejects(
      db.transaction.create({ data: { ...data, id: operationId(), amountMinor } }),
    );
  }
  await assert.rejects(
    db.transaction.create({
      data: {
        ...data,
        id: operationId(),
        amountMinor: 1n,
        categoryId: expenseCategory(foreign).id,
      },
    }),
  );
  await assert.rejects(
    db.monthlyBudget.create({
      data: {
        id: operationId(),
        userId: account.user.id,
        month: new Date('2026-05-02'),
        limitMinor: 1n,
      },
    }),
  );
  await assert.rejects(
    db.monthlyBudget.create({
      data: {
        id: operationId(),
        userId: account.user.id,
        month: new Date('2026-05-01'),
        limitMinor: -1n,
      },
    }),
  );
});
