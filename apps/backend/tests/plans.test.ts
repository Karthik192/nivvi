import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, db, newUser, operationId, closeDatabase } from './helpers.js';
after(closeDatabase);
test('whole budget plans validate ownership and sums before atomic create; replay and edits remain exact', async () => {
  const user = await newUser(),
    foreign = await newUser();
  const categories = user.categories.filter((c) => c.kind === 'EXPENSE');
  const put = (body: object, key = operationId()) =>
    api
      .put('/api/v1/budget-plans/2026-11')
      .auth(user.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const initial = {
    baseVersion: null,
    baseAllocations: [],
    limitMinor: '10000',
    allocations: [{ categoryId: categories[0].id, limitMinor: '4000' }],
  };
  await put({
    ...initial,
    allocations: [{ categoryId: foreign.categories[0].id, limitMinor: '4000' }],
  }).expect(404);
  await put({ ...initial, limitMinor: '1' }).expect(422);
  assert.equal(await db.monthlyBudget.count({ where: { userId: user.user.id } }), 0);
  const key = operationId();
  const created = (await put(initial, key).expect(201)).body;
  assert.deepEqual((await put(initial, key).expect(201)).body, created);
  const row = created.data;
  const next = {
    ...initial,
    baseVersion: row.version,
    baseAllocations: row.allocations.map((r: { id: string; version: number }) => ({
      id: r.id,
      version: r.version,
    })),
    allocations: [{ categoryId: categories[1].id, limitMinor: '8000' }],
  };
  const edited = (await put(next).expect(200)).body.data;
  assert.equal(edited.version, 2);
  assert.equal(edited.allocations.length, 1);
  assert.equal(edited.allocations[0].categoryId, categories[1].id);
  const old = await db.categoryBudget.findUniqueOrThrow({ where: { id: row.allocations[0].id } });
  assert.ok(old.deletedAt);
  assert.equal(old.version, 2);
  await put(next).expect(409);
  assert.deepEqual((await put(initial, key).expect(201)).body, created);
});
test('independent allocation edits invalidate whole-plan snapshots and concurrent plans apply once', async () => {
  const user = await newUser();
  const category = user.categories.find((c) => c.kind === 'EXPENSE')!;
  const send = (body: object) =>
    api
      .put('/api/v1/budget-plans/2026-10')
      .auth(user.token, { type: 'bearer' })
      .set('Idempotency-Key', operationId())
      .send(body);
  const initial = {
    baseVersion: null,
    baseAllocations: [],
    limitMinor: '10000',
    allocations: [{ categoryId: category.id, limitMinor: '4000' }],
  };
  const row = (await send(initial).expect(201)).body.data;
  const snapshot = {
    ...initial,
    baseVersion: row.version,
    baseAllocations: row.allocations.map((r: { id: string; version: number }) => ({
      id: r.id,
      version: r.version,
    })),
  };
  await api
    .patch(`/api/v1/budgets/${row.id}/categories/${row.allocations[0].id}`)
    .auth(user.token, { type: 'bearer' })
    .set('Idempotency-Key', operationId())
    .send({ baseVersion: 1, limitMinor: '5000' })
    .expect(200);
  await send(snapshot).expect(409);
  const fresh = { ...snapshot, baseAllocations: [{ id: row.allocations[0].id, version: 2 }] };
  const replies = await Promise.all([send(fresh), send(fresh)]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
});
