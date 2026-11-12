import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { ApiClient } from './client';

export const isPreview = __DEV__ && process.env.EXPO_PUBLIC_DATA_MODE === 'preview';
const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
export const apiUrl = (configured || (__DEV__ ? 'http://127.0.0.1:3000' : ''))
  .replace(/\/$/, '')
  .replace(/\/api\/v1$/i, '');
const environmentKey = Constants.expoConfig?.extra?.environment ?? 'development';
const key = `nivvi.session.v2.${environmentKey}`;
const legacyRefreshKey = `nivvi.refresh.${environmentKey}`;
const legacyOwnerKey = `nivvi.offline.owner.${environmentKey}`;
let webRefresh: string | null = null;
let webOwner: string | null = null;
type StoredSession = { refreshToken: string; ownerId: string | null };
async function readStoredSession(): Promise<StoredSession | null> {
  if (Platform.OS === 'web') return webRefresh ? { refreshToken: webRefresh, ownerId: webOwner } : null;
  const current = await SecureStore.getItemAsync(key);
  if (current) {
    try {
      const value = JSON.parse(current) as StoredSession;
      if (typeof value.refreshToken === 'string') return value;
    } catch { return { refreshToken: current, ownerId: null }; }
  }
  const legacyToken = await SecureStore.getItemAsync(legacyRefreshKey);
  if (!legacyToken) return null;
  const ownerId = await SecureStore.getItemAsync(legacyOwnerKey);
  const migrated = { refreshToken: legacyToken, ownerId };
  await SecureStore.setItemAsync(key, JSON.stringify(migrated), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return migrated;
}
export const session = create<{ ready: boolean; expired: boolean; error: string; offline: boolean }>(() => ({
  ready: isPreview,
  expired: false,
  error: '',
  offline: false,
}));
export const offlineOwner = {
  get: async () => (await readStoredSession())?.ownerId ?? null,
  set: async (value: string) => {
    if (Platform.OS === 'web') { webOwner = value; return; }
    const current = await readStoredSession();
    if (current) await SecureStore.setItemAsync(key, JSON.stringify({ ...current, ownerId: value }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  clear: async () => {
    if (Platform.OS === 'web') { webOwner = null; return; }
    await SecureStore.deleteItemAsync(legacyOwnerKey);
    const current = await readStoredSession();
    if (current) await SecureStore.setItemAsync(key, JSON.stringify({ ...current, ownerId: null }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
};
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
});
export const api = new ApiClient(
  `${apiUrl}/api/v1`,
  {
    get: async () => (await readStoredSession())?.refreshToken ?? null,
    set: async (value, ownerId) => {
      if (Platform.OS === 'web') { webRefresh = value; if(ownerId!==undefined) webOwner=ownerId; }
      else {
        const old=await readStoredSession();
        await SecureStore.setItemAsync(key, JSON.stringify({refreshToken:value,ownerId:ownerId===undefined?(old?.ownerId??null):ownerId}), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        await SecureStore.deleteItemAsync(legacyRefreshKey);
        await SecureStore.deleteItemAsync(legacyOwnerKey);
      }
    },
    clear: async () => {
      if (Platform.OS === 'web') { webRefresh = null; webOwner=null; }
      else { await SecureStore.deleteItemAsync(key); await SecureStore.deleteItemAsync(legacyRefreshKey); await SecureStore.deleteItemAsync(legacyOwnerKey); }
    },
  },
  fetch,
  () => session.setState({ expired: true }),
);
export const uuid = () => Crypto.randomUUID();
export type UserDTO = {
  id: string;
  displayName: string;
  email: string;
  profileVersion: number;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  emailVerifiedAt: string | null;
};
export type RecordDTO = { id: string; version: number; [key: string]: unknown };
export async function allPages<T>(path: string) {
  const rows: T[] = [];
  let cursor: string | null = null;
  do {
    const page: { data: T[]; page: { nextCursor: string | null; hasMore: boolean } } =
      await api.page<T>(
        `${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
    rows.push(...page.data);
    cursor = page.page.nextCursor;
    if (rows.length > 100000)
      throw new Error('This list is too large. Narrow the reporting period.');
  } while (cursor);
  return rows;
}
