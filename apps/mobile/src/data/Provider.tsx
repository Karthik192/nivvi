import { useEffect, type PropsWithChildren } from 'react';
import { AppState, View } from 'react-native';
import { QueryClientProvider, useQuery, focusManager } from '@tanstack/react-query';
import {
  api,
  apiIsReachable,
  isPreview,
  queryClient,
  session,
  allPages,
  type RecordDTO,
  type UserDTO,
} from './runtime';
import { liveStore } from './store';
import * as map from './mapping';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Platform } from 'react-native';
import { offlineOwner } from './runtime';
import { readOfflineProfile, storeOfflineProfile } from './offline/database';
import { hydrateOffline, runSync } from './offline/sync';
import * as Network from 'expo-network';
import { scheduleOfflineSync } from './offline/background';
import { updateWidgetSummary } from './widget';
export async function restoreSession() {
  session.setState({ error: '' });
  try {
    if (!(await api.restore())) return;
    const user = await api.request<UserDTO>('/me');
    const profile = map.profile(user);
    // Authentication is complete. Keep the account navigable while the local
    // cache and background sync are restored; screen queries show their own
    // loading states for data that has not arrived yet.
    liveStore.setState({ profile, onboarded: true, scenario: 'ready' });
    session.setState({ expired: false, offline: false, error: '' });
    if (Platform.OS !== 'web') {
      try {
        await offlineOwner.set(user.id);
        await storeOfflineProfile(user.id, user);
        await scheduleOfflineSync();
      } catch {
        // Online authentication and account APIs remain usable if this device's
        // encrypted cache is unavailable.
      }
      void runSync(user.id)
        .then(async () => {
          const cached = await hydrateOffline(user.id);
          if (liveStore.getState().profile?.id === user.id)
            liveStore.setState({ ...cached, scenario: 'ready' });
        })
        .catch(() => {});
    }
  } catch (error) {
    if (Platform.OS !== 'web') {
      try {
        const owner = await offlineOwner.get();
        if (owner) {
          const cachedProfile = await readOfflineProfile(owner);
          if (cachedProfile) {
            const cached = await hydrateOffline(owner);
            liveStore.setState({ ...cached, profile: map.profile(cachedProfile as UserDTO), onboarded: true, scenario: 'ready', notice: 'Offline mode · changes stay on this device until sync.' });
            session.setState({ expired: false, offline: true, error: '' });
            return;
          }
        }
      } catch (storageError) {
        session.setState({ error: storageError instanceof Error ? storageError.message : 'Encrypted local data could not be opened.' });
      }
    }
    if (!session.getState().error) session.setState({ error: error instanceof Error ? error.message : 'Sign in to continue.' });
  } finally {
    session.setState({ ready: true });
  }
}
export function DataProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!isPreview) void restoreSession();
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const publishWidget = () => {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        const state = liveStore.getState();
        void updateWidgetSummary({
          userId: state.profile?.id ?? null,
          offline: session.getState().offline,
          transactions: state.transactions,
          categories: state.categories,
        }).catch(() => {});
      }, 150);
    };
    const unsubscribeStore = liveStore.subscribe(publishWidget);
    const unsubscribeSession = session.subscribe(publishWidget);
    publishWidget();
    const handleNetworkState = (state: Network.NetworkState) => {
      const owner = liveStore.getState().profile?.id;
      void (async () => {
        // Android may report no internet while the development API is reachable
        // over USB reverse or a local network. Probe the API before declaring offline.
        if (!state.isConnected && !(await apiIsReachable())) {
          session.setState({ offline: true });
          return;
        }
        session.setState({ offline: false });
        if (owner && Platform.OS !== 'web')
          void runSync(owner).then(async () => {
            const cached = await hydrateOffline(owner);
            if (liveStore.getState().profile?.id === owner) liveStore.setState(cached);
          }).catch(() => {});
      })();
    };
    const networkListener = Network.addNetworkStateListener(handleNetworkState);
    void Network.getNetworkStateAsync().then(handleNetworkState).catch(() => {});
    const listener = AppState.addEventListener('change', (value) => {
      focusManager.setFocused(value === 'active');
      const owner = liveStore.getState().profile?.id;
      if (value === 'active' && owner && Platform.OS !== 'web')
        void runSync(owner).then(async () => {
          const cached = await hydrateOffline(owner);
          if (liveStore.getState().profile?.id === owner) { liveStore.setState(cached); session.setState({ offline: false }); }
        }).catch(() => {});
    });
    return () => {
      listener.remove(); networkListener.remove();
      unsubscribeStore(); unsubscribeSession();
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Metadata />
      {children}
    </QueryClientProvider>
  );
}
function Metadata() {
  const owner = liveStore((s) => s.profile?.id);
  const query = useQuery({
    queryKey: ['account', owner, 'metadata'],
    enabled: !isPreview && !!owner,
    queryFn: async () => {
      if (Platform.OS !== 'web') {
        try {
          await runSync(owner!);
          const cached = await hydrateOffline(owner!);
          if (liveStore.getState().profile?.id === owner) liveStore.setState(cached);
        } catch {
          // A damaged/unavailable local cache must not block online account
          // data. The server requests below remain authoritative.
        }
      }
      const [categories, budgets, goals] = await Promise.all([
        api.request<RecordDTO[]>('/categories?includeArchived=true'),
        allPages<RecordDTO>('/budgets'),
        allPages<RecordDTO>('/goals'),
      ]);
      return {
        categories: categories.map(map.category),
        budgets: Object.fromEntries(
          budgets.map((r) => {
            const b = map.budget(r);
            return [b.month, b];
          }),
        ),
        goals: goals.map(map.goal),
      };
    },
  });
  useEffect(() => {
    if (query.data && liveStore.getState().profile?.id === owner) {
      liveStore.setState({
        ...query.data,
        goals: query.data.goals.map((g) => ({
          ...g,
          contributions: liveStore.getState().goals.find((p) => p.id === g.id)?.contributions ?? [],
        })),
        scenario: 'ready',
      });
      session.setState({ offline: false });
    }
  }, [query.data, owner]);
  useEffect(() => {
    if (query.error && liveStore.getState().profile?.id === owner) {
      if (session.getState().offline) {
        liveStore.setState({ scenario: 'ready' });
        return;
      }
      if (!query.data)
        liveStore.setState({
          scenario: 'error',
          notice: query.error instanceof Error ? query.error.message : 'Account data could not be loaded.',
        });
      else
        liveStore.setState({
          notice: 'Could not refresh account data. Previously loaded values are shown.',
        });
    }
  }, [query.error, query.data, owner]);
  return null;
}
export function ReloadAccount() {
  const detail = liveStore((state) => state.notice);
  return (
    <View style={{ gap: 16 }}>
      <AppText colour="danger">
        {detail || 'Could not load your account. Check your connection and try again.'}
      </AppText>
      <Button
        label="Try again"
        onPress={() => {
          liveStore.setState({ scenario: 'loading', notice: '' });
          void queryClient.invalidateQueries({ queryKey: ['account'] });
        }}
      />
      <Button
        label="Sign in again"
        onPress={() => {
          void api.clear().then(() => {
            queryClient.clear();
            liveStore.setState({ profile: null, scenario: 'ready' });
            session.setState({ expired: false });
          });
        }}
      />
    </View>
  );
}
