import { create, type StoreApi, type UseBoundStore } from 'zustand';
import * as contracts from '@nivvi/contracts';
import { usePreviewStore } from '../features/preview/store';
import type {
  Budget,
  CategoryKind,
  CategoryIcon,
  TransactionDraft,
} from '../features/preview/model';
import { parseAmount, today } from '../features/preview/finance';
import {
  api,
  isPreview,
  queryClient,
  session,
  uuid,
  type RecordDTO,
  type UserDTO,
} from './runtime';
import * as map from './mapping';
import { ApiError } from './client';
import { Platform } from 'react-native';
import { offlineOwner } from './runtime';
import { storeOfflineProfile } from './offline/database';
import { hydrateOffline, newOperationId, runSync, saveOfflineTransaction } from './offline/sync';
import { scheduleOfflineSync, stopOfflineSync } from './offline/background';
type PreviewState = ReturnType<typeof usePreviewStore.getState>;
type AsyncKeys =
  | 'signOut'
  | 'updateProfile'
  | 'saveTransaction'
  | 'deleteTransaction'
  | 'saveCategory'
  | 'archiveCategory'
  | 'saveBudget'
  | 'saveGoal'
  | 'deleteGoal'
  | 'contribute'
  | 'removeContribution';
type State = Omit<PreviewState, AsyncKeys> & {
  [K in AsyncKeys]: (
    ...args: K extends 'saveTransaction' | 'saveGoal' | 'saveCategory' | 'updateProfile'
      ? [...Parameters<PreviewState[K]>, expectedVersion?: number]
      : Parameters<PreviewState[K]>
  ) => ReturnType<PreviewState[K]> | Promise<ReturnType<PreviewState[K]>>;
};
const empty = { transactions: [], categories: [], budgets: {}, goals: [] } as Pick<
  State,
  'transactions' | 'categories' | 'budgets' | 'goals'
>;
// Retry only the exact same operation after an ambiguous network result. No offline queue.
const operations = new Map<string, { id: string; body: unknown; promise?: Promise<RecordDTO> }>();
export async function write(path: string, method: string, input: unknown, create = false) {
  const owner = liveStore.getState().profile?.id;
  if (!owner) throw new Error('Sign in first.');
  const fingerprint = JSON.stringify([owner, path, method, input]);
  let operation = operations.get(fingerprint);
  if (!operation) {
    operation = { id: uuid(), body: create ? { ...(input as object), id: uuid() } : input };
    operations.set(fingerprint, operation);
  }
  if (operation.promise) return operation.promise;
  const current = operation;
  current.promise = api
    .request<RecordDTO>(path, {
      method,
      body: method === 'DELETE' ? undefined : JSON.stringify(current.body),
      headers: { 'Idempotency-Key': current.id },
    })
    .then((result) => {
      if (liveStore.getState().profile?.id !== owner) throw new Error('The account changed.');
      operations.delete(fingerprint);
      return result;
    })
    .catch((error) => {
      if (error instanceof ApiError && error.status > 0) {
        operations.delete(fingerprint);
        if (error.status === 409) void refreshData();
      }
      throw error;
    })
    .finally(() => {
      current.promise = undefined;
    });
  return current.promise;
}
export const refreshData = () =>
  queryClient.invalidateQueries({ queryKey: ['account', liveStore.getState().profile?.id] });
