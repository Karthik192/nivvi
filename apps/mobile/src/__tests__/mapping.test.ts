import { exactMoney, localDay, transaction } from '../data/mapping';
test('exact Indian formatting does not pass BigInt through native Intl', () => {
  expect(exactMoney('0')).toBe('₹0');
  expect(exactMoney('12550')).toBe('₹125.50');
  expect(exactMoney('-12345678901')).toBe('−₹12,34,56,789.01');
  expect(exactMoney('90090000000000001')).toBe('₹90,09,00,00,00,00,000.01');
});
test('transaction mapping preserves payment methods, versions and the local calendar day', () => {
  expect(localDay('2026-10-31T20:00:00Z')).toBe('2026-11-01');
  const row = transaction({
    id: 'entry',
    version: 2,
    userId: 'user',
    type: 'REFUND',
    amountMinor: '12550',
    categoryId: 'category',
    merchantOrPayee: null,
    description: null,
    paymentMethod: 'DEBIT_CARD',
    occurredAt: '2026-10-31T20:00:00Z',
    createdAt: '2026-10-31T20:00:00Z',
    updatedAt: '2026-10-31T20:00:00Z',
    originalExpenseId: 'parent',
  });
  expect(row).toMatchObject({
    version: 2,
    date: '2026-11-01',
    paymentMethod: 'Debit card',
    amountPaise: 12550,
    originalExpenseId: 'parent',
  });
});
