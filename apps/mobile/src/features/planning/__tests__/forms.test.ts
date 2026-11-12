import { budgetDraft, goalErrors } from '../forms';
import { today } from '../../preview/finance';
import { usePreviewStore } from '../../preview/store';

describe('planning drafts', () => {
  it('converts rupee inputs to integer paise and removes empty category limits', () => {
    const result = budgetDraft('2026-11', '100.01', { food: '50.01', travel: '  ' });
    expect(result.errors).toEqual({});
    expect(result.budget).toEqual({
      month: '2026-11',
      limitPaise: 10001,
      categoryLimits: { food: 5001 },
    });
  });
  it('allows exact allocation and rejects over-allocation by a single paisa', () => {
    expect(budgetDraft('2026-11', '100', { a: '40.01', b: '59.99' }).errors).toEqual({});
    expect(budgetDraft('2026-11', '100', { a: '40.01', b: '60' }).errors.monthly).toBeTruthy();
  });
  it('reports invalid fields while allowing a zero budget limit', () => {
    const { errors } = budgetDraft('2026-11', '', { a: '0', b: '1.001' });
    expect(Object.keys(errors).sort()).toEqual(['b', 'monthly']);
    expect(budgetDraft('2026-11', '0', { a: '0' })).toMatchObject({
      errors: {},
      budget: { limitPaise: 0, categoryLimits: { a: 0 } },
    });
  });
  it('accepts an optional deadline and validates calendar dates, names, and amounts', () => {
    expect(goalErrors('Rainy day', '1000.01', '')).toEqual({});
    expect(goalErrors('Rainy day', '1000', today())).toEqual({});
    expect(Object.keys(goalErrors(' ', '0', '2026-02-30')).sort()).toEqual([
      'amount',
      'date',
      'name',
    ]);
    expect(goalErrors('Goal', '100', '2000-01-01').date).toBeTruthy();
  });
});

describe('goal UI store actions', () => {
  beforeEach(() => usePreviewStore.getState().resetDemo(true));
  it('keeps contributions separate from the transaction ledger and preserves them when editing', () => {
    const state = usePreviewStore.getState();
    const records = state.transactions;
    const id = state.saveGoal('Trip', '1000', '');
    state.contribute(id, '25.01');
    state.saveGoal('New trip', '2000', '', id);
    const goal = usePreviewStore.getState().goals.find((item) => item.id === id)!;
    expect(goal.contributions[0]?.amountPaise).toBe(2501);
    expect(usePreviewStore.getState().transactions).toBe(records);
    state.removeContribution(id, goal.contributions[0]!.id);
    expect(usePreviewStore.getState().goals[0]?.contributions).toEqual([]);
    state.deleteGoal(id);
    expect(usePreviewStore.getState().goals).toEqual([]);
    expect(usePreviewStore.getState().transactions).toBe(records);
  });
  it('rejects contributions to missing goals and invalid goal amounts', () => {
    expect(() => usePreviewStore.getState().contribute('missing', '100')).toThrow();
    expect(() => usePreviewStore.getState().saveGoal('Goal', '-1', '')).toThrow();
  });
});