function saved(notice: string) {
  liveStore.setState({ notice });
  void refreshData();
}
const baseVersion = (row: { version?: number } | undefined) => {
  if (!row?.version) throw new Error('Refresh this record before making changes.');
  return row.version;
};
export const liveStore = create<State>((set, get) => ({
  ...empty,
  profile: null,
  onboarded: false,
  scenario: 'ready',
  notice: '',
  finishOnboarding: () => set({ onboarded: true }),
  signIn: () => {
    throw new Error('Use real authentication.');
  },
  signOut: async () => {
    await api.logout().catch(() => {});
    await offlineOwner.clear();
    await stopOfflineSync();
    await queryClient.cancelQueries();
    queryClient.clear();
    operations.clear();
    set({ ...empty, profile: null, notice: '', scenario: 'ready' });
    session.setState({ expired: false, offline: false });
  },
  updateProfile: async (name, expectedVersion) => {
    const current = get().profile;
    const row = await api.request<UserDTO>('/me', {
      method: 'PATCH',
      body: JSON.stringify(
        contracts.profilePatch.parse({
          baseVersion: expectedVersion ?? baseVersion(current ?? undefined),
          displayName: name,
        }),
      ),
    });
    set({ profile: map.profile(row) });
    saved('Profile updated.');
  },
  setScenario: () => {},
  dismissNotice: () => set({ notice: '' }),
  resetDemo: () => {
    throw new Error('Sample data is available only in explicit preview mode.');
  },
  saveTransaction: async (
    draft: TransactionDraft,
    editingId?: string,
    expectedVersion?: number,
  ) => {
    const existing = get().transactions.find((r) => r.id === editingId);
    const fields = {
      amountMinor: String(parseAmount(draft.amount)),
      currency: 'INR',
      categoryId: draft.categoryId,
      description: draft.description,
      merchantOrPayee: draft.merchant,
      paymentMethod: map.methods[draft.paymentMethod],
      occurredAt:
        existing?.date === draft.date ? existing.occurredAt : `${draft.date}T12:00:00+05:30`,
    };
    const body = editingId
      ? contracts.transactionPatch.parse({
          ...fields,
          baseVersion: expectedVersion ?? baseVersion(existing),
        })
      : contracts.transactionCreate.parse({
          id: draft.clientId ?? uuid(),
          ...fields,
          type: draft.type.toUpperCase(),
          ...(draft.type === 'refund' ? { originalExpenseId: draft.originalExpenseId } : {}),
        });
    if (Platform.OS !== 'web') {
      const owner = liveStore.getState().profile?.id;
      if (!owner) throw new Error('Sign in first.');
      const now = new Date().toISOString();
      const local = {
        ...(existing ? {
          id: existing.id, userId: owner, version: existing.version ?? 1,
          amountMinor: String(existing.amountPaise), currency: 'INR', type: existing.type.toUpperCase(),
          categoryId: existing.categoryId, description: existing.description, merchantOrPayee: existing.merchant,
          paymentMethod: map.methods[existing.paymentMethod], occurredAt: existing.occurredAt ?? `${existing.date}T12:00:00+05:30`,
          createdAt: existing.createdAt, updatedAt: existing.updatedAt, originalExpenseId: existing.originalExpenseId ?? null,
        } : {}),
        ...fields,
        id: editingId ?? String((body as { id:string }).id),
        userId: owner,
        version: existing?.version ?? 1,
        type: editingId ? existing?.type.toUpperCase() : draft.type.toUpperCase(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(draft.type === 'refund' ? { originalExpenseId: draft.originalExpenseId } : {}),
      };
      const operationId = newOperationId();
      const path = editingId ? `/transactions/${editingId}` : '/transactions';
      await saveOfflineTransaction({
        userId: owner, operationId, id: String(local.id), method: editingId ? 'PATCH' : 'POST',
        path, body, local, ...(editingId ? { baseVersion: Number((body as {baseVersion:number}).baseVersion) } : {}),
      });
      const optimistic = map.transaction(local as RecordDTO);
      liveStore.setState({ transactions: [optimistic, ...get().transactions.filter((row) => row.id !== optimistic.id)] });
      try {
        await runSync(owner);
        const cached = await hydrateOffline(owner);
        if (liveStore.getState().profile?.id === owner) set({ transactions: cached.transactions, categories: cached.categories });
      } catch { /* Durable local record and outbox remain available for the next sync attempt. */ }
      const final = get().transactions.find((row) => row.id === optimistic.id);
      saved(final?.syncStatus === 'synced' ? 'Saved to your account.' : final?.syncStatus === 'conflict' ? 'Saved on this device · needs review before sync.' : 'Saved on this device · waiting to sync.');
      return optimistic.id;
    }
    const result = await write(
      editingId ? `/transactions/${editingId}` : '/transactions',
      editingId ? 'PATCH' : 'POST',
      body,
      false,
    );
    const row = map.transaction(result);
    set({ transactions: [row, ...get().transactions.filter((r) => r.id !== row.id)] });
    saved('Saved to your account.');
    return row.id;
  },
  deleteTransaction: async (id) => {
    const row = get().transactions.find((r) => r.id === id);
    if (Platform.OS !== 'web' && row) {
      const owner=liveStore.getState().profile?.id;
      if(!owner) throw new Error('Sign in first.');
      const base=baseVersion(row);
      const local={id:row.id,userId:owner,version:base,amountMinor:String(row.amountPaise),currency:'INR',type:row.type.toUpperCase(),categoryId:row.categoryId,description:row.description,merchantOrPayee:row.merchant,paymentMethod:map.methods[row.paymentMethod],occurredAt:row.occurredAt,createdAt:row.createdAt,updatedAt:row.updatedAt,originalExpenseId:row.originalExpenseId??null};
      await saveOfflineTransaction({userId:owner,operationId:newOperationId(),id,method:'DELETE',path:`/transactions/${id}?baseVersion=${base}`,body:null,local,baseVersion:base});
      set({transactions:get().transactions.filter((r)=>r.id!==id)});
      let serverConfirmed=false;
      try { await runSync(owner); const cached=await hydrateOffline(owner); if(liveStore.getState().profile?.id===owner) set({transactions:cached.transactions,categories:cached.categories}); serverConfirmed=!cached.transactions.some((r)=>r.id===id); } catch { /* The delete remains queued. */ }
      saved(serverConfirmed?'Entry deleted from your account.':'Delete saved on this device · waiting to sync.');
      return;
    }
    await write(`/transactions/${id}?baseVersion=${baseVersion(row)}`, 'DELETE', null);
    set({ transactions: get().transactions.filter((r) => r.id !== id) });
    saved('Entry deleted.');
  },
  saveCategory: async (
    name: string,
    kind: CategoryKind,
    icon: CategoryIcon,
    editingId?: string,
    expectedVersion?: number,
  ) => {
    const previous = get().categories.find((r) => r.id === editingId);
    const fields = { name, iconKey: icon === 'gifts' ? 'gift' : icon };
    const body = editingId
      ? contracts.categoryPatch.parse({
          ...fields,
          baseVersion: expectedVersion ?? baseVersion(previous),
          archived: false,
        })
      : contracts.categoryCreate.parse({ ...fields, kind: kind.toUpperCase() });
    const row = map.category(
      await write(
        editingId ? `/categories/${editingId}` : '/categories',
        editingId ? 'PATCH' : 'POST',
        body,
      ),
    );
    set({ categories: [...get().categories.filter((r) => r.id !== row.id), row] });
    saved('Category saved.');
    return row.id;
  },
  archiveCategory: async (id) => {
    const previous = get().categories.find((r) => r.id === id);
    const row = map.category(
      await write(`/categories/${id}`, 'PATCH', {
        baseVersion: baseVersion(previous),
        archived: true,
      }),
    );
    set({ categories: get().categories.map((r) => (r.id === id ? row : r)) });
    saved('Category archived. Existing entries keep their category.');
  },
  saveBudget: async (plan: Budget) => {
    const previous = get().budgets[plan.month];
    const body = {
      baseVersion: previous?.version ?? null,
      limitMinor: String(plan.limitPaise),
      baseAllocations: (previous?.allocations ?? []).map((r) => ({ id: r.id, version: r.version })),
      allocations: Object.entries(plan.categoryLimits).map(([categoryId, amount]) => ({
        categoryId,
        limitMinor: String(amount),
      })),
    };
    const row = map.budget(await write(`/budget-plans/${plan.month}`, 'PUT', body));
    set({ budgets: { ...get().budgets, [plan.month]: row } });
    saved('Budget plan saved.');
  },
  saveGoal: async (name, amount, date, editingId, expectedVersion) => {
    const previous = get().goals.find((r) => r.id === editingId);
    const fields = { name, targetMinor: String(parseAmount(amount)), targetDate: date || null };
    const body = editingId
      ? contracts.goalPatch.parse({
          ...fields,
          baseVersion: expectedVersion ?? baseVersion(previous),
        })
      : contracts.goalCreate.omit({ id: true }).parse(fields);
    const result = await write(
      editingId ? `/goals/${editingId}` : '/goals',
      editingId ? 'PATCH' : 'POST',
      body,
      !editingId,
    );
    const row = {
      ...map.goal(result),
      contributions: previous?.contributions ?? [],
      savedPaise: previous?.savedPaise ?? 0,
    };
    set({ goals: [...get().goals.filter((r) => r.id !== row.id), row] });
    saved('Goal saved.');
    return row.id;
  },
  deleteGoal: async (id) => {
    const row = get().goals.find((r) => r.id === id);
    await write(
      `/goals/${id}?baseVersion=${baseVersion(row)}&confirmContributions=true`,
      'DELETE',
      null,
    );
    set({ goals: get().goals.filter((r) => r.id !== id) });
    saved('Goal deleted.');
  },
  contribute: async (id, amount) => {
    const body = contracts.contributionCreate.omit({ id: true }).parse({
      amountMinor: String(parseAmount(amount)),
      contributedAt: `${today()}T12:00:00+05:30`,
    });
    const result = await write(`/goals/${id}/contributions`, 'POST', body, true);
    set({
      goals: get().goals.map((g) =>
        g.id === id
          ? {
              ...g,
              savedPaise: (g.savedPaise ?? 0) + map.minor(result.amountMinor),
              contributions: [
                ...g.contributions,
                {
                  id: result.id,
                  version: result.version,
                  amountPaise: map.minor(result.amountMinor),
                  date: map.localDay(result.contributedAt),
                },
              ],
            }
          : g,
      ),
    });
    saved('Contribution recorded. No money was moved.');
  },
  removeContribution: async (id, contributionId) => {
    const row = get()
      .goals.find((r) => r.id === id)
      ?.contributions.find((r) => r.id === contributionId);
    await write(
      `/goals/${id}/contributions/${contributionId}?baseVersion=${baseVersion(row)}`,
      'DELETE',
      null,
    );
    set({
      goals: get().goals.map((g) =>
        g.id === id
          ? {
              ...g,
              savedPaise: (g.savedPaise ?? 0) - (row?.amountPaise ?? 0),
              contributions: g.contributions.filter((r) => r.id !== contributionId),
            }
          : g,
      ),
    });
    saved('Contribution removed.');
  },
}));
export const useAppStore = (isPreview ? usePreviewStore : liveStore) as UseBoundStore<
  StoreApi<State>
>;
export async function authenticate(
  mode: 'sign-in' | 'register',
  email: string,
  password: string,
  name = '',
) {
  const body =
    mode === 'register'
      ? contracts.registerBody.parse({
          email,
          password,
          displayName: name,
          installationId: 'mobile',
        })
      : contracts.loginBody.parse({ email, password, installationId: 'mobile' });
  const value = await api.request<{ user: UserDTO; accessToken: string; refreshToken: string }>(
    mode === 'register' ? '/auth/register' : '/auth/login',
    { method: 'POST', body: JSON.stringify(body) },
    false,
  );
  const previous = liveStore.getState().profile?.id;
  await queryClient.cancelQueries();
  await api.accept(value, value.user.id);
  if (Platform.OS !== 'web') {
    await storeOfflineProfile(value.user.id, value.user);
    await scheduleOfflineSync();
  }
  if (previous !== value.user.id) {
    queryClient.clear();
    operations.clear();
  }
  liveStore.setState({
    ...(previous === value.user.id ? {} : empty),
    profile: map.profile(value.user),
    onboarded: true,
    scenario: previous === value.user.id ? 'ready' : 'loading',
    notice: '',
  });
  session.setState({ expired: false, offline: false });
  if (Platform.OS !== 'web') {
    try {
      await runSync(value.user.id);
      const cached=await hydrateOffline(value.user.id);
      if(liveStore.getState().profile?.id===value.user.id) liveStore.setState(cached);
    } catch { /* Account remains usable; local operations will retry on the next foreground sync. */ }
  }
  return previous === value.user.id;
}
export async function loadGoal(id: string) {
  const owner = liveStore.getState().profile?.id;
  const row = await api.request<RecordDTO>(`/goals/${id}`);
  const records = await import('./runtime').then((m) =>
    m.allPages<RecordDTO>(`/goals/${id}/contributions`),
  );
  if (liveStore.getState().profile?.id !== owner) return;
  const result = {
    ...map.goal(row),
    contributions: records.map((r) => ({
      id: r.id,
      version: r.version,
      amountPaise: map.minor(r.amountMinor),
      date: map.localDay(r.contributedAt),
    })),
  };
  liveStore.setState({ goals: [...liveStore.getState().goals.filter((r) => r.id !== id), result] });
}
