import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app, db, closeDatabase } from './helpers.js';
after(closeDatabase);
type Credentials = { accessToken: string; refreshToken: string };
type Client = {
  accept(value: Credentials): Promise<void>;
  request<T>(path: string, init?: RequestInit, authenticated?: boolean): Promise<T>;
  logout(): Promise<void>;
};
type Vault = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
};
// Execute the actual platform-independent mobile transport against HTTP and real PostgreSQL.
const { ApiClient } = (await import(
  new URL('../../mobile/src/data/client.ts', import.meta.url).href
)) as { ApiClient: new (base: string, vault: Vault, fetcher: typeof fetch) => Client };
test('mobile transport persists real financial records, recovers a lost response and shares token rotation', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let stored: string | null = null,
    lost = true,
    refreshCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) refreshCount++;
    const result = await fetch(input, init);
    if (lost && path.endsWith('/transactions') && init?.method === 'POST') {
      lost = false;
      throw new Error('Response lost after PostgreSQL committed');
    }
    return result;
  };
  const vault: Vault = {
    get: async () => stored,
    set: async (value) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  };
  const client = new ApiClient(`http://127.0.0.1:${address.port}/api/v1`, vault, fetcher);
  try {
    const auth = await client.request<Credentials & { user: { id: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: `mobile-${randomUUID()}@example.test`,
          password: 'IntegrationTestPassword123!',
          displayName: 'Mobile test',
          installationId: 'test',
        }),
      },
      false,
    );
    await client.accept(auth);
    assert.equal(stored, auth.refreshToken);
    const categories = await client.request<{ id: string; kind: string }[]>('/categories');
    const expense = categories.find((c) => c.kind === 'EXPENSE')!;
    const id = randomUUID(),
      key = randomUUID();
    const init = {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({
        id,
        type: 'EXPENSE',
        amountMinor: '12550',
        categoryId: expense.id,
        paymentMethod: 'UPI',
        occurredAt: '2026-11-11T12:00:00+05:30',
        merchantOrPayee: 'Mobile integration',
      }),
    };
    await assert.rejects(client.request('/transactions', init), { code: 'NETWORK_ERROR' });
    const row = await client.request<{ id: string; version: number }>('/transactions', init);
    assert.equal(row.id, id);
    assert.equal(await db.transaction.count({ where: { userId: auth.user.id } }), 1);
    await client.request(`/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ baseVersion: 1, amountMinor: '13075' }),
    });
    await client.accept({ accessToken: 'expired-bearer', refreshToken: stored! });
    await Promise.all([client.request('/me'), client.request('/transactions')]);
    assert.equal(refreshCount, 1);
    assert.notEqual(stored, auth.refreshToken);
    const plan = await client.request<{ id: string }>('/budget-plans/2026-11', {
      method: 'PUT',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        baseVersion: null,
        baseAllocations: [],
        limitMinor: '200000',
        allocations: [{ categoryId: expense.id, limitMinor: '50000' }],
      }),
    });
    assert.ok(plan.id);
    const goalId = randomUUID();
    await client.request('/goals', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ id: goalId, name: 'Weekend', targetMinor: '100000' }),
    });
    await client.request(`/goals/${goalId}/contributions`, {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        id: randomUUID(),
        amountMinor: '25000',
        contributedAt: '2026-11-11T12:00:00+05:30',
      }),
    });
    const dashboard = await client.request<{
      totals: { netExpense: string };
      availableBudgetMinor: string;
      goals: { contributedMinor: string };
    }>('/dashboard?month=2026-11');
    assert.equal(dashboard.totals.netExpense, '13075');
    assert.equal(dashboard.availableBudgetMinor, '186925');
    assert.equal(dashboard.goals.contributedMinor, '25000');
    await client.logout();
    assert.equal(stored, null);
    assert.equal(await db.session.count({ where: { userId: auth.user.id, revokedAt: null } }), 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
