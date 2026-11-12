import type { Tx } from './types.js';
import { emit } from './database.js';
const defaults = [
  ['Food', 'food'],
  ['Groceries', 'groceries'],
  ['Shopping', 'shopping'],
  ['Transportation', 'transport'],
  ['Entertainment', 'entertainment'],
  ['Bills', 'bills'],
  ['Health', 'health'],
  ['Education', 'education'],
  ['Travel', 'travel'],
  ['Subscriptions', 'subscriptions'],
  ['Other', 'other'],
  ['Salary', 'salary'],
  ['Freelance', 'freelance'],
  ['Investments', 'investments'],
  ['Gifts', 'gift'],
  ['Other', 'other'],
];
export async function seedDefaultCategories(tx: Tx, userId: string) {
  for (const [i, [name, iconKey]] of defaults.entries()) {
    const kind = i < 11 ? 'EXPENSE' : 'INCOME';
    const row = await tx.category.create({
      data: {
        userId,
        name,
        normalizedName: name.toLowerCase(),
        iconKey,
        kind,
        defaultKey: `${kind}:${i}`,
      },
    });
    await emit(tx, userId, 'Category', row);
  }
}
