import { ApiError } from '../data/client';
import { Platform } from 'react-native';
jest.mock('../data/runtime', () => {
  let counter = 0;
  return {
    isPreview: false,
    uuid: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++counter).padStart(12, '0')}`,
    api: { request: jest.fn() },
    queryClient: {
      invalidateQueries: jest.fn(async () => {}),
      cancelQueries: jest.fn(async () => {}),
      clear: jest.fn(),
    },
    session: { setState: jest.fn() },
  };
});
import { liveStore } from '../data/store';
import { api } from '../data/runtime';
import type { TransactionDraft } from '../features/preview/model';
const request = api.request as jest.Mock;
let owner = 0;
beforeAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }));
beforeEach(() => {
  request.mockReset();
  liveStore.setState({
    profile: { id: `owner-${++owner}`, name: 'Test', email: 'test@example.test' },
    transactions: [],
    categories: [],
    goals: [],
    budgets: {},
  });
});
const draft: TransactionDraft = {
  clientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  amount: '125.50',
  type: 'expense',
  categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  description: 'A note',
  merchant: 'Tea',
  paymentMethod: 'Cash',
  date: '2026-11-11',
};
const record = {
  id: draft.clientId!,
  version: 1,
  amountMinor: '12550',
  type: 'EXPENSE',
  userId: 'test',
  categoryId: draft.categoryId,
  description: draft.description,
  merchantOrPayee: draft.merchant,
  paymentMethod: 'CASH',
  occurredAt: '2026-11-11T12:00:00+05:30',
  createdAt: '2026-11-11T12:00:00Z',
  updatedAt: '2026-11-11T12:00:00Z',
};
test('an ambiguous transaction response reuses its operation and entity IDs and publishes only acknowledged data', async () => {
  request
    .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Lost response'))
    .mockResolvedValueOnce(record);
  await expect(liveStore.getState().saveTransaction(draft)).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
  });
  expect(liveStore.getState().transactions).toHaveLength(0);
  await liveStore.getState().saveTransaction(draft);
  expect(request.mock.calls[1][1]).toEqual(request.mock.calls[0][1]);
  expect(liveStore.getState().transactions).toHaveLength(1);
  expect(liveStore.getState().transactions[0]!.amountPaise).toBe(12550);
});
test('same-frame repeated saves share the pending request', async () => {
  let resolve!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const a = liveStore.getState().saveTransaction(draft);
  const b = liveStore.getState().saveTransaction(draft);
  expect(request).toHaveBeenCalledTimes(1);
  resolve(record);
  await Promise.all([a, b]);
  expect(liveStore.getState().transactions).toHaveLength(1);
});
test('editor versions remain the opened snapshot after a background refresh', async () => {
  liveStore.setState({
    transactions: [
      {
        id: record.id,
        userId: 'test',
        version: 7,
        amountPaise: 12550,
        type: 'expense',
        categoryId: draft.categoryId,
        description: 'Changed elsewhere',
        merchant: 'Tea',
        paymentMethod: 'Cash',
        date: draft.date,
        occurredAt: record.occurredAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    ],
  });
  request.mockRejectedValue(new ApiError(409, 'VERSION_CONFLICT', 'Review current record'));
  await expect(liveStore.getState().saveTransaction(draft, record.id, 2)).rejects.toMatchObject({
    code: 'VERSION_CONFLICT',
  });
  expect(JSON.parse(request.mock.calls[0][1].body).baseVersion).toBe(2);
  expect(liveStore.getState().transactions[0]!.description).toBe('Changed elsewhere');
});
test('a confirmed contribution remains successful if later report refreshes fail', async () => {
  liveStore.setState({
    goals: [
      {
        id: 'goal',
        name: 'Trip',
        version: 1,
        targetPaise: 100000,
        targetDate: '',
        savedPaise: 0,
        contributions: [],
      },
    ],
  });
  request.mockResolvedValueOnce({
    id: 'contribution',
    version: 1,
    amountMinor: '500',
    contributedAt: record.occurredAt,
  });
  await liveStore.getState().contribute('goal', '5');
  expect(request).toHaveBeenCalledTimes(1);
  expect(liveStore.getState().goals[0]!.savedPaise).toBe(500);
});
