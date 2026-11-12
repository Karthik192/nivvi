import { useEffect, type PropsWithChildren } from 'react';
import { AppState, View } from 'react-native';
import { QueryClientProvider, useQuery, focusManager } from '@tanstack/react-query';
import {
  api,
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
    liveStore.setState({ profile, onboarded: true, scenario: 'loading' });
    if (Platform.OS !== 'web') {
      await offlineOwner.set(user.id);
      await storeOfflineProfile(user.id, user);
      await scheduleOfflineSync();
      await runSync(user.id);
      const cached = await hydrateOffline(user.id);
      liveStore.setState({ ...cached, scenario: 'ready' });
    }
    session.setState({ expired: false, offline: false });
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
    const networkListener = Network.addNetworkStateListener((state) => {
      const owner = liveStore.getState().profile?.id;
      if (!state.isConnected || state.isInternetReachable === false) {
        session.setState({ offline: true });
        return;
      }
      if (state.isConnected && owner && Platform.OS !== 'web')
        void runSync(owner).then(async () => {
          const cached = await hydrateOffline(owner);
          if (liveStore.getState().profile?.id === owner) {
            liveStore.setState(cached);
            session.setState({ offline: false });
          }
        }).catch(() => {});
    });
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
  const offline = session((s) => s.offline);
  const query = useQuery({
    queryKey: ['account', owner, 'metadata'],
    enabled: !isPreview && !offline && !!owner,
    queryFn: async () => {
      if (Platform.OS !== 'web') {
        await runSync(owner!);
        const cached = await hydrateOffline(owner!);
        if (liveStore.getState().profile?.id === owner) liveStore.setState(cached);
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
    if (query.data && liveStore.getState().profile?.id === owner)
      liveStore.setState({
        ...query.data,
        goals: query.data.goals.map((g) => ({
          ...g,
          contributions: liveStore.getState().goals.find((p) => p.id === g.id)?.contributions ?? [],
        })),
        scenario: 'ready',
      });
  }, [query.data, owner]);
  useEffect(() => {
    if (query.error && liveStore.getState().profile?.id === owner) {
      if (!query.data) liveStore.setState({ scenario: 'error' });
      else
        liveStore.setState({
          notice: 'Could not refresh account data. Previously loaded values are shown.',
        });
    }
  }, [query.error, query.data, owner]);
  return null;
}
export function ReloadAccount() {
  return (
    <View style={{ gap: 16 }}>
      <AppText>Could not load your account. Check your connection and try again.</AppText>
      <Button
        label="Try again"
        onPress={() => {
          liveStore.setState({ scenario: 'loading' });
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
