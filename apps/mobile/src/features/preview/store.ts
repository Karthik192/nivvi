import { create } from 'zustand';
import { createFixtures } from './fixtures';
import {
  MAX_AMOUNT_PAISE,
  parseAmount,
  today,
  validDate,
  validateBudget,
  validateTransaction,
} from './finance';
import type {
  Budget,
  Category,
  CategoryIcon,
  CategoryKind,
  Goal,
  PreviewScenario,
  Profile,
  Transaction,
  TransactionDraft,
} from './model';

let sequence = 0;
const id = (kind: string) => `${kind}-${Date.now()}-${++sequence}`;
type State = ReturnType<typeof createFixtures> & {
  profile: Profile | null;
  onboarded: boolean;
  scenario: PreviewScenario;
  notice: string;
  finishOnboarding: () => void;
  signIn: (name: string, email: string) => void;
  signOut: () => void;
  updateProfile: (name: string) => void;
  setScenario: (scenario: PreviewScenario) => void;
  dismissNotice: () => void;
  resetDemo: (empty?: boolean) => void;
  saveTransaction: (draft: TransactionDraft, editingId?: string) => string;
  deleteTransaction: (id: string) => void;
  saveCategory: (
    name: string,
    kind: CategoryKind,
    icon: CategoryIcon,
    editingId?: string,
  ) => string;
  archiveCategory: (id: string) => void;
  saveBudget: (budget: Budget) => void;
  saveGoal: (name: string, targetAmount: string, targetDate: string, editingId?: string) => string;
  deleteGoal: (id: string) => void;
  contribute: (goalId: string, amount: string) => void;
  removeContribution: (goalId: string, contributionId: string) => void;
};
const fail = (message: string): never => {
  throw new Error(message);
};
export const usePreviewStore = create<State>((set, get) => ({
  ...(__DEV__ ? createFixtures() : { categories: [], transactions: [], goals: [], budgets: {} }),
  profile: null,
  onboarded: false,
  scenario: 'ready',
  notice: '',
  finishOnboarding: () => set({ onboarded: true }),
  signIn: (name, email) =>
    set({
      profile: { name: name.trim() || 'Friend', email: email.trim().toLowerCase() },
      onboarded: true,
    }),
  signOut: () => set({ ...createFixtures(), profile: null, scenario: 'ready', notice: '' }),
  updateProfile: (name) => {
    if (!name.trim() || name.trim().length > 60) fail('Use a name between 1 and 60 characters.');
    const profile = get().profile;
    if (profile)
      set({
        profile: { ...profile, name: name.trim() },
        notice: 'Profile updated in this preview.',
      });
  },
  setScenario: (scenario) => set({ scenario }),
  dismissNotice: () => set({ notice: '' }),
  resetDemo: (empty = false) => {
    const fixtures = createFixtures();
    set({
      ...fixtures,
      ...(empty ? { transactions: [], goals: [], budgets: {} } : {}),
      scenario: 'ready',
      notice: empty ? 'Empty preview ready. Add your first sample entry.' : 'Sample data restored.',
    });
  },
  saveTransaction: (draft, editingId) => {
    const { categories, transactions } = get();
    if (editingId && !transactions.some((record) => record.id === editingId))
      fail('This entry is no longer available.');
    if (!editingId && transactions.length >= 500)
      fail('This preview holds up to 500 entries. Reset it in Preview tools.');
    const { errors, amountPaise } = validateTransaction(draft, categories, transactions, editingId);
    if (Object.keys(errors).length) fail(Object.values(errors)[0] ?? 'Check your entry.');
    const recordId = editingId ?? id('entry');
    const stamp = new Date().toISOString();
    const existing = transactions.find((record) => record.id === editingId);
    const record: Transaction = {
      id: recordId,
      userId: 'preview',
      amountPaise,
      categoryId: draft.categoryId,
      description: draft.description.trim(),
      merchant: draft.merchant.trim(),
      type: draft.type,
      paymentMethod: draft.paymentMethod,
      date: draft.date,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      ...(draft.type === 'refund' ? { originalExpenseId: draft.originalExpenseId } : {}),
    };
    set({
      transactions: editingId
        ? transactions.map((item) => (item.id === editingId ? record : item))
        : [record, ...transactions],
      notice: editingId
        ? 'Entry updated in this preview.'
        : 'Added to this preview. Nothing was stored or synced.',
    });
    return recordId;
  },
  deleteTransaction: (recordId) => {
    if (get().transactions.some((record) => record.originalExpenseId === recordId))
      fail('Remove the linked refunds before deleting their expense.');
    set({
      transactions: get().transactions.filter((record) => record.id !== recordId),
      notice: 'Entry removed from this preview.',
    });
  },
  saveCategory: (name, kind, icon, editingId) => {
    const trimmed = name.trim();
    const categories = get().categories;
    if (!trimmed || trimmed.length > 30) fail('Use a category name between 1 and 30 characters.');
    if (
      categories.some(
        (item) =>
          item.id !== editingId &&
          item.kind === kind &&
          item.name.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      fail(
        'A category with this name already exists. Restore it if archived, or choose another name.',
      );
    if (editingId && !categories.some((item) => item.id === editingId && item.kind === kind))
      fail('This category is no longer available.');
    const category: Category = {
      id: editingId ?? id('category'),
      name: trimmed,
      kind,
      icon,
      archived: false,
    };
    set({
      categories: editingId
        ? categories.map((item) => (item.id === editingId ? category : item))
        : [...categories, category],
      notice: 'Category updated in this preview.',
    });
    return category.id;
  },
  archiveCategory: (categoryId) =>
    set({
      categories: get().categories.map((item) =>
        item.id === categoryId ? { ...item, archived: true } : item,
      ),
      notice: 'Category archived. Existing entries keep their category.',
    }),
  saveBudget: (budget) => {
    validateBudget(budget);
    if (
      Object.keys(budget.categoryLimits).some(
        (categoryId) =>
          !get().categories.some(
            (category) => category.id === categoryId && category.kind === 'expense',
          ),
      )
    )
      fail('Choose valid expense categories.');
    set({
      budgets: { ...get().budgets, [budget.month]: budget },
      notice: 'Budget updated in this preview.',
    });
  },
  saveGoal: (name, targetAmount, targetDate, editingId) => {
    if (!name.trim() || name.trim().length > 60)
      fail('Use a goal name between 1 and 60 characters.');
    if (targetDate && (!validDate(targetDate) || targetDate < today()))
      fail('Use today or a future target date, as YYYY-MM-DD.');
    const targetPaise = parseAmount(targetAmount);
    const previous = get().goals.find((goal) => goal.id === editingId);
    if (editingId && !previous) fail('This goal is no longer available.');
    const goal: Goal = {
      id: editingId ?? id('goal'),
      name: name.trim(),
      targetPaise,
      targetDate,
      contributions: previous?.contributions ?? [],
    };
    set({
      goals: editingId
        ? get().goals.map((item) => (item.id === editingId ? goal : item))
        : [...get().goals, goal],
      notice: 'Goal updated in this preview.',
    });
    return goal.id;
  },
  deleteGoal: (goalId) =>
    set({
      goals: get().goals.filter((goal) => goal.id !== goalId),
      notice: 'Goal removed from this preview.',
    }),
  contribute: (goalId, amount) => {
    const goal = get().goals.find((item) => item.id === goalId);
    if (!goal) fail('This goal is no longer available.');
    const amountPaise = parseAmount(amount);
    if (
      goal!.contributions.length >= 500 ||
      goal!.contributions.reduce((sum, item) => sum + item.amountPaise, 0) + amountPaise >
        MAX_AMOUNT_PAISE
    )
      fail('This preview goal has reached its contribution limit.');
    set({
      goals: get().goals.map((item) =>
        item.id === goalId
          ? {
              ...item,
              contributions: [
                ...item.contributions,
                { id: id('contribution'), amountPaise, date: today() },
              ],
            }
          : item,
      ),
      notice: 'Contribution added to your preview goal. No money was moved.',
    });
  },
  removeContribution: (goalId, contributionId) =>
    set({
      goals: get().goals.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              contributions: goal.contributions.filter((item) => item.id !== contributionId),
            }
          : goal,
      ),
      notice: 'Contribution removed from this preview goal.',
    }),
}));
