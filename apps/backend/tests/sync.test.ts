import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, newUser, closeDatabase, operationId } from './helpers.js';

after(() => closeDatabase());
const root = '/api/v1';
test('sync bootstrap paginates a fixed snapshot and pull is authenticated and account scoped', async () => {
  const account = await newUser();
  const other = await newUser();
  const categoryId = account.categories.find((row) => row.kind === 'EXPENSE')!.id;
  const create = (id: string) => api.post(root + '/transactions')
    .auth(account.token, { type: 'bearer' })
    .set('Idempotency-Key', operationId())
    .send({ id, type: 'EXPENSE', amountMinor: '1234', currency: 'INR', categoryId, paymentMethod: 'CASH', occurredAt: '2026-05-15T12:00:00+05:30' });
  const firstId = operationId();
  const secondId = operationId();
  await create(firstId).expect(201);
  await create(secondId).expect(201);
  const first = await api.get(root + '/sync/bootstrap?limit=1').auth(account.token, { type: 'bearer' }).expect(200);
  assert.equal(first.body.data.transactions.length, 1);
  assert.equal(first.body.data.categories.length, account.categories.length);
  assert.equal(first.body.data.hasMore, true);
  const watermark = first.body.data.watermark;
  const afterWatermarkId = operationId();
  await create(afterWatermarkId).expect(201);
  await api.get(root + '/sync/bootstrap').expect(401);
  const second = await api.get(root + '/sync/bootstrap').query({ limit: 1, cursor: first.body.data.cursor }).auth(account.token, { type: 'bearer' }).expect(200);
  assert.equal(second.body.data.watermark, watermark);
  assert.equal(second.body.data.transactions.length, 1);
  assert.equal(second.body.data.transactions.some((row: {id:string})=>row.id===afterWatermarkId),false);
  assert.equal(second.body.data.categories.length, 0);
  const changed = await api.get(root + '/sync/pull?cursor=0&limit=100').auth(account.token, { type: 'bearer' }).expect(200);
  assert.ok(changed.body.data.events.some((event: { entityId: string }) => event.entityId === firstId));
  assert.ok(changed.body.data.events.some((event: { entityId: string }) => event.entityId === afterWatermarkId));
  assert.equal(changed.body.data.highWater, changed.body.data.nextCursor);
  const isolated = await api.get(root + '/sync/pull?cursor=0').auth(other.token, { type: 'bearer' }).expect(200);
  assert.equal(isolated.body.data.events.some((event: { entityId: string }) => event.entityId === firstId), false);
  await api.get(root + '/sync/pull?cursor=999999999999999999999999').auth(account.token, { type: 'bearer' }).expect(400);
  await api.get(root + '/sync/bootstrap?unknown=true').auth(account.token, { type: 'bearer' }).expect(400);
});

test('bootstrap cursors reject tampering and another account cannot reuse a cursor', async () => {
  const account = await newUser();
  const other = await newUser();
  const categoryId = account.categories.find((row) => row.kind === 'EXPENSE')!.id;
  for (let i=0;i<2;i++) await api.post(root + '/transactions').auth(account.token,{type:'bearer'}).set('Idempotency-Key',operationId()).send({id:operationId(),type:'EXPENSE',amountMinor:'1234',currency:'INR',categoryId,paymentMethod:'CASH',occurredAt:'2026-05-15T12:00:00+05:30'}).expect(201);
  const response = await api.get(root + '/sync/bootstrap?limit=1').auth(account.token, { type: 'bearer' }).expect(200);
  const token = response.body.data.cursor;
  if (token) {
    await api.get(root + '/sync/bootstrap').query({ cursor: `${token}x` }).auth(account.token, { type: 'bearer' }).expect(400);
    await api.get(root + '/sync/bootstrap').query({ cursor: token }).auth(other.token, { type: 'bearer' }).expect(400);
  }
});
